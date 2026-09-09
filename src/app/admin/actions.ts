"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppOrigin } from "@/lib/site-url";
import { phoneSchema } from "@/features/auth/phone";
import { ingestOdds } from "@/lib/odds/ingest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  pickOutcome,
  type ScoringGame,
  type ScoringPick,
} from "@/features/competition/scoring";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  phone: phoneSchema,
});

const gameSchema = z
  .object({
    weekNumber: z.coerce.number().int().min(1).max(22),
    freezeAt: z.string().datetime({ local: true }),
    awayTeam: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,3}$/),
    homeTeam: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,3}$/),
    kickoffAt: z.string().datetime({ local: true }),
    awaySpread: z.coerce.number().min(-99).max(99),
    total: z.coerce.number().positive().max(999),
    venue: z.string().trim().max(120),
    gameType: z.enum(["international", "tnf", "sunday", "snf", "mnf", "other"]),
  })
  .refine((value) => value.awayTeam !== value.homeTeam);

const resultSchema = z.object({
  gameId: z.coerce.number().int().positive(),
  awayScore: z.coerce.number().int().min(0).max(255),
  homeScore: z.coerce.number().int().min(0).max(255),
});

function easternLocalToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid local date and time");

  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = desired;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const rendered = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    instant += desired - rendered;
  }

  return new Date(instant).toISOString();
}

async function requireCommissioner() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data: commissioner } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", claims.claims.sub)
    .eq("role", "commissioner")
    .maybeSingle();
  if (!commissioner) redirect("/");

  return { supabase, poolId: commissioner.pool_id, userId: claims.claims.sub };
}

export async function saveGame(formData: FormData) {
  const parsed = gameSchema.safeParse({
    weekNumber: formData.get("week_number"),
    freezeAt: formData.get("freeze_at"),
    awayTeam: formData.get("away_team"),
    homeTeam: formData.get("home_team"),
    kickoffAt: formData.get("kickoff_at"),
    awaySpread: formData.get("away_spread"),
    total: formData.get("total"),
    venue: formData.get("venue"),
    gameType: formData.get("game_type"),
  });
  if (!parsed.success) redirect("/admin?game_error=invalid");

  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("pool_id", poolId)
    .eq("year", 2026)
    .maybeSingle();
  if (!season) redirect("/admin?game_error=season");

  const { data: week, error: weekError } = await supabase
    .from("pool_weeks")
    .upsert(
      {
        season_id: season.id,
        week_number: parsed.data.weekNumber,
        label: `Week ${parsed.data.weekNumber}`,
        lines_freeze_at: easternLocalToIso(parsed.data.freezeAt),
      },
      { onConflict: "season_id,week_number" },
    )
    .select("id")
    .single();
  if (weekError || !week) redirect("/admin?game_error=week");

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      week_id: week.id,
      away_team: parsed.data.awayTeam,
      home_team: parsed.data.homeTeam,
      kickoff_at: easternLocalToIso(parsed.data.kickoffAt),
      venue: parsed.data.venue || null,
      game_type: parsed.data.gameType,
    })
    .select("id")
    .single();
  if (gameError || !game) redirect("/admin?game_error=game");

  const { error: lineError } = await supabase.from("pool_lines").insert({
    game_id: game.id,
    away_spread: parsed.data.awaySpread,
    total: parsed.data.total,
    source: "commissioner",
    override_reason: "Manual commissioner entry",
    frozen_at: new Date().toISOString(),
  });
  if (lineError) redirect("/admin?game_error=line");

  revalidatePath("/admin");
  redirect("/admin?game_saved=1");
}

