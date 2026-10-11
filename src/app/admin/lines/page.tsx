import { updatedLabel } from "@/lib/scores/freshness";
import { PageShell } from "@/components/page-shell";
import { CompactPageHeader } from "@/components/compact-page-header";
import { requireCommissioner } from "@/lib/admin";
import { selectPoolWeek } from "@/lib/pool-weeks";
import { LinesTable } from "./lines-table";
import { initializeUpcomingLines } from "./actions";
export const dynamic = "force-dynamic";
export default async function LinesPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    weekId?: string;
    error?: string;
    refreshed?: string;
    frozen?: string;
    unfrozen?: string;
  }>;
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
  const week =
    (params.weekId
      ? weeks?.find((w) => w.id === Number(params.weekId))
      : undefined) ?? selectPoolWeek(weeks ?? [], Number(params.week));
  const result = week
    ? await supabase
        .from("games")
        .select(
          "id,away_team,home_team,status,game_type,odds_refresh_error,pool_lines(*)",
        )
        .eq("week_id", week.id)
        .order("kickoff_at")
    : { data: [], error: null };
  if (result.error) throw result.error;
  const rows = (result.data ?? []).flatMap((g) => {
    const l = Array.isArray(g.pool_lines) ? g.pool_lines[0] : g.pool_lines;
    return [
      {
        game_id: g.id,
        away: g.away_team,
        home: g.home_team,
        status: g.status,
        odds_refresh_error: g.odds_refresh_error,
        game_type: g.game_type,
        updated_at: l?.updated_at ?? null,
        away_spread: l ? Number(l.away_spread) : NaN,
        total: l ? Number(l.total) : NaN,
        spread_override: l?.spread_override ?? true,
        total_override: l?.total_override ?? true,
        spread_book: l?.spread_book ?? null,
        total_book: l?.total_book ?? null,
        spread_observed_at: l?.spread_observed_at ?? null,
        total_observed_at: l?.total_observed_at ?? null,
      },
    ];
  });
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <PageShell isCommissioner compact>
      <CompactPageHeader title="Lines" />
      {params.error && (
        <p role="alert">Operation failed. Review Activity Log for details.</p>
      )}
      {params.refreshed && (
        <p role="status">
          Refresh completed. Review Activity Log for skipped or unavailable
          lines.
        </p>
      )}
      {week ? (
        <>
          <LinesTable
            key={`${week.id}:${rows.map((r) => r.updated_at).join()}`}
            weekId={week.id}
            weekNumber={week.week_number}
            weeks={weeks ?? []}
            frozen={Boolean(week.lines_frozen_at)}
            rows={rows}
            freshness={{
              label: updatedLabel(
                rows
                  .map((r) => r.updated_at)
                  .filter(Boolean)
                  .sort()
                  .at(-1),
                now,
              ),
              stale: false,
            }}
          />
          {rows.some((row) => row.updated_at === null) && (
            <p role="alert" className="text-amber-400">
              Some games have no saved lines. Enter the missing values and save,
              or refresh from the provider.
            </p>
          )}
        </>
      ) : (
        <form action={initializeUpcomingLines}>
          <button className="admin-button">Initialize upcoming week</button>
        </form>
      )}
    </PageShell>
  );
}
