"use client";

import { useEffect, useMemo, useState } from "react";

import { MOCK_GAMES } from "./mock-games";
import {
  EMPTY_PICKS,
  favoriteFor,
  formatSpread,
  pickKey,
  spreadFor,
  toggleTeamPick,
  toggleTotalPick,
  underdogFor,
  validationMessage,
  type Game,
  type Picks,
  type TeamPick,
  type TotalPick,
} from "./model";

const draftStorageKey = "hppp:2026:week-1:draft";
const selectedClass =
  "border-lime-300 bg-lime-300 text-slate-950 shadow-[inset_0_3px_5px_rgb(15_23_42/0.45)]";
const idleClass =
  "border-slate-600 bg-slate-950 text-slate-100 shadow-[0_1px_2px_rgb(0_0_0/0.3)]";

function isTeamSelected(pick: TeamPick | null, gameId: string, team: string) {
  return pick?.gameId === gameId && pick.team === team;
}

function resultClass(result?: "win" | "loss" | "tie") {
  if (result === "win") return "border-emerald-400 bg-emerald-700 text-white";
  if (result === "loss") return "border-red-400 bg-red-800 text-white";
  if (result === "tie") return "border-slate-400 bg-slate-600 text-white";
  return idleClass;
}

function Logo({ abbreviation }: { abbreviation: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 place-items-center rounded-full border-2 border-current text-[11px] font-black"
    >
      {abbreviation}
    </span>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg
      aria-label="Locked"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ) : (
    <svg
      aria-label="Unlocked"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

function TeamToggle({
  game,
  team,
  selected,
  disabled,
  onClick,
}: {
  game: Game;
  team: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${team} ${formatSpread(spreadFor(game, team))}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex aspect-square w-full flex-col items-center justify-center rounded-lg border text-xs font-black transition-colors disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40 disabled:text-slate-600 ${selected ? selectedClass : idleClass}`}
    >
      <Logo abbreviation={team} />
      <span className="mt-1 leading-none">
        {formatSpread(spreadFor(game, team))}
      </span>
    </button>
  );
}

function SmallToggle({
  selected,
  disabled,
  children,
  onClick,
  label,
  className = "",
}: {
  selected: boolean;
  disabled: boolean;
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 rounded-md border px-1 text-[11px] font-black leading-tight transition-colors disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40 disabled:text-slate-600 ${selected ? selectedClass : idleClass} ${className}`}
    >
      {children}
    </button>
  );
}

function GameInfo({ game }: { game: Game }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className="flex items-center gap-1">
        <span className="rounded bg-sky-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
          {game.badge}
        </span>
        <LockIcon locked={Boolean(game.locked)} />
      </div>
      <strong className="mt-0.5 whitespace-nowrap text-xs">
        {game.away.abbreviation} {formatSpread(game.awaySpread)} @{" "}
        {game.home.abbreviation}
      </strong>
      <span className="whitespace-nowrap text-[11px] text-slate-300">
        O/U {game.total}
      </span>
      <span className="whitespace-nowrap text-[10px] text-slate-400">
        {game.kickoff}
      </span>
      <span className="max-w-full truncate text-[9px] text-slate-500">
        {game.location}
      </span>
    </div>
  );
}

