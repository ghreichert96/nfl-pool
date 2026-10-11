import { PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
export default async function ActivityPage() {
  const { supabase, poolId } = await requireCommissioner();
  const [
    { data: slots, error: slotError },
    { data: runs, error: runError },
    { data: audit, error: auditError },
    { data: scores, error: scoreError },
  ] = await Promise.all([
    supabase
      .from("odds_schedule_slots")
      .select("*")
      .order("expected_at", { ascending: false })
      .limit(40),
    supabase
      .from("odds_ingestion_runs")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(40),
    supabase
      .from("commissioner_audit_events")
      .select("id,action,entity_type,created_at")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("live_status_ingestion_runs")
      .select("id,status,requested_at,games_updated,error_message")
      .order("requested_at", { ascending: false })
      .limit(20),
  ]);
  if (slotError || runError || auditError || scoreError)
    throw slotError || runError || auditError || scoreError;
  return (
    <PageShell isCommissioner>
      <h1 className="mb-3 font-black">Activity Log</h1>
      <p className="mb-3 text-xs text-slate-400">
        All times Eastern. Sunday noon initialization; Sunday 8 PM refresh;
        Monday–Thursday 2 AM, noon and 8 PM refreshes. Thursday 8 PM locks the
        last saved lines.
      </p>
      <section className="game-card mb-3 rounded-lg border p-3">
        <h2 className="mb-2 font-bold">ESPN score updates</h2>
        <ul className="divide-y divide-[var(--line)] text-xs">
          {(scores ?? []).map((run) => (
            <li key={run.id} className="py-2">
              <span>
                {time(run.requested_at)} · {run.status} · {run.games_updated}{" "}
                updated
              </span>
              {run.error_message && (
                <p className="text-red-400">{run.error_message}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="game-card mb-3 overflow-x-auto rounded-lg border p-3">
        <h2 className="mb-2 font-bold">Scheduled odds jobs</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {["Job", "Expected", "Last attempt", "Completed", "Status"].map(
                (t) => (
                  <th key={t} className="p-2">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(slots ?? []).map((slot) => (
              <tr
                key={slot.id}
                className={
                  slot.error_message ||
                  (!slot.completed_at && slot.attempts >= 3)
                    ? "text-red-400"
                    : ""
                }
              >
                <td className="p-2">{slot.mode}</td>
                <td className="p-2 whitespace-nowrap">
                  {time(slot.expected_at)}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {time(slot.last_attempt_at)}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {time(slot.completed_at)}
                </td>
                <td className="p-2">
                  {slot.error_message ??
                    (slot.completed_at
                      ? "Complete"
                      : slot.attempts >= 3
                        ? "No successful response after three attempts"
                        : `${slot.attempts}/3 attempts`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!slots?.length && (
          <p className="text-sm">No scheduler jobs recorded yet.</p>
        )}
      </section>
      <section className="game-card mb-3 rounded-lg border p-3">
        <h2 className="font-bold">Odds refreshes</h2>
        <ol className="divide-y divide-slate-800">
          {(runs ?? []).map((run) => (
            <li key={run.id} className="py-3 text-xs">
              <div className="flex justify-between gap-2">
                <strong>
                  {run.trigger_source} · {run.status}
                </strong>
                <time>{time(run.requested_at)}</time>
              </div>
              <p className="mt-1 text-slate-400">
                {run.events_received} fetched · {run.applied} applied ·{" "}
                {run.unchanged} unchanged · {run.skipped} skipped · {run.failed}{" "}
                failed · {run.snapshots_written} snapshots · quota{" "}
                {run.quota_remaining ?? "—"}
              </p>
              {run.error_message && (
                <p className="mt-1 text-red-400">{run.error_message}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
      <section className="game-card rounded-lg border p-3">
        <h2 className="font-bold">Commissioner activity</h2>
        <ol className="divide-y divide-slate-800">
          {(audit ?? []).map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-2 py-2 text-xs"
            >
              <span>
                {item.action.replaceAll("_", " ")} · {item.entity_type}
              </span>
              <time>{time(item.created_at)}</time>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
