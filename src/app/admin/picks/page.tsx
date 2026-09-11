import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { SubmissionRevisionLog } from "@/components/submission-revision-log";
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
  const [{ data: submissions }, { data: games }] = currentWeek
    ? await Promise.all([
        supabase
          .from("weekly_submissions")
          .select("id, entry_id, revision, submitted_at")
          .eq("week_id", currentWeek.id)
          .order("revision", { ascending: false }),
        supabase
          .from("games")
          .select("id, away_team, home_team")
          .eq("week_id", currentWeek.id),
      ])
    : [{ data: [] }, { data: [] }];
  const submissionIds = (submissions ?? []).map((submission) => submission.id);
  const [{ data: pickRows }, { data: overrideEvents }] = submissionIds.length
    ? await Promise.all([
        supabase
          .from("picks")
          .select(
            "submission_id, game_id, kind, team, total_direction, is_best_bet",
          )
          .in("submission_id", submissionIds),
        supabase
          .from("commissioner_audit_events")
          .select("entity_id")
          .eq("entity_type", "weekly_submission")
          .in("entity_id", submissionIds.map(String)),
      ])
    : [{ data: [] }, { data: [] }];
  const latestByEntry = new Map<
    number,
    { revision: number; submitted_at: string }
  >();
  for (const submission of submissions ?? [])
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
      {currentWeek && (
        <p className="mb-2 rounded border border-amber-900 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-200">
          <strong>Not submitted:</strong>{" "}
          {(entries ?? [])
            .filter((entry) => !latestByEntry.has(entry.id))
            .map((entry) => entry.entry_code)
            .join(", ") || "None"}
        </p>
      )}
      <section className="grid gap-1.5">
        {(entries ?? []).map((entry) => {
          const latest = latestByEntry.get(entry.id);
          const history = (submissions ?? []).filter(
            (submission) => submission.entry_id === entry.id,
          );
          return (
            <div
              key={entry.id}
              className="game-card rounded-lg border px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <strong className="text-lg">{entry.entry_code}</strong>
                <small className="text-slate-400">
                  {latest ? `Rev ${latest.revision}` : "No submission"}
                </small>
                {latest && (
                  <time className="ml-auto text-[9px] text-slate-500">
                    {new Date(latest.submitted_at).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      month: "numeric",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                )}
                {currentWeek ? (
                  <Link
                    href={`/admin/picks/${entry.id}?week=${currentWeek.id}`}
                    className="control-raised grid min-h-7 place-items-center rounded border px-2 text-[9px] font-black"
                  >
                    EDIT
                  </Link>
                ) : null}
              </div>
              {history.length > 0 && (
                <details className="mt-1 border-t border-slate-800 pt-1">
                  <summary className="cursor-pointer text-[10px] font-black text-slate-400">
                    Submission history ({history.length})
                  </summary>
                  <SubmissionRevisionLog
                    revisions={history}
                    picks={pickRows ?? []}
                    games={games ?? []}
                    commissionerSubmissionIds={(overrideEvents ?? []).map(
                      (event) => Number(event.entity_id),
                    )}
                  />
                </details>
              )}
            </div>
          );
        })}
      </section>
    </PageShell>
  );
}