export async function inviteEntry(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) redirect("/admin?error=invalid");

  const { poolId, userId } = await requireCommissioner();

  const admin = createAdminClient();
  const { data: pool } = await admin
    .from("pools")
    .select("id")
    .eq("id", poolId)
    .maybeSingle();
  const { data: season } = await admin
    .from("seasons")
    .select("id, status")
    .eq("pool_id", poolId)
    .eq("year", 2026)
    .maybeSingle();

  if (!pool || !season || !["setup", "open"].includes(season.status)) {
    redirect("/admin?error=closed");
  }

  const { data: existingInvitation } = await admin
    .from("pool_invitations")
    .select("id")
    .eq("season_id", season.id)
    .eq("email", parsed.data.email.toLowerCase())
    .maybeSingle();
  if (existingInvitation) redirect("/admin?error=duplicate");

  const requestOrigin = (await headers()).get("origin");
  const invitationId = crypto.randomUUID();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${getAppOrigin(requestOrigin)}/auth/confirm?next=${encodeURIComponent(`/join?id=${invitationId}`)}`,
      data: { pool_invitation_id: invitationId },
    });

  if (inviteError || !invited.user) redirect("/admin?error=invite");

  const { error: provisionError } = await admin
    .from("pool_invitations")
    .insert({
      id: invitationId,
      pool_id: poolId,
      season_id: season.id,
      target_user_id: invited.user.id,
      email: parsed.data.email.toLowerCase(),
      phone_e164: parsed.data.phone,
      invited_by: userId,
    });

  if (provisionError) redirect("/admin?error=provision");
  await admin.from("commissioner_audit_events").insert({
    pool_id: poolId,
    actor_id: userId,
    action: "entrant_invited",
    entity_type: "pool_invitation",
    entity_id: invitationId,
    details: { delivery: "email" },
  });
  redirect("/admin?sent=1");
}

export async function revokeInvitation(formData: FormData) {
  const invitationId = z
    .string()
    .uuid()
    .safeParse(formData.get("invitation_id"));
  if (!invitationId.success) redirect("/admin/entrants?error=invite");
  const { supabase, poolId, userId } = await requireCommissioner();
  const { error } = await supabase
    .from("pool_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId.data)
    .eq("pool_id", poolId)
    .eq("status", "pending");
  if (error) redirect("/admin/entrants?error=invite");
  await supabase.from("commissioner_audit_events").insert({
    pool_id: poolId,
    actor_id: userId,
    action: "entrant_invitation_revoked",
    entity_type: "pool_invitation",
    entity_id: invitationId.data,
  });
  redirect("/admin/entrants?invite_revoked=1");
}

export async function recordGameResult(formData: FormData) {
  const parsed = resultSchema.safeParse({
    gameId: formData.get("game_id"),
    awayScore: formData.get("away_score"),
    homeScore: formData.get("home_score"),
  });
  if (!parsed.success) redirect("/admin?result_error=invalid");
  const { supabase, poolId } = await requireCommissioner();
  const { data: game } = await supabase
    .from("games")
    .select(
      "id, week_id, away_team, home_team, pool_lines(away_spread,total), pool_weeks!inner(season_id, week_number, seasons!inner(pool_id))",
    )
    .eq("id", parsed.data.gameId)
    .eq("pool_weeks.seasons.pool_id", poolId)
    .maybeSingle();
  if (!game) redirect("/admin?result_error=game");
  const line = Array.isArray(game.pool_lines)
    ? game.pool_lines[0]
    : game.pool_lines;
  if (!line) redirect("/admin?result_error=line");
  const atsAway = parsed.data.awayScore + Number(line.away_spread);
  const atsHome = parsed.data.homeScore;
  const atsWinner =
    atsAway === atsHome
      ? null
      : atsAway > atsHome
        ? game.away_team
        : game.home_team;
  const totalScore = parsed.data.awayScore + parsed.data.homeScore;
  const totalWinner =
    totalScore === Number(line.total)
      ? null
      : totalScore > Number(line.total)
        ? "over"
        : "under";
  const outrightWinner =
    parsed.data.awayScore === parsed.data.homeScore
      ? null
      : parsed.data.awayScore > parsed.data.homeScore
        ? game.away_team
        : game.home_team;
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase.from("game_results").upsert({
    game_id: game.id,
    away_score: parsed.data.awayScore,
    home_score: parsed.data.homeScore,
    ats_winner: atsWinner,
    total_winner: totalWinner,
    outright_winner: outrightWinner,
    source: "commissioner",
    recorded_by: claims?.claims?.sub,
    corrected_at: new Date().toISOString(),
  });
  if (error) redirect("/admin?result_error=save");
  await supabase
    .from("games")
    .update({
      away_score: parsed.data.awayScore,
      home_score: parsed.data.homeScore,
      status: "final",
      status_detail: "Final",
    })
    .eq("id", game.id);
  const gameWeek = Array.isArray(game.pool_weeks)
    ? game.pool_weeks[0]
    : game.pool_weeks;
  await rebuildGameScoreEvents(supabase, {
    id: game.id,
    weekId: game.week_id,
    weekNumber: gameWeek?.week_number ?? 0,
    away: game.away_team,
    home: game.home_team,
    awaySpread: Number(line.away_spread),
    total: Number(line.total),
    awayScore: parsed.data.awayScore,
    homeScore: parsed.data.homeScore,
    status: "final",
  });
  await supabase.from("commissioner_audit_events").insert({
    pool_id: poolId,
    actor_id: claims?.claims?.sub,
    action: "game_result_recorded",
    entity_type: "game",
    entity_id: String(game.id),
    details: {
      away_score: parsed.data.awayScore,
      home_score: parsed.data.homeScore,
    },
  });
  revalidatePath("/", "layout");
  redirect("/admin?result_saved=1");
}

async function rebuildGameScoreEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  game: ScoringGame,
) {
  const { data: submissions } = await supabase
    .from("weekly_submissions")
    .select("id, entry_id, revision")
    .eq("week_id", game.weekId)
    .order("revision", { ascending: false });
  const latest = new Map<number, number>();
  for (const item of submissions ?? [])
    if (!latest.has(item.entry_id)) latest.set(item.entry_id, item.id);
  const ids = [...latest.values()];
  const { data: rows } = ids.length
    ? await supabase
        .from("picks")
        .select(
          "id, submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", ids)
        .eq("game_id", game.id)
    : { data: [] };
  await supabase.from("score_events").delete().eq("game_id", game.id);
  const entryBySubmission = new Map(
    [...latest].map(([entryId, submissionId]) => [submissionId, entryId]),
  );
  const events = (rows ?? []).flatMap((row) => {
    const entryId = entryBySubmission.get(row.submission_id);
    if (!entryId) return [];
    const pick: ScoringPick = {
      entryId,
      gameId: row.game_id,
      kind: row.kind as ScoringPick["kind"],
      team: row.team,
      totalDirection: row.total_direction as ScoringPick["totalDirection"],
      isBestBet: row.is_best_bet,
    };
    const outcome = pickOutcome(game, pick);
    const base = {
      entry_id: entryId,
      week_id: game.weekId,
      game_id: game.id,
      pick_id: row.id,
      outcome,
      scoring_revision: 1,
    };
    const value =
      pick.kind === "underdog" && outcome === "win"
        ? Math.abs(pick.team === game.away ? game.awaySpread : -game.awaySpread)
        : pick.kind === "ats" || pick.kind === "total"
          ? outcome === "win"
            ? 1
            : outcome === "loss"
              ? -1
              : 0
          : 0;
    return [
      {
        ...base,
        kind: pick.kind,
        decision_value: value,
        strike_delta:
          pick.kind === "sudden_death" && outcome === "loss" ? 1 : 0,
      },
      ...(pick.isBestBet
        ? [
            {
              ...base,
              kind: "best_bet",
              decision_value: value,
              strike_delta: 0,
            },
          ]
        : []),
    ];
  });
  if (events.length) await supabase.from("score_events").insert(events);
}

export async function savePayoutSchedule(formData: FormData) {
  const seasonId = Number(formData.get("season_id"));
  const count = Number(formData.get("rank_count"));
  if (
    !Number.isSafeInteger(seasonId) ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 100
  )
    redirect("/admin?payout_error=invalid");
  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!season) redirect("/admin?payout_error=season");
  const rows = Array.from({ length: count }, (_, index) => ({
    season_id: seasonId,
    rank: index + 1,
    amount: Number(formData.get(`rank_${index + 1}`)),
  }));
  if (
    rows.some((row) => !Number.isFinite(row.amount)) ||
    Math.abs(rows.reduce((sum, row) => sum + row.amount, 0)) > 0.001
  )
    redirect("/admin?payout_error=balance");
  const { data: claims } = await supabase.auth.getClaims();
  const locked =
    formData.get("lock") === "on" ? new Date().toISOString() : null;
  const { error } = await supabase.from("payout_schedules").upsert(
    rows.map((row) => ({
      ...row,
      locked_at: locked,
      updated_by: claims?.claims?.sub,
    })),
  );
  if (error) redirect("/admin?payout_error=save");
  await supabase.from("commissioner_audit_events").insert({
    pool_id: poolId,
    actor_id: claims?.claims?.sub,
    action: locked ? "payout_schedule_locked" : "payout_schedule_saved",
    entity_type: "season",
    entity_id: String(seasonId),
    details: { ranks: count },
  });
  revalidatePath("/", "layout");
  redirect("/admin?payout_saved=1");
}

export async function generatePayoutSchedule(formData: FormData) {
  const seasonId = Number(formData.get("season_id"));
  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("pool_id", poolId)
    .maybeSingle();
  const { count } = await supabase
    .from("pool_entries")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId);
  if (!season || !count || count < 2) redirect("/admin?payout_error=entries");
  const rows = Array.from({ length: count }, (_, index) => ({
    season_id: seasonId,
    rank: index + 1,
    amount:
      count === 13
        ? 300 - index * 50
        : Math.round((300 - (600 * index) / (count - 1)) * 100) / 100,
  }));
  await supabase.from("payout_schedules").delete().eq("season_id", seasonId);
  const { error } = await supabase.from("payout_schedules").insert(rows);
  if (error) redirect("/admin?payout_error=generate");
  revalidatePath("/admin");
  redirect("/admin?payout_saved=1");
}

export async function refreshOdds(formData: FormData) {
  const weekId = Number(formData.get("week_id"));
  if (!Number.isSafeInteger(weekId)) redirect("/admin?odds_error=week");
  const { supabase, poolId } = await requireCommissioner();
  const { data: week } = await supabase
    .from("pool_weeks")
    .select("id, seasons!inner(pool_id)")
    .eq("id", weekId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!week) redirect("/admin?odds_error=access");
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) redirect("/admin?odds_error=key");
  const { data: claims } = await supabase.auth.getClaims();
  try {
    await ingestOdds({
      admin: createAdminClient(),
      apiKey,
      weekId,
      requestedBy: claims?.claims?.sub,
      triggerSource: "commissioner",
    });
  } catch {
    redirect("/admin?odds_error=provider");
  }
  revalidatePath("/", "layout");
  redirect("/admin?odds_refreshed=1");
}

export async function toggleWeekFreeze(formData: FormData) {
  const weekId = Number(formData.get("week_id"));
  const freeze = formData.get("freeze") === "1";
  if (!Number.isSafeInteger(weekId)) redirect("/admin?odds_error=week");
  const { supabase } = await requireCommissioner();
  const { error } = await supabase.rpc("set_week_lines_frozen", {
    target_week_id: weekId,
    should_freeze: freeze,
  });
  if (error) redirect("/admin?odds_error=freeze");
  revalidatePath("/", "layout");
  redirect(`/admin?odds_${freeze ? "frozen" : "unfrozen"}=1`);
}
