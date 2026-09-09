import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading, PageShell } from "@/components/page-shell";
import { loadCompetition } from "@/features/competition/data";
import { pickOutcome } from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ weekNumber: string }>;
}) {
  const { supabase, entry, isCommissioner } = await getPoolContext();
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
        <ol className="mt-3 space-y-2">
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className="flex justify-between border-t border-slate-800 pt-2 text-xs"
            >
              <span>Revision {revision.revision}</span>
              <time className="text-slate-500">
                {new Date(revision.submitted_at).toLocaleString("en-US")}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
