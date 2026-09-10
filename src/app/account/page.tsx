import Link from "next/link";
import { redirect } from "next/navigation";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { loadCompetition } from "@/features/competition/data";
import { gamesBack } from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  if (params.section === "settings") redirect("/settings");
  if (params.section === "submissions") redirect("/submissions");

  const { supabase, entry, email, isCommissioner, userId } =
    await getPoolContext();
  const [{ data: season }, { data: privateProfile }, competition] =
    await Promise.all([
      entry
        ? supabase
            .from("seasons")
            .select("year, status")
            .eq("id", entry.season_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("profiles")
        .select("phone_e164")
        .eq("id", userId)
        .maybeSingle(),
      entry
        ? loadCompetition(supabase, entry.season_id, undefined, {
            includeComments: false,
            includeTeams: false,
          })
        : Promise.resolve(null),
    ]);
  const standing = competition?.standings.find(
    (item) => item.entryId === entry?.id,
  );
  const financial = entry ? competition?.financials.get(entry.id) : undefined;

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
      refreshWhileLive={Boolean(
        competition?.games.some((game) => game.status === "live"),
      )}
    >
      <div className="pb-3 sm:pb-5">
        <CompactPageHeader
          sticky
          title="Profile"
          className="mb-3"
          action={
            <Link
              href="/settings"
              className="control-raised grid min-h-9 place-items-center rounded-md border px-3 text-xs font-black"
            >
              EDIT
            </Link>
          }
        />
        {standing && (
          <PerformanceStats
            values={[
              [
                "Record",
                `${standing.wins}-${standing.losses}-${standing.ties}`,
              ],
              ["GB", gamesBack(standing, competition!.standings).toFixed(1)],
              ["UD Pts", standing.underdogPoints.toFixed(1)],
              ["SD", `${standing.suddenDeathStrikes}/2`],
              ["Main $", formatMoney(financial?.main ?? 0)],
              ["Net $", formatMoney(financial?.net ?? 0)],
            ]}
          />
        )}
        <section className="game-card grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border p-4 text-sm">
          <Info label="Entry" value={entry?.entry_code ?? "—"} />
          <Info label="Season" value={String(season?.year ?? "2026")} />
          <Info label="Email" value={email || "—"} />
          <Info label="Phone" value={privateProfile?.phone_e164 ?? "—"} />
          <Info label="Status" value={season?.status ?? "Not enrolled"} />
          <Info
            label="Access"
            value={isCommissioner ? "Commissioner" : "Entrant"}
          />
        </section>
      </div>
    </PageShell>
  );
}

function PerformanceStats({ values }: { values: [string, string][] }) {
  return (
    <section className="mb-3 grid grid-cols-6 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      {values.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 border-r border-slate-800 px-1 py-2 text-center last:border-r-0"
        >
          <span className="block truncate text-[7px] font-black uppercase text-slate-400">
            {label}
          </span>
          <strong className="mt-0.5 block truncate text-[11px]">{value}</strong>
        </div>
      ))}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[8px] font-black uppercase text-slate-400">
        {label}
      </span>
      <p className="mt-0.5 truncate font-bold">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
