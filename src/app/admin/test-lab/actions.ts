"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TEST_LAB_STAGES, testLabEnabled } from "@/lib/test-lab";

const stageSchema = z.enum(
  TEST_LAB_STAGES.map(([value]) => value) as [string, ...string[]],
);
const codes = [
  "AAB",
  "AAC",
  "AAD",
  "AAE",
  "AAF",
  "AAG",
  "AAH",
  "AAI",
  "AAJ",
  "AAK",
  "AAL",
  "AAM",
];
const matchups = [
  ["DAL", "PHI", 3.5, 47.5],
  ["KC", "LAC", -2.5, 48.5],
  ["TB", "ATL", -1.5, 44.5],
  ["CIN", "CLE", -4.5, 45.5],
  ["MIA", "IND", 2.5, 46.5],
  ["SF", "SEA", -3.5, 43.5],
  ["DET", "GB", -1.5, 49.5],
  ["BAL", "BUF", 1.5, 51.5],
] as const;

async function commissioner() {
  if (!testLabEnabled()) throw new Error("Test lab is disabled");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: membership } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", userId)
    .eq("role", "commissioner")
    .maybeSingle();
  if (!membership) redirect("/");
  return { admin: createAdminClient(), poolId: membership.pool_id, userId };
}

async function removeFixtures(
  admin: ReturnType<typeof createAdminClient>,
  poolId: number,
) {
  const { data: state } = await admin
    .from("test_lab_states")
    .select("season_id, week_id, dummy_user_ids")
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!state) return;
  await admin
    .from("pool_entries")
    .delete()
    .eq("season_id", state.season_id)
    .eq("is_test", true);
  await admin.from("pool_weeks").delete().eq("id", state.week_id);
  for (const userId of state.dummy_user_ids ?? [])
    await admin.auth.admin.deleteUser(userId);
}

export async function resetTestLab() {
  const { admin, poolId, userId } = await commissioner();
  await removeFixtures(admin, poolId);
  const { data: season } = await admin
    .from("seasons")
    .select("id")
    .eq("pool_id", poolId)
    .eq("year", 2026)
    .single();
  let { data: ownEntry } = await admin
    .from("pool_entries")
    .select("id")
    .eq("season_id", season!.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!ownEntry) {
    const inserted = await admin
      .from("pool_entries")
      .insert({
        season_id: season!.id,
        user_id: userId,
        entry_code: "YOU",
        is_test: true,
      })
      .select("id")
      .single();
    ownEntry = inserted.data;
  }
  if (!ownEntry) throw new Error("Could not create commissioner test entry");

  const dummyIds: string[] = [];
  const entryIds = [ownEntry.id];
  for (let index = 0; index < codes.length; index += 1) {
    const email = `hppp-lab-${String(index + 1).padStart(2, "0")}@example.test`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { test_fixture: true },
    });
    if (error || !created.user) throw new Error(`Could not create ${email}`);
    dummyIds.push(created.user.id);
    await admin
      .from("profiles")
      .upsert({ id: created.user.id, display_name: `Test ${codes[index]}` });
    await admin
      .from("pool_memberships")
      .upsert({ pool_id: poolId, user_id: created.user.id, role: "member" });
    const { data: fixtureEntry } = await admin
      .from("pool_entries")
      .insert({
        season_id: season!.id,
        user_id: created.user.id,
        entry_code: codes[index],
        is_test: true,
      })
      .select("id")
      .single();
    if (fixtureEntry) entryIds.push(fixtureEntry.id);
  }

  const { data: week } = await admin
    .from("pool_weeks")
    .insert({
      season_id: season!.id,
      week_number: 22,
      label: "Test Lab",
      lines_freeze_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (!week) throw new Error("Could not create test week");
  const gameRows = matchups.map(([away, home], index) => ({
    week_id: week.id,
    provider_event_id: `hppp-lab-${index + 1}`,
    away_team: away,
    home_team: home,
    kickoff_at: new Date(Date.now() + (index + 1) * 3_600_000).toISOString(),
    venue: "Test Stadium",
    game_type: index === 0 ? "tnf" : index === 7 ? "mnf" : "sunday",
  }));
  const { data: games } = await admin
    .from("games")
    .insert(gameRows)
    .select("id, away_team, home_team")
    .order("id");
  if (!games?.length) throw new Error("Could not create test games");
  await admin.from("pool_lines").insert(
    games.map((game, index) => ({
      game_id: game.id,
      away_spread: matchups[index][2],
      total: matchups[index][3],
      source: "commissioner",
      override_reason: "Test lab fixture",
      frozen_at: new Date().toISOString(),
    })),
  );

  for (let entryIndex = 0; entryIndex < entryIds.length; entryIndex += 1) {
    const entryId = entryIds[entryIndex];
    const { data: submission } = await admin
      .from("weekly_submissions")
      .insert({ entry_id: entryId, week_id: week.id, revision: 1 })
      .select("id")
      .single();
    if (!submission) continue;
    const atsGames = games.slice(0, 6);
    const ats = atsGames.map((game, index) => ({
      submission_id: submission.id,
      game_id: game.id,
      kind: "ats",
      team: (entryIndex + index) % 3 === 0 ? game.home_team : game.away_team,
      total_direction: null,
      is_best_bet: index === 0,
    }));
    const totals = games.slice(2, 5).map((game, index) => ({
      submission_id: submission.id,
      game_id: game.id,
      kind: "total",
      team: null,
      total_direction: (entryIndex + index) % 2 ? "under" : "over",
      is_best_bet: false,
    }));
    const sdGame = games[(entryIndex + 1) % games.length];
    const udGame = games[(entryIndex + 3) % games.length];
    await admin.from("picks").insert([
      ...ats,
      ...totals,
      {
        submission_id: submission.id,
        game_id: sdGame.id,
        kind: "sudden_death",
        team: sdGame.home_team,
        total_direction: null,
        is_best_bet: false,
      },
      {
        submission_id: submission.id,
        game_id: udGame.id,
        kind: "underdog",
        team:
          matchups[(entryIndex + 3) % games.length][2] > 0
            ? udGame.away_team
            : udGame.home_team,
        total_direction: null,
        is_best_bet: false,
      },
    ]);
    await admin.from("weekly_comments").insert({
      entry_id: entryId,
      week_id: week.id,
      body: [
        "Feeling dangerous",
        "Lock of the week",
        "No guts, no glory",
        "Trust the process",
      ][entryIndex % 4],
    });
  }
  await admin.from("test_lab_states").insert({
    pool_id: poolId,
    season_id: season!.id,
    week_id: week.id,
    stage: "pre_freeze",
    dummy_user_ids: dummyIds,
    updated_by: userId,
  });
  await applyStage(admin, week.id, "pre_freeze");
  revalidatePath("/", "layout");
  redirect("/admin/test-lab?reset=1");
}

export async function setTestLabStage(formData: FormData) {
  const parsed = stageSchema.safeParse(formData.get("stage"));
  if (!parsed.success) redirect("/admin/test-lab?error=stage");
  const { admin, poolId, userId } = await commissioner();
  const { data: state } = await admin
    .from("test_lab_states")
    .select("week_id")
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!state) redirect("/admin/test-lab?error=missing");
  await applyStage(admin, state.week_id, parsed.data);
  await admin
    .from("test_lab_states")
    .update({ stage: parsed.data, updated_by: userId })
    .eq("pool_id", poolId);
  revalidatePath("/", "layout");
  redirect(`/admin/test-lab?stage=${parsed.data}`);
}

