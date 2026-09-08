"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  entryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3,4}$/),
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

  return { supabase, poolId: commissioner.pool_id };
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
    entryCode: formData.get("entry_code"),
  });

  if (!parsed.success) redirect("/admin?error=invalid");

  const { poolId } = await requireCommissioner();

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

  const { data: existingCode } = await admin
    .from("pool_entries")
    .select("id")
    .eq("season_id", season.id)
    .eq("entry_code", parsed.data.entryCode)
    .maybeSingle();
  if (existingCode) redirect("/admin?error=duplicate");

  const requestOrigin = (await headers()).get("origin");
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${getAppOrigin(requestOrigin)}/auth/confirm?next=/account`,
      data: { entry_code: parsed.data.entryCode },
    });

  if (inviteError || !invited.user) redirect("/admin?error=invite");

  const { error: provisionError } = await admin.rpc("provision_invited_entry", {
    target_user_id: invited.user.id,
    target_pool_id: poolId,
    target_season_id: season.id,
    target_entry_code: parsed.data.entryCode,
  });

  if (provisionError) redirect("/admin?error=provision");
  redirect("/admin?sent=1");
}
