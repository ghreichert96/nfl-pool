import { PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";
import {
  recordGameResult,
  reconcileScores,
  validateScores,
  refreshLiveScores,
  releaseGameResultToProvider,
} from "../actions";
export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("pool_id", poolId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: weeks } = season
    ? await supabase.from("pool_weeks").select("id").eq("season_id", season.id)
    : { data: [] };
  const weekIds = (weeks ?? []).map((w) => w.id);
  const [
    { data: games, error: gameError },
    { data: scoreRuns },
    { data: liveRuns },
  ] = weekIds.length
    ? await Promise.all([
        supabase
          .from("games")
          .select(
            "id, week_id, away_team, home_team, away_score, home_score, status, status_detail, live_status_updated_at, final_validation_state, final_validation_attempts, final_validation_error, game_results(source)",
          )
          .in("week_id", weekIds)
          .order("kickoff_at", { ascending: false }),
        supabase
          .from("score_ingestion_runs")
          .select(
            "id, mode, status, events_received, games_updated, games_finalized, quota_remaining, skip_reason, error_message, requested_at",
          )
          .in("week_id", weekIds)
          .order("requested_at", { ascending: false })
          .limit(5),
        supabase
          .from("live_status_ingestion_runs")
          .select(
            "id, status, events_received, games_updated, error_message, requested_at",
          )
          .in("week_id", weekIds)
          .order("requested_at", { ascending: false })
          .limit(5),
      ])
    : [{ data: [], error: null }, { data: [] }, { data: [] }];
  if (gameError) throw gameError;
  return (
    <PageShell
      isCommissioner
      refreshWhileLive={Boolean(games?.some((g) => g.status === "live"))}
    >
      <section className="mt-3">
        <p className="text-xs font-black tracking-[0.18em] text-slate-300">
          RESULTS
        </p>
        <h2 className="mt-2 text-xl font-black">Record final scores</h2>
        <p className="mt-2 text-sm text-slate-400">
          Saving a correction replaces the game’s score events and refreshes
          standings.
        </p>
        {params.result_saved && (
          <p className="mt-3 rounded bg-emerald-950 p-2 text-xs text-emerald-300">
            Result saved and rescored.
          </p>
        )}
        {params.result_error && (
          <p className="mt-3 rounded bg-red-950 p-2 text-xs text-red-300">
            Result could not be saved.
          </p>
        )}
        {params.result_provider && (
          <p className="mt-3 rounded bg-cyan-950 p-2 text-xs text-cyan-200">
            Result returned to provider control.
          </p>
        )}
        {params.score_run && (
          <p className="mt-3 rounded bg-slate-900 p-2 text-xs">
            {params.score_status === "skipped"
              ? "No eligible games to update."
              : params.score_status === "partial"
                ? "Update completed with issues. Review the run details below."
                : "Score update completed."}
          </p>
        )}
        {params.score_reconciled && (
          <p className="mt-3 rounded bg-emerald-950 p-2 text-xs text-emerald-300">
            Final-score reconciliation completed.
          </p>
        )}
        {params.score_error && (
          <p className="mt-3 rounded bg-red-950 p-2 text-xs text-red-300">
            Final-score reconciliation failed.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={refreshLiveScores}>
            <button className="control-raised min-h-9 rounded border px-3 text-[10px] font-black">
              REFRESH ESPN
            </button>
          </form>
          <form action={validateScores}>
            <button className="control-raised min-h-9 rounded border px-3 text-[10px] font-black">
              VALIDATE FINALS
            </button>
          </form>
          <form action={reconcileScores}>
            <button className="control-raised min-h-9 rounded border px-3 text-[10px] font-black">
              RECONCILE FINALS
            </button>
          </form>
        </div>
        {(scoreRuns ?? []).length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Manual Odds API checks
            </h3>
            <ol className="mt-2 divide-y divide-slate-800">
              {(scoreRuns ?? []).map((run) => (
                <li key={run.id} className="py-2 text-[10px] text-slate-300">
                  <div className="flex justify-between gap-2">
                    <strong className="uppercase">
                      {run.mode} · {run.status}
                    </strong>
                    <span className="text-slate-500">
                      {run.quota_remaining == null
                        ? "Quota —"
                        : `${run.quota_remaining} left`}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    {run.events_received} events · {run.games_updated} updated ·{" "}
                    {run.games_finalized} final
                    {run.skip_reason ? ` · ${run.skip_reason}` : ""}
                  </p>
                  {run.error_message && (
                    <p className="mt-1 text-red-300">{run.error_message}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        {(liveRuns ?? []).length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              ESPN live status
            </h3>
            <ol className="mt-2 divide-y divide-slate-800">
              {(liveRuns ?? []).map((run) => (
                <li key={run.id} className="py-2 text-[10px] text-slate-300">
                  <div className="flex justify-between gap-2">
                    <strong className="uppercase">{run.status}</strong>
                    <time className="text-slate-500">
                      {new Date(run.requested_at).toLocaleTimeString("en-US", {
                        timeZone: "America/New_York",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="mt-1 text-slate-500">
                    {run.events_received} events · {run.games_updated} updated
                  </p>
                  {run.error_message && (
                    <p className="mt-1 text-red-300">{run.error_message}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-4 max-h-96 space-y-2 overflow-auto">
          {(games ?? []).map((game) => {
            const result = Array.isArray(game.game_results)
              ? game.game_results[0]
              : game.game_results;
            return (
              <div
                key={game.id}
                className="rounded-lg border border-slate-800 p-2"
              >
                {game.final_validation_state !== "none" && (
                  <p className="mb-2 text-[10px] font-black uppercase text-amber-300">
                    {game.status_detail ?? game.final_validation_state} ·{" "}
                    {game.final_validation_attempts} validation attempts
                    {game.final_validation_error
                      ? ` · ${game.final_validation_error}`
                      : ""}
                  </p>
                )}
                <form
                  action={recordGameResult}
                  className="grid grid-cols-[1fr_58px_12px_58px_64px] items-center gap-1"
                >
                  <input type="hidden" name="game_id" value={game.id} />
                  <label className="text-xs font-black">
                    {game.away_team} @ {game.home_team}
                    <small className="block font-normal text-slate-500">
                      {game.status}
                      {result?.source ? ` · ${result.source}` : ""}
                    </small>
                  </label>
                  <input
                    aria-label={`${game.away_team} score`}
                    name="away_score"
                    type="number"
                    min="0"
                    max="255"
                    defaultValue={game.away_score ?? ""}
                    required
                    className="control-raised min-h-9 rounded border px-1 text-center"
                  />
                  <span>–</span>
                  <input
                    aria-label={`${game.home_team} score`}
                    name="home_score"
                    type="number"
                    min="0"
                    max="255"
                    defaultValue={game.home_score ?? ""}
                    required
                    className="control-raised min-h-9 rounded border px-1 text-center"
                  />
                  <button className="control-pressed min-h-9 rounded border text-[9px] font-black">
                    FINAL
                  </button>
                </form>
                {result?.source === "commissioner" && (
                  <form
                    action={releaseGameResultToProvider}
                    className="mt-2 text-right"
                  >
                    <input type="hidden" name="game_id" value={game.id} />
                    <button className="text-[9px] font-black uppercase text-cyan-300 underline">
                      Return to provider control
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
