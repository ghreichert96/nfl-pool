import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { SubmissionRevisionLog } from "@/components/submission-revision-log";
import { WeekSelector } from "@/components/week-selector";
import { getPoolContext } from "@/lib/pool-context";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase, entry, membership, isCommissioner } =
    await getPoolContext();
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
  const [{ data: revisions }, { data: comment }, { data: games }] =
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
          supabase
            .from("games")
            .select("id, away_team, home_team")
            .eq("week_id", selectedWeek.id),
        ])
      : [{ data: [] }, { data: null }, { data: [] }];
  const revisionIds = (revisions ?? []).map((revision) => revision.id);
  const { data: revisionPicks } = revisionIds.length
    ? await supabase
        .from("picks")
        .select(
          "submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", revisionIds)
    : { data: [] };
  const { data: overrideEvents } =
    entry && membership && revisionIds.length
      ? await createAdminClient()
          .from("commissioner_audit_events")
          .select("entity_id")
          .eq("pool_id", membership.pool_id)
          .eq("entity_type", "weekly_submission")
          .in("entity_id", revisionIds.map(String))
      : { data: [] };
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
          {!!revisions?.length && (
            <div className="border-b border-slate-800 px-3 py-2">
              <SubmissionRevisionLog
                revisions={revisions}
                picks={revisionPicks ?? []}
                games={games ?? []}
                commissionerSubmissionIds={(overrideEvents ?? []).map((event) =>
                  Number(event.entity_id),
                )}
              />
            </div>
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
