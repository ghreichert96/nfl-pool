import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPicksPage() {
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
  const currentWeek = weeks?.[0];
  return (
    <PageShell isCommissioner>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(entries ?? []).map((entry) => (
          <div key={entry.id} className="game-card rounded-xl border p-4">
            <strong className="text-xl">{entry.entry_code}</strong>
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
        ))}
      </section>
    </PageShell>
  );
}
