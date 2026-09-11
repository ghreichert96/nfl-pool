import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading, PageShell } from "@/components/page-shell";
import { SubmissionRevisionLog } from "@/components/submission-revision-log";
import { loadCompetition } from "@/features/competition/data";
import { pickOutcome } from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ weekNumber: string }>;
}) {
  const { supabase, entry, membership, isCommissioner } =
    await getPoolContext();
  if (!entry) notFound();
  const number = Number((await params).weekNumber);
  const data = await loadCompetition(supabase, entry.season_id, number, {
    includePayouts: false,
    includeTeams: false,
    onlyWeekNumber: number,
  });
  const week = data.weeks.find((item) => item.week_number === number);
  if (!week) notFound();
  const gameMap = new Map(data.games.map((game) => [game.id, game]));
  const picks = data.picks.filter(
    (pick) =>
      pick.entryId === entry.id && gameMap.get(pick.gameId)?.weekId === week.id,
  );
  const revisions = data.submissions
    .filter((item) => item.entry_id === entry.id && item.week_id === week.id)
    .sort((a, b) => b.revision - a.revision);
  const revisionIds = revisions.map((revision) => revision.id);
  const { data: revisionPicks } = revisionIds.length
    ? await supabase
        .from("picks")
        .select(
          "submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", revisionIds)
    : { data: [] };
  const { data: overrideEvents } =
    membership && revisionIds.length
      ? await createAdminClient()
          .from("commissioner_audit_events")
          .select("entity_id")
          .eq("pool_id", membership.pool_id)
          .eq("entity_type", "weekly_submission")
          .in("entity_id", revisionIds.map(String))
      : { data: [] };
  const comment = data.comments.find(
    (item) => item.entry_id === entry.id && item.week_id === week.id,
  );
  return (
    <PageShell entryCode={entry.entry_code} isCommissioner={isCommissioner}>
      <PageHeading
        eyebrow="Submission history"
        title={week.label}
        description={`${entry.entry_code} · Read-only weekly record`}
        action={
          <Link
            href="/account"
            className="control-raised rounded-md border px-3 py-2 text-xs font-black"
          >
            BACK
          </Link>
        }
      />
      {comment && (
        <blockquote className="game-card mb-4 rounded-xl border p-4 text-sm italic text-slate-300">
          “{comment.body}”
        </blockquote>
      )}
      <section className="game-card overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[1fr_75px_75px] bg-slate-950 px-4 py-3 text-[9px] font-black uppercase text-slate-500">
          <span>Selection</span>
          <span>Line</span>
          <span>Result</span>
        </div>
        {picks.length ? (
          picks.map((pick) => {
            const game = gameMap.get(pick.gameId)!;
            const outcome = pickOutcome(game, pick);
            return (
              <div
                key={`${pick.gameId}:${pick.kind}`}
                className="grid grid-cols-[1fr_75px_75px] items-center border-t border-slate-800 px-4 py-3 text-xs"
              >
                <div>
                  <strong>
                    {pick.kind === "total"
                      ? `${game.away} @ ${game.home} · ${pick.totalDirection?.toUpperCase()}`
                      : pick.team}
                  </strong>
                  <small className="ml-2 uppercase text-slate-500">
                    {pick.isBestBet ? "Best Bet" : pick.kind.replace("_", " ")}
                  </small>
                </div>
                <span>
                  {pick.kind === "total"
                    ? game.total
                    : pick.team === game.away
                      ? game.awaySpread
                      : -game.awaySpread}
                </span>
                <strong
                  className={
                    outcome === "win"
                      ? "text-emerald-400"
                      : outcome === "loss"
                        ? "text-red-400"
                        : "text-slate-400"
                  }
                >
                  {outcome.toUpperCase()}
                </strong>
              </div>
            );
          })
        ) : (
          <p className="p-5 text-sm text-slate-500">No picks submitted.</p>
        )}
      </section>
      <section className="game-card mt-4 rounded-xl border p-4">
        <h2 className="text-sm font-black">Revision timeline</h2>
        <div className="mt-2">
          <SubmissionRevisionLog
            revisions={revisions}
            picks={revisionPicks ?? []}
            games={data.games
              .filter((game) => game.weekId === week.id)
              .map((game) => ({
                id: game.id,
                away_team: game.away,
                home_team: game.home,
              }))}
            commissionerSubmissionIds={(overrideEvents ?? []).map((event) =>
              Number(event.entity_id),
            )}
          />
        </div>
      </section>
    </PageShell>
  );
}