export async function deleteTestLab() {
  const { admin, poolId } = await commissioner();
  await removeFixtures(admin, poolId);
  revalidatePath("/", "layout");
  redirect("/admin/test-lab?deleted=1");
}

async function applyStage(
  admin: ReturnType<typeof createAdminClient>,
  weekId: number,
  stage: string,
) {
  const { data: games } = await admin
    .from("games")
    .select("id, away_team, home_team")
    .eq("week_id", weekId)
    .order("id");
  if (!games?.length) return;
  const progress: Record<string, { final: number; live: number }> = {
    pre_freeze: { final: 0, live: 0 },
    lines_frozen: { final: 0, live: 0 },
    thursday_live: { final: 0, live: 1 },
    thursday_final: { final: 1, live: 0 },
    sunday_early: { final: 1, live: 4 },
    sunday_late: { final: 5, live: 2 },
    sunday_complete: { final: 7, live: 1 },
    week_final: { final: 8, live: 0 },
  };
  const state = progress[stage];
  const now = Date.now();
  await admin
    .from("game_results")
    .delete()
    .in(
      "game_id",
      games.map((game) => game.id),
    );
  for (let index = 0; index < games.length; index += 1) {
    const isFinal = index < state.final;
    const isLive = index >= state.final && index < state.final + state.live;
    const awayScore = 17 + ((index * 3) % 14);
    const homeScore = 20 + ((index * 5) % 13);
    await admin
      .from("games")
      .update({
        kickoff_at: new Date(
          now +
            (isFinal
              ? -7_200_000
              : isLive
                ? -900_000
                : (index + 1) * 3_600_000),
        ).toISOString(),
        status: isFinal ? "final" : isLive ? "live" : "scheduled",
        away_score: isFinal || isLive ? awayScore : null,
        home_score: isFinal || isLive ? homeScore : null,
        status_detail: isFinal ? "Final" : isLive ? "Q3 4:12" : null,
      })
      .eq("id", games[index].id);
  }
  await admin
    .from("pool_weeks")
    .update({
      lines_frozen_at: stage === "pre_freeze" ? null : new Date().toISOString(),
      lines_frozen_by: null,
    })
    .eq("id", weekId);
}
