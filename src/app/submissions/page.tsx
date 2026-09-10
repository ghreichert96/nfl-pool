import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { getPoolContext } from "@/lib/pool-context";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase, entry, isCommissioner } = await getPoolContext();
  const { data: weeks } = entry
    ? await supabase
        .from("pool_weeks")
        .select("id, week_number, label")
        .eq("season_id", entry.season_id)
        .not("published_at", "is", null)
        .order("week_number")
    : { data: [] };
  const requestedWeek = Number((await searchParams).week);
  const selectedWeek =
    (weeks ?? []).find((week) => week.week_number === requestedWeek) ??
    weeks?.at(-1) ??
    null;
  const [{ data: revisions }, { data: comment }] =
    entry && selectedWeek
      ? await Promise.all([
          supabase
            .from("weekly_submissions")
            .select("id, revision, submitted_at")
            .eq("entry_id", entry.id)
            .eq("week_id", selectedWeek.id)
            .order("revision", { ascending: false }),
          supabase
            .from("weekly_comments")
            .select("body, updated_at")
            .eq("entry_id", entry.id)
            .eq("week_id", selectedWeek.id)
            .maybeSingle(),
        ])
      : [{ data: [] }, { data: null }];
  const latestSubmission = revisions?.[0];
  const { count: pickCount } = latestSubmission
    ? await supabase
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("submission_id", latestSubmission.id)
    : { count: 0 };

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
    >
      <div className="pb-3 sm:pb-5">
        <CompactPageHeader
          sticky
          title="Submission Log"
          className="mb-3"
          action={
            selectedWeek ? (
              <WeekSelector
                weeks={weeks ?? []}
                selected={selectedWeek.week_number}
              />
            ) : undefined
          }
        />
        <section className="game-card overflow-hidden rounded-xl border">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="font-black">{selectedWeek?.label ?? "No week"}</h2>
            <p className="text-xs text-slate-400">
              {latestSubmission
                ? `${pickCount ?? 0} picks · ${revisions?.length ?? 0} revision${revisions?.length === 1 ? "" : "s"} · latest ${new Date(latestSubmission.submitted_at).toLocaleString("en-US")}`
                : "No submission"}
            </p>
          </div>
          {comment?.body && (
            <p className="border-b border-slate-800 px-4 py-3 text-sm">
              “{comment.body}”
            </p>
          )}
          {selectedWeek && (
            <Link
              href={`/account/week/${selectedWeek.week_number}`}
              className="flex min-h-12 items-center justify-between px-4 text-xs font-black uppercase"
            >
              Full weekly record <span aria-hidden="true">›</span>
            </Link>
          )}
        </section>
      </div>
    </PageShell>
  );
}
