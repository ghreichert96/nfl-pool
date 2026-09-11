import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { deriveGameResult, type Game } from "@/features/picks/model";
import type { Picks } from "@/features/picks/model";
import { PicksExperience } from "@/features/picks/picks-experience";
import { picksSchema } from "@/features/picks/submission";
import { createClient } from "@/lib/supabase/server";

import { saveWeeklyComment, submitWeeklyPicks } from "./actions";

export const dynamic = "force-dynamic";

function gameBadge(gameType: string, kickoffAt: string) {
  const named: Record<string, string> = {
    international: "INTL",
    special: "SPE",
    holiday: "HOL",
    tnf: "TNF",
    snf: "SNF",
    mnf: "MNF",
  };
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(new Date(kickoffAt));
  if (["Wed", "Fri", "Sat"].includes(weekday)) return "SPE";
  if (named[gameType]) return named[gameType];

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(kickoffAt)),
  );
  return hour < 16 ? "1 PM" : "4 PM";
}

function EmptyState({ commissioner = false }: { commissioner?: boolean }) {
  return (
    <main className="pick-shell gunmetal mx-auto grid min-h-screen max-w-2xl place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-sm rounded-xl border p-5 text-center shadow-xl">
        <h1 className="text-xl font-black">
          {commissioner ? "Your entry is not enrolled" : "No pool entry yet"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {commissioner
            ? "Commissioner tools are ready. Add your entrant record before testing picks."
            : "Use the invitation sent by the commissioner to join the 2026 pool."}
        </p>
        <Link
          href={commissioner ? "/admin" : "/account"}
          className="control-raised mt-5 grid min-h-11 place-items-center rounded-lg border text-sm font-black"
        >
          {commissioner ? "OPEN COMMISSIONER" : "OPEN ACCOUNT"}
        </Link>
      </section>
    </main>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: entry }, { data: commissioner }] = await Promise.all([
    supabase
      .from("pool_entries")
      .select("id, entry_code, season_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pool_memberships")
      .select("pool_id")
      .eq("user_id", userId)
      .eq("role", "commissioner")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!entry) return <EmptyState commissioner={Boolean(commissioner)} />;

  const { data: availableWeeks } = await supabase
    .from("pool_weeks")
    .select("id, week_number, label, lines_frozen_at")
    .eq("season_id", entry.season_id)
    .not("published_at", "is", null)
    .order("week_number");
  const requestedWeek = Number((await searchParams).week);
  const week =
    (availableWeeks ?? []).find((item) => item.week_number === requestedWeek) ??
    availableWeeks?.at(-1) ??
    null;
  if (!week) return <EmptyState commissioner={Boolean(commissioner)} />;

  const [
    { data: gameRows },
    { data: teams },
    { data: draft },
    { data: comment },
    { data: latestSubmission },
  ] = await Promise.all([
    supabase
      .from("games")
      .select(
        "id, away_team, home_team, kickoff_at, line_lock_at, venue, game_type, status, away_score, home_score, status_detail, live_status_updated_at, pool_lines(away_spread, total)",
      )
      .eq("week_id", week.id)
      .order("kickoff_at"),
    supabase.from("teams").select("abbreviation, name, logo_url"),
    supabase
      .from("weekly_drafts")
      .select("payload")
      .eq("entry_id", entry.id)
      .eq("week_id", week.id)
      .maybeSingle(),
    supabase
      .from("weekly_comments")
      .select("body")
      .eq("entry_id", entry.id)
      .eq("week_id", week.id)
      .maybeSingle(),
    supabase
      .from("weekly_submissions")
      .select("id, revision")
      .eq("entry_id", entry.id)
      .eq("week_id", week.id)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: submittedRows } = latestSubmission
    ? await supabase
        .from("picks")
        .select("game_id, kind, team, total_direction, is_best_bet")
        .eq("submission_id", latestSubmission.id)
    : { data: [] };
  const { data: priorWeeks } = await supabase
    .from("pool_weeks")
    .select("id")
    .eq("season_id", entry.season_id)
    .lt("week_number", week.week_number);
  const priorWeekIds = (priorWeeks ?? []).map((item) => item.id);
  const { data: priorSubmissions } = priorWeekIds.length
    ? await supabase
        .from("weekly_submissions")
        .select("id, week_id, revision")
        .eq("entry_id", entry.id)
        .in("week_id", priorWeekIds)
        .order("revision", { ascending: false })
    : { data: [] };
  const latestPrior = new Map<number, number>();
  for (const submission of priorSubmissions ?? [])
    if (!latestPrior.has(submission.week_id))
      latestPrior.set(submission.week_id, submission.id);
  const { data: priorSdRows } = latestPrior.size
    ? await supabase
        .from("picks")
        .select("team")
        .in("submission_id", [...latestPrior.values()])
        .eq("kind", "sudden_death")
    : { data: [] };

  const teamNames = new Map(
    (teams ?? []).map((team) => [team.abbreviation, team.name]),
  );
  const teamLogos = new Map(
    (teams ?? []).map((team) => [team.abbreviation, team.logo_url]),
  );
  // Request-time status is intentionally dynamic for kickoff locking.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const games: Game[] = (gameRows ?? []).flatMap((row) => {
    const line = Array.isArray(row.pool_lines)
      ? row.pool_lines[0]
      : row.pool_lines;
    if (!line) return [];

    const kickoff = new Date(row.kickoff_at);
    const status: Game["status"] =
      row.status === "final"
        ? "final"
        : kickoff.getTime() <= now
          ? "live"
          : "upcoming";

    const mappedGame: Game = {
      id: String(row.id),
      away: {
        abbreviation: row.away_team,
        name: teamNames.get(row.away_team) ?? row.away_team,
        logoUrl: teamLogos.get(row.away_team),
      },
      home: {
        abbreviation: row.home_team,
        name: teamNames.get(row.home_team) ?? row.home_team,
        logoUrl: teamLogos.get(row.home_team),
      },
      awaySpread: Number(line.away_spread),
      total: Number(line.total),
      badge: gameBadge(row.game_type, row.kickoff_at),
      kickoff: new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(kickoff),
      location: row.venue ?? "",
      status,
      lineFrozen:
        new Date(row.line_lock_at).getTime() <= now ||
        Boolean(week.lines_frozen_at),
      ...(row.away_score !== null && row.home_score !== null
        ? {
            score: {
              away: row.away_score,
              home: row.home_score,
              detail: row.status_detail ?? status.toUpperCase(),
            },
          }
        : {}),
    };
    if (status === "final") mappedGame.result = deriveGameResult(mappedGame);
    return [mappedGame];
  });
  const parsedDraft = picksSchema.safeParse(draft?.payload);
  const hasLiveGames = games.some((game) => game.status === "live");
  const latestLiveUpdate = (gameRows ?? [])
    .flatMap((game) =>
      game.live_status_updated_at ? [game.live_status_updated_at] : [],
    )
    .sort()
    .at(-1);
  const scoreFreshness = hasLiveGames
    ? scoreFreshnessLabel(latestLiveUpdate, now)
    : undefined;
  const submittedPicks: Picks | undefined = latestSubmission
    ? {
        ats: (submittedRows ?? [])
          .filter((pick) => pick.kind === "ats")
          .map((pick) => ({ gameId: String(pick.game_id), team: pick.team! })),
        totals: (submittedRows ?? [])
          .filter((pick) => pick.kind === "total")
          .map((pick) => ({
            gameId: String(pick.game_id),
            direction: pick.total_direction as "over" | "under",
          })),
        bestBet: (() => {
          const pick = (submittedRows ?? []).find(
            (item) => item.kind === "ats" && item.is_best_bet,
          );
          return pick
            ? { gameId: String(pick.game_id), team: pick.team! }
            : null;
        })(),
        suddenDeath: (() => {
          const pick = (submittedRows ?? []).find(
            (item) => item.kind === "sudden_death",
          );
          return pick
            ? { gameId: String(pick.game_id), team: pick.team! }
            : null;
        })(),
        underdog: (() => {
          const pick = (submittedRows ?? []).find(
            (item) => item.kind === "underdog",
          );
          return pick
            ? { gameId: String(pick.game_id), team: pick.team! }
            : null;
        })(),
      }
    : undefined;

  return (
    <PageShell
      entryCode={entry.entry_code}
      isCommissioner={Boolean(commissioner)}
      compact
      refreshWhileLive={hasLiveGames}
    >
      <PicksExperience
        games={games}
        initialPicks={parsedDraft.success ? parsedDraft.data : submittedPicks}
        initialSubmittedPicks={submittedPicks}
        draftTarget={{ entryId: entry.id, weekId: week.id }}
        entryCode={entry.entry_code}
        weekNumber={week.week_number}
        submitAction={submitWeeklyPicks}
        commentAction={saveWeeklyComment}
        initialComment={comment?.body ?? ""}
        commentLocked={
          games.length > 0 && games.every((game) => game.status !== "upcoming")
        }
        usedSuddenDeathTeams={(priorSdRows ?? []).flatMap((pick) =>
          pick.team ? [pick.team] : [],
        )}
        weeks={(availableWeeks ?? []).map(({ week_number, label }) => ({
          week_number,
          label,
        }))}
        linesFrozen={
          Boolean(week.lines_frozen_at) ||
          (gameRows?.length
            ? gameRows.every(
                (game) => new Date(game.line_lock_at).getTime() <= now,
              )
            : false)
        }
        scoreFreshness={scoreFreshness}
      />
    </PageShell>
  );
}

function scoreFreshnessLabel(updatedAt: string | undefined, now: number) {
  if (!updatedAt) return { label: "Scores pending", stale: true };
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(updatedAt).getTime()) / 60_000),
  );
  return {
    label:
      minutes < 1
        ? "Now"
        : minutes < 60
          ? `${minutes}m`
          : `${Math.floor(minutes / 60)}h`,
    stale: minutes >= 20,
  };
}