function GameRow({
  game,
  picks,
  setPicks,
}: {
  game: Game;
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
}) {
  const [sdUnderdog, setSdUnderdog] = useState(false);
  const ats = picks.ats.find((pick) => pick.gameId === game.id);
  const total = picks.totals.find((pick) => pick.gameId === game.id);
  const favorite = favoriteFor(game);
  const underdog = underdogFor(game);
  const sdTeam = sdUnderdog ? underdog : favorite;
  const awayIsFavorite = favorite === game.away.abbreviation;
  const atsAtLimit = picks.ats.length >= 6 && !ats;
  const totalsAtLimit = picks.totals.length >= 3 && !total;
  const sdUnavailable = Boolean(
    picks.suddenDeath && picks.suddenDeath.gameId !== game.id,
  );
  const udUnavailable = Boolean(
    picks.underdog && picks.underdog.gameId !== game.id,
  );

  function toggleAts(team: string) {
    setPicks((current) => {
      const nextAts = toggleTeamPick(current.ats, { gameId: game.id, team }, 6);
      const bestBetStillSelected = current.bestBet
        ? nextAts.some((pick) => pickKey(pick) === pickKey(current.bestBet!))
        : true;

      return {
        ...current,
        ats: nextAts,
        bestBet: bestBetStillSelected ? current.bestBet : null,
      };
    });
  }

  function toggleTotal(direction: TotalPick["direction"]) {
    setPicks((current) => ({
      ...current,
      totals: toggleTotalPick(
        current.totals,
        { gameId: game.id, direction },
        3,
      ),
    }));
  }

  return (
    <article
      className={`rounded-xl border p-1.5 ${game.locked ? "border-slate-700 bg-slate-800/50 opacity-45" : "border-slate-700 bg-slate-900"}`}
    >
      <div className="grid grid-cols-[72px_minmax(100px,1fr)_72px] items-center gap-2">
        <TeamToggle
          game={game}
          team={game.away.abbreviation}
          selected={ats?.team === game.away.abbreviation}
          disabled={Boolean(game.locked || atsAtLimit)}
          onClick={() => toggleAts(game.away.abbreviation)}
        />
        <GameInfo game={game} />
        <TeamToggle
          game={game}
          team={game.home.abbreviation}
          selected={ats?.team === game.home.abbreviation}
          disabled={Boolean(game.locked || atsAtLimit)}
          onClick={() => toggleAts(game.home.abbreviation)}
        />
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1">
        <SmallToggle
          className="order-2"
          label={`Over ${game.total}`}
          selected={total?.direction === "over"}
          disabled={Boolean(game.locked || totalsAtLimit)}
          onClick={() => toggleTotal("over")}
        >
          ▲ O {game.total}
        </SmallToggle>
        <SmallToggle
          className="order-3"
          label={`Under ${game.total}`}
          selected={total?.direction === "under"}
          disabled={Boolean(game.locked || totalsAtLimit)}
          onClick={() => toggleTotal("under")}
        >
          ▼ U {game.total}
        </SmallToggle>
        <div
          className={`grid min-h-10 grid-cols-[1fr_22px] overflow-hidden rounded-md border transition-colors ${awayIsFavorite ? "order-1" : "order-4"} ${isTeamSelected(picks.suddenDeath, game.id, sdTeam) ? selectedClass : idleClass}`}
        >
          <button
            type="button"
            aria-label={`Sudden Death ${sdTeam}`}
            aria-pressed={isTeamSelected(picks.suddenDeath, game.id, sdTeam)}
            disabled={Boolean(game.locked || sdUnavailable)}
            onClick={() =>
              setPicks((current) => ({
                ...current,
                suddenDeath: isTeamSelected(
                  current.suddenDeath,
                  game.id,
                  sdTeam,
                )
                  ? null
                  : { gameId: game.id, team: sdTeam },
              }))
            }
            className="text-xs font-black leading-tight disabled:opacity-30"
          >
            SD
            <br />
            {sdTeam}
          </button>
          <button
            type="button"
            aria-label={`Switch Sudden Death to ${sdUnderdog ? favorite : underdog}`}
            disabled={Boolean(game.locked || sdUnavailable)}
            onClick={() => {
              setSdUnderdog((value) => !value);
              setPicks((current) =>
                current.suddenDeath?.gameId === game.id
                  ? { ...current, suddenDeath: null }
                  : current,
              );
            }}
            className="border-l border-current/30 text-xs font-black disabled:opacity-30"
          >
            ⇄
          </button>
        </div>
        <SmallToggle
          className={awayIsFavorite ? "order-4" : "order-1"}
          label={`Underdog ${underdog}`}
          selected={isTeamSelected(picks.underdog, game.id, underdog)}
          disabled={Boolean(game.locked || udUnavailable)}
          onClick={() =>
            setPicks((current) => ({
              ...current,
              underdog: isTeamSelected(current.underdog, game.id, underdog)
                ? null
                : { gameId: game.id, team: underdog },
            }))
          }
        >
          UD
          <br />
          {underdog}
        </SmallToggle>
      </div>
    </article>
  );
}

