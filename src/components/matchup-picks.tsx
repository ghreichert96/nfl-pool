"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { TableTeam } from "@/components/table-team";
import { loadMatchupPicks } from "@/features/picks/matchup-picks-action";
import type { MatchupPicks } from "@/features/picks/matchup-picks";
import { formatSpread } from "@/features/picks/model";

type Matchup = { gameId: number; label: string };
const MatchupContext = createContext<{
  available: Set<number>;
  open: (matchup: Matchup) => void;
} | null>(null);

export function MatchupPicksProvider({
  gameIds,
  children,
}: {
  gameIds: number[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Matchup | null>(null);
  const available = new Set(gameIds);
  const open = (matchup: Matchup) => {
    if (available.has(matchup.gameId)) setSelected(matchup);
  };
  return (
    <MatchupContext.Provider value={{ available, open }}>
      {children}
      {selected && (
        <MatchupDialog
          key={selected.gameId}
          matchup={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </MatchupContext.Provider>
  );
}

export function MatchupPicksTrigger({
  gameId,
  label,
  selection,
  className,
  children,
}: Matchup & {
  selection?: string;
  className: string;
  children: ReactNode;
}) {
  const context = useContext(MatchupContext);
  if (!context?.available.has(gameId)) return children;
  return (
    <button
      type="button"
      aria-label={`${selection ? `${selection}. ` : ""}Who picked ${label}?`}
      aria-haspopup="dialog"
      className={`cursor-pointer rounded hover:bg-slate-500/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-500 ${className}`}
      onClick={() => context.open({ gameId, label })}
    >
      {children}
    </button>
  );
}

function MatchupDialog({
  matchup,
  onClose,
}: {
  matchup: Matchup;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<MatchupPicks | null | undefined>(
    undefined,
  );
  const { gameId, label } = matchup;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    loadMatchupPicks(gameId).then(
      (result) => {
        if (active) setDetails(result);
      },
      () => {
        if (active) setDetails(null);
      },
    );
    return () => {
      active = false;
    };
  }, [gameId]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="matchup-picks-title"
      className="game-card fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-sm overflow-auto rounded-xl border p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/65"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="matchup-picks-title" className="text-sm font-black">
            Who picked {label}?
          </h2>
          <button
            type="button"
            aria-label="Close matchup picks"
            className="control-raised grid size-8 shrink-0 place-items-center rounded border text-lg"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        {details ? (
          <MatchupTable details={details} />
        ) : (
          <p role="status" className="py-3 text-sm">
            {details === undefined
              ? "Loading picks…"
              : "Matchup picks are unavailable."}
          </p>
        )}
      </div>
    </dialog>
  );
}

function MatchupTable({ details }: { details: MatchupPicks }) {
  return (
    <table
      className="w-full table-fixed text-center text-sm"
      aria-label="Picks by team and total"
    >
      <thead>
        <tr className="border-b border-[var(--line)]">
          <th scope="col" aria-label={details.away.team}>
            <span className="inline-flex items-center gap-1">
              <TableTeam team={details.away.team} src={details.away.logo} />
              {details.awaySpread !== null && formatSpread(details.awaySpread)}
            </span>
          </th>
          <td className="w-6 font-bold">@</td>
          <th scope="col" aria-label={details.home.team}>
            <TableTeam team={details.home.team} src={details.home.logo} />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <PickList picks={details.away.picks} />
          <td />
          <PickList picks={details.home.picks} />
        </tr>
        <tr className="border-y border-[var(--line)]">
          <th scope="col" className="py-1">
            O{details.total}
          </th>
          <td />
          <th scope="col" className="py-1">
            U{details.total}
          </th>
        </tr>
        <tr>
          <PickList picks={details.over} />
          <td />
          <PickList picks={details.under} />
        </tr>
      </tbody>
    </table>
  );
}

function PickList({ picks }: { picks: string[] }) {
  return (
    <td className="py-2 align-top">
      {picks.length ? (
        <ul className="space-y-0.5 font-semibold tabular-nums">
          {picks.map((pick) => (
            <li key={pick}>{pick}</li>
          ))}
        </ul>
      ) : (
        <span aria-label="No picks" className="opacity-50">
          —
        </span>
      )}
    </td>
  );
}
