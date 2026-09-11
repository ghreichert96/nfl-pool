import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import type { Game, Picks } from "@/features/picks/model";
import { EMPTY_PICKS } from "@/features/picks/model";
import { PicksExperience } from "@/features/picks/picks-experience";
import { requireCommissioner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { submitCommissionerPicks } from "../actions";

export const dynamic = "force-dynamic";

type HistoryPick = {
  submission_id: number;
  game_id: number;
  kind: string;
  team: string | null;
  total_direction: string | null;
  is_best_bet: boolean;
};

function badge(gameType: string, kickoffAt: string) {
  const named: Record<string, string> = {
    international: "INTL",
    special: "SPE",
    holiday: "HOL",
    tnf: "TNF",
    snf: "SNF",
    mnf: "MNF",
  };
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

export default async function CommissionerPickSheet({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const entryId = Number((await params).entryId);
  const requestedWeek = Number((await searchParams).week);
  if (!Number.isSafeInteger(entryId)) notFound();
  const { poolId } = await requireCommissioner();
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("pool_entries")
    .select("id, entry_code, season_id, seasons!inner(pool_id)")
    .eq("id", entryId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!entry) notFound();
  const { data: weeks } = await admin
    .from("pool_weeks")
    .select("id, week_number, label")
    .eq("season_id", entry.season_id)
    .order("week_number");
  const week =
    (weeks ?? []).find((item) => item.id === requestedWeek) ?? weeks?.[0];
  if (!week) notFound();
  const [
    { data: rows },
    { data: teams },
    { data: latest },
    { data: submissionHistory },
  ] = await Promise.all([
    admin
      .from("games")
      .select(
        "id, away_team, home_team, kickoff_at, venue, game_type, status, away_score, home_score, status_detail, pool_lines(away_spread,total)",
      )
      .eq("week_id", week.id)
      .order("kickoff_at"),
    admin.from("teams").select("abbreviation, name, logo_url"),
    admin
      .from("weekly_submissions")
      .select("id, revision")
      .eq("entry_id", entry.id)
      .eq("week_id", week.id)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("weekly_submissions")
      .select("id, revision, submitted_at")
      .eq("entry_id", entry.id)
      .eq("week_id", week.id)
      .order("revision", { ascending: false }),
  ]);
  const { data: savedRows } = latest
    ? await admin
        .from("picks")
        .select("game_id, kind, team, total_direction, is_best_bet")
        .eq("submission_id", latest.id)
    : { data: [] };
  const historySubmissionIds = (submissionHistory ?? []).map(
    (submission) => submission.id,
  );
  const { data: historyPickRows } = historySubmissionIds.length
    ? await admin
        .from("picks")
        .select(
          "submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", historySubmissionIds)
    : { data: [] };
  const names = new Map(
    (teams ?? []).map((team) => [team.abbreviation, team.name]),
  );
  const logos = new Map(
    (teams ?? []).map((team) => [team.abbreviation, team.logo_url]),
  );
  const matchupByGame = new Map(
    (rows ?? []).map((game) => [
      game.id,
      `${game.away_team}/${game.home_team}`,
    ]),
  );
  const historyLabels = new Map<number, string[]>();
  for (const pick of (historyPickRows ?? []) as HistoryPick[]) {
    const matchup = matchupByGame.get(pick.game_id) ?? `Game ${pick.game_id}`;
    const label =
      pick.kind === "ats"
        ? `${pick.team} ATS${pick.is_best_bet ? " (BB)" : ""} · ${matchup}`
        : pick.kind === "total"
          ? `${matchup} · ${pick.total_direction === "over" ? "Over" : "Under"}`
          : pick.kind === "sudden_death"
            ? `${pick.team} · SD`
            : `${pick.team} · UD`;
    historyLabels.set(pick.submission_id, [
      ...(historyLabels.get(pick.submission_id) ?? []),
      label,
    ]);
  }
  const changesBySubmission = new Map<
    number,
    { added: string[]; removed: string[] }
  >();
  let previous = new Set<string>();
  for (const submission of [...(submissionHistory ?? [])].reverse()) {
    const current = new Set(historyLabels.get(submission.id) ?? []);
    changesBySubmission.set(submission.id, {
      added: [...current].filter((pick) => !previous.has(pick)).sort(),
      removed: [...previous].filter((pick) => !current.has(pick)).sort(),
    });
    previous = current;
  }
  // Request-time status is intentionally dynamic for per-game kickoff locks.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const games: Game[] = (rows ?? []).flatMap((row) => {
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
    return [
      {
        id: String(row.id),
        away: {
          abbreviation: row.away_team,
          name: names.get(row.away_team) ?? row.away_team,
          logoUrl: logos.get(row.away_team),
        },
        home: {
          abbreviation: row.home_team,
          name: names.get(row.home_team) ?? row.home_team,
          logoUrl: logos.get(row.home_team),
        },
        awaySpread: Number(line.away_spread),
        total: Number(line.total),
        badge: badge(row.game_type, row.kickoff_at),
        kickoff: new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(kickoff),
        location: row.venue ?? "",
        status,
        ...(row.away_score !== null && row.home_score !== null
          ? {
              score: {
                away: row.away_score,
                home: row.home_score,
                detail: row.status_detail ?? status.toUpperCase(),
              },
            }
          : {}),
      },
    ];
  });
  const initial: Picks = (savedRows ?? []).reduce<Picks>((picks, row) => {
    const gameId = String(row.game_id);
    if (row.kind === "ats" && row.team) {
      const pick = { gameId, team: row.team };
      picks.ats.push(pick);
      if (row.is_best_bet) picks.bestBet = pick;
    } else if (
      row.kind === "total" &&
      (row.total_direction === "over" || row.total_direction === "under")
    )
      picks.totals.push({ gameId, direction: row.total_direction });
    else if (row.kind === "sudden_death" && row.team)
      picks.suddenDeath = { gameId, team: row.team };
    else if (row.kind === "underdog" && row.team)
      picks.underdog = { gameId, team: row.team };
    return picks;
  }, structuredClone(EMPTY_PICKS));

  return (
    <PageShell entryCode={entry.entry_code} isCommissioner compact>
      <section className="game-card mx-auto mb-2 max-w-2xl rounded-lg border px-3 py-2 text-xs">
        <strong className="text-amber-300">Commissioner override</strong>
        <span className="ml-2 text-slate-300">
          All picks are editable, including locked and completed games. Every
          save creates an audited revision.
        </span>
        <details className="mt-2">
          <summary className="cursor-pointer font-black">
            Submission history ({submissionHistory?.length ?? 0})
          </summary>
          <ol className="mt-2 divide-y divide-slate-800">
            {(submissionHistory ?? []).map((submission) => {
              const changes = changesBySubmission.get(submission.id);
              return (
                <li key={submission.id} className="py-2">
                  <div className="flex justify-between gap-3">
                    <strong>Revision {submission.revision}</strong>
                    <time className="text-slate-400">
                      {new Date(submission.submitted_at).toLocaleString(
                        "en-US",
                        { timeZone: "America/New_York" },
                      )}
                    </time>
                  </div>
                  <div className="mt-1 grid gap-0.5 text-[10px]">
                    {(changes?.added ?? []).map((pick) => (
                      <span key={`added-${pick}`} className="text-emerald-300">
                        + {pick}
                      </span>
                    ))}
                    {(changes?.removed ?? []).map((pick) => (
                      <span key={`removed-${pick}`} className="text-red-300">
                        − {pick}
                      </span>
                    ))}
                    {!changes?.added.length && !changes?.removed.length && (
                      <span className="text-slate-500">No pick changes</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </details>
      </section>
      <PicksExperience
        games={games}
        initialPicks={initial}
        draftTarget={{ entryId: entry.id, weekId: week.id }}
        entryCode={entry.entry_code}
        weekNumber={week.week_number}
        submitAction={submitCommissionerPicks}
        allowLockedEdits
      />
    </PageShell>
  );
}