function teamResult(
  game: Game | undefined,
  team: string,
  kind: "ats" | "side",
) {
  if (!game?.result) return undefined;
  const winner = kind === "ats" ? game.result.atsWinner : game.result.winner;
  if (winner === null) return "tie" as const;
  return winner === team ? ("win" as const) : ("loss" as const);
}

function totalResult(
  game: Game | undefined,
  direction: TotalPick["direction"],
) {
  if (!game?.result) return undefined;
  if (game.result.totalWinner === null) return "tie" as const;
  return game.result.totalWinner === direction
    ? ("win" as const)
    : ("loss" as const);
}

function Preview({
  picks,
  setPicks,
}: {
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
}) {
  const [message, setMessage] = useState("Draft saved on this device");
  const [submittedDraft, setSubmittedDraft] = useState<string | null>(null);
  const games = useMemo(
    () => new Map(MOCK_GAMES.map((game) => [game.id, game])),
    [],
  );
  const serializedDraft = JSON.stringify(picks);
  const complete =
    picks.ats.length === 6 &&
    picks.totals.length === 3 &&
    Boolean(picks.bestBet && picks.suddenDeath && picks.underdog);
  const submitted = complete && submittedDraft === serializedDraft;

  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t-4 border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur">
      <div className="space-y-1 px-2 py-1.5">
        <div
          className="flex items-center gap-1 overflow-x-auto"
          aria-label="ATS picks"
        >
          <span className="w-8 shrink-0 text-[10px] font-black text-slate-400">
            ATS
          </span>
          {Array.from({ length: 6 }, (_, index) => {
            const pick = picks.ats[index];
            if (!pick)
              return (
                <span
                  key={index}
                  className="size-9 shrink-0 rounded-full border border-dashed border-slate-700"
                />
              );
            const bestBet =
              picks.bestBet && pickKey(picks.bestBet) === pickKey(pick);
            return (
              <button
                key={pickKey(pick)}
                type="button"
                aria-label={`${pick.team}${bestBet ? ", Best Bet" : ", mark Best Bet"}`}
                aria-pressed={Boolean(bestBet)}
                onClick={() =>
                  setPicks((current) => ({
                    ...current,
                    bestBet: bestBet ? null : pick,
                  }))
                }
                className={`relative grid size-9 shrink-0 place-items-center rounded-full border text-[10px] font-black ${resultClass(teamResult(games.get(pick.gameId), pick.team, "ats"))} ${bestBet ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950" : ""}`}
              >
                {bestBet && (
                  <span className="absolute -top-2 text-sm text-amber-300">
                    ♛
                  </span>
                )}
                {pick.team}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto text-[10px] font-black">
          <span className="text-slate-400">SD</span>
          <span
            className={`rounded-full border px-2 py-1 ${picks.suddenDeath ? resultClass(teamResult(games.get(picks.suddenDeath.gameId), picks.suddenDeath.team, "side")) : "border-dashed border-slate-700 text-slate-600"}`}
          >
            {picks.suddenDeath?.team ?? "—"}
          </span>
          <span className="text-slate-400">UD</span>
          <span
            className={`rounded-full border px-2 py-1 ${picks.underdog ? resultClass(teamResult(games.get(picks.underdog.gameId), picks.underdog.team, "side")) : "border-dashed border-slate-700 text-slate-600"}`}
          >
            {picks.underdog?.team ?? "—"}
          </span>
          <span className="ml-1 text-slate-400">O/U</span>
          {picks.totals.map((pick) => {
            const game = games.get(pick.gameId);
            return (
              <span
                key={pick.gameId}
                className={`whitespace-nowrap rounded-full border px-2 py-1 ${resultClass(totalResult(game, pick.direction))}`}
              >
                {game?.away.abbreviation}/{game?.home.abbreviation}{" "}
                {pick.direction === "over" ? "O" : "U"}
              </span>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-[48px_1fr_minmax(112px,1.25fr)] border-t border-slate-800">
        <button
          type="button"
          onClick={() => {
            setPicks(EMPTY_PICKS);
            setSubmittedDraft(null);
            setMessage("Draft cleared");
          }}
          className="min-h-12 border-r border-slate-800 text-[11px] font-bold text-slate-300 underline"
        >
          Clear
        </button>
        <div className="flex flex-col justify-center px-2 text-[10px] font-bold leading-4 text-slate-300">
          <span className="flex items-center gap-1 whitespace-nowrap">
            ATS {picks.ats.length}/6 · O/U {picks.totals.length}/3
            {complete ? (
              <span
                aria-label={submitted ? "Submitted" : "Ready to submit"}
                className={`grid size-4 place-items-center rounded-full text-[11px] font-black ${submitted ? "bg-emerald-400 text-white" : "bg-white text-black"}`}
              >
                ✓
              </span>
            ) : (
              <span className="size-4 rounded-full border border-slate-600" />
            )}
          </span>
          <span className="whitespace-nowrap">
            BB {picks.bestBet ? "✓" : "□"} · SD {picks.suddenDeath ? "✓" : "□"}{" "}
            · UD {picks.underdog ? "✓" : "□"}
          </span>
          <span role="status" className="sr-only">
            {message}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const validation = validationMessage(picks);
            setMessage(complete ? "Demo submission recorded" : validation);
            if (complete) setSubmittedDraft(serializedDraft);
          }}
          className="min-h-12 bg-emerald-500 px-3 text-lg font-black text-slate-950 shadow-[inset_0_-3px_0_rgb(5_90_65/0.55)] active:shadow-[inset_0_3px_5px_rgb(5_46_22/0.55)]"
        >
          SUBMIT
        </button>
      </div>
    </aside>
  );
}

export function PicksExperience() {
  const [picks, setPicks] = useState<Picks>(EMPTY_PICKS);
  const [view, setView] = useState<"picks" | "grid">("picks");
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- restore external browser state after hydration */
    const savedDraft = window.localStorage.getItem(draftStorageKey);
    if (savedDraft) {
      try {
        setPicks(JSON.parse(savedDraft) as Picks);
      } catch {
        window.localStorage.removeItem(draftStorageKey);
      }
    }
    setDraftReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (draftReady) {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(picks));
    }
  }, [draftReady, picks]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-950 px-2 pb-32 text-slate-100">
      <header className="sticky top-0 z-10 -mx-2 border-b border-slate-700 bg-slate-950/95 px-2 pb-1.5 pt-1.5 backdrop-blur">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300">
          HPPP · 2026 · HARR
        </p>
        <nav className="grid grid-cols-3 gap-1" aria-label="Primary">
          {[
            ["HOME", true],
            ["STANDINGS", false],
            ["RULES", false],
          ].map(([label, active]) => (
            <button
              key={String(label)}
              className={`min-h-9 rounded-md text-[11px] font-black ${active ? "bg-lime-300 text-slate-950" : "bg-slate-900 text-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-1 flex items-center justify-between gap-1">
          <div className="grid flex-1 grid-cols-2 rounded-xl bg-slate-900 p-1">
            {(["picks", "grid"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`min-h-8 rounded-md text-[11px] font-black uppercase ${view === option ? "bg-white text-slate-950 shadow-[inset_0_2px_4px_rgb(15_23_42/0.35)]" : "text-slate-400"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <select
            aria-label="Week"
            className="min-h-9 rounded-md border border-slate-600 bg-slate-950 px-2 text-xs font-black"
            defaultValue="1"
          >
            <option value="1">Week 1</option>
          </select>
        </div>
      </header>
      {view === "grid" ? (
        <section className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h2 className="text-lg font-black">Weekly grid</h2>
          <p className="mt-2 text-sm text-slate-400">
            Picks appear here game-by-game at kickoff.
          </p>
        </section>
      ) : (
        <>
          <p className="my-2 text-xs text-slate-400">
            Demo Week 1 lines · picks save on this device
          </p>
          <section className="space-y-2" aria-label="Week 1 games">
            {MOCK_GAMES.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                picks={picks}
                setPicks={setPicks}
              />
            ))}
          </section>
          <Preview picks={picks} setPicks={setPicks} />
        </>
      )}
    </main>
  );
}
