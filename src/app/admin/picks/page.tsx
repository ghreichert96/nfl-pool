import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { requireCommissioner } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPicksPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, year")
    .eq("pool_id", poolId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const [{ data: entries }, { data: weeks }] = season
    ? await Promise.all([
        supabase
          .from("pool_entries")
          .select("id, entry_code")
          .eq("season_id", season.id)
          .order("entry_code"),
        supabase
          .from("pool_weeks")
          .select("id, week_number, label")
          .eq("season_id", season.id)
          .order("week_number"),
      ])
    : [{ data: [] }, { data: [] }];
  const requestedWeek = Number((await searchParams).week);
  const currentWeek =
    (weeks ?? []).find((week) => week.week_number === requestedWeek) ??
    weeks?.[0];
  const { data: latestSubmissions } = currentWeek
    ? await supabase
        .from("weekly_submissions")
        .select("entry_id, revision, submitted_at")
        .eq("week_id", currentWeek.id)
        .order("revision", { ascending: false })
    : { data: [] };
  const latestByEntry = new Map<
    number,
    { revision: number; submitted_at: string }
  >();
  for (const submission of latestSubmissions ?? [])
    if (!latestByEntry.has(submission.entry_id))
      latestByEntry.set(submission.entry_id, submission);
  return (
    <PageShell isCommissioner>
      <CompactPageHeader
        className="-mx-3 -mt-5 sm:-mx-5 sm:-mt-8"
        title="Entrant picks"
        action={
          currentWeek ? (
            <WeekSelector
              weeks={weeks ?? []}
              selected={currentWeek.week_number}
            />
          ) : null
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(entries ?? []).map((entry) => {
          const latest = latestByEntry.get(entry.id);
          return (
            <div key={entry.id} className="game-card rounded-xl border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <strong className="text-lg">{entry.entry_code}</strong>
                <small className="text-slate-400">
                  {latest ? `Rev ${latest.revision}` : "No submission"}
                </small>
              </div>
              {latest && (
                <time className="mt-1 block text-[10px] text-slate-500">
                  {new Date(latest.submitted_at).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}
                </time>
              )}
              {currentWeek ? (
                <Link
                  href={`/admin/picks/${entry.id}?week=${currentWeek.id}`}
                  className="control-raised mt-3 grid min-h-10 place-items-center rounded-md border text-xs font-black"
                >
                  EDIT {currentWeek.label.toUpperCase()}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No week available</p>
              )}
            </div>
          );
        })}
      </section>
    </PageShell>
  );
}
