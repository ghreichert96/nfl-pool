import { PageShell } from "@/components/page-shell";
import { CompactPageHeader } from "@/components/compact-page-header";
import { requireCommissioner } from "@/lib/admin";
import { selectPoolWeek } from "@/lib/pool-weeks";
import { scoreFreshness, updatedLabel } from "@/lib/scores/freshness";
import { ScoresTable } from "./scores-table";

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
    ? await supabase
        .from("pool_weeks")
        .select("id,week_number,label,lines_freeze_at,lines_frozen_at")
        .eq("season_id", season.id)
        .order("week_number")
    : { data: [] };
  const week = selectPoolWeek(weeks ?? [], Number(params.week));
  const { data: games, error } = week
    ? await supabase
        .from("games")
        .select(
          "id,away_team,home_team,away_score,home_score,status,game_type,kickoff_at,live_status_updated_at,updated_at,game_results(source)",
        )
        .eq("week_id", week.id)
        .order("kickoff_at")
    : { data: [], error: null };
  if (error) throw error;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const freshness = scoreFreshness(games ?? [], now) ?? {
    label: updatedLabel(
      (games ?? [])
        .map((g) => g.live_status_updated_at)
        .filter(Boolean)
        .sort()
        .at(-1),
      now,
    ),
    stale: false,
  };
  const rows = (games ?? []).map((g) => ({
    game_id: g.id,
    away: g.away_team,
    home: g.home_team,
    away_score: g.away_score,
    home_score: g.home_score,
    status: g.status,
    game_type: g.game_type,
    updated_at: g.updated_at,
    source:
      (Array.isArray(g.game_results) ? g.game_results[0] : g.game_results)
        ?.source ?? null,
  }));
  return (
    <PageShell
      isCommissioner
      compact
      refreshWhileLive={Boolean(scoreFreshness(games ?? [], now))}
    >
      <CompactPageHeader title="Scores" />
      {params.result_error && (
        <p role="alert" className="text-xs text-red-400">
          Could not update score control.
        </p>
      )}
      {params.result_provider && (
        <p role="status" className="text-xs">
          Returned to ESPN.
        </p>
      )}
      {week ? (
        <ScoresTable
          key={week.id}
          weekId={week.id}
          weekNumber={week.week_number}
          weeks={weeks ?? []}
          rows={rows}
          freshness={freshness}
        />
      ) : (
        <p className="text-xs">No games yet.</p>
      )}
    </PageShell>
  );
}
