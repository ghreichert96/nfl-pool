"use client";

import { useMemo, useState } from "react";

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
} from "./model";

type Variant = "A" | "B";

const selectedClass = "border-lime-300 bg-lime-300 text-slate-950";
const idleClass = "border-slate-600 bg-slate-900 text-slate-100";

function Logo({
  abbreviation,
  selected = false,
}: {
  abbreviation: string;
  selected?: boolean;
}) {
  return (
    <div
      aria-label={`${abbreviation} logo placeholder`}
      className={`grid size-10 shrink-0 place-items-center rounded-full border-2 text-xs font-black sm:size-12 sm:text-sm ${
        selected
          ? "border-lime-300 bg-lime-300 text-slate-950"
          : "border-slate-600 bg-slate-800"
      }`}
    >
      {abbreviation}
    </div>
  );
}

function PickButton({
  selected,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-lg border px-2 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? selectedClass : idleClass}`}
      {...props}
    >
      {children}
    </button>
  );
}

function GameInfo({
  game,
  onActivate,
}: {
  game: Game;
  onActivate?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-sky-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
          {game.badge}
        </span>
        <span aria-label={game.locked ? "Locked" : "Unlocked"}>
          {game.locked ? "🔒" : "🔓"}
        </span>
      </div>
      <strong className="text-sm">
        {game.away.abbreviation} @ {game.home.abbreviation}
      </strong>
      <span className="text-xs text-slate-300">
        {formatSpread(game.awaySpread)} · O/U {game.total}
      </span>
      <span className="text-[11px] text-slate-400">{game.kickoff}</span>
      <span className="truncate text-[10px] text-slate-500">
        {game.location}
      </span>
    </>
  );

  return onActivate ? (
    <button
      type="button"
      onClick={onActivate}
      className="flex min-w-0 flex-1 flex-col items-start text-left"
    >
      {content}
    </button>
  ) : (
    <div className="flex min-w-0 flex-1 flex-col items-start">{content}</div>
  );
}

function isTeamSelected(pick: TeamPick | null, gameId: string, team: string) {
  return pick?.gameId === gameId && pick.team === team;
}

function FormA({
  picks,
  updatePicks,
}: {
  picks: Picks;
  updatePicks: React.Dispatch<React.SetStateAction<Picks>>;
}) {
  const [flipped, setFlipped] = useState<string[]>([]);

  return (
    <div className="space-y-2">
      {MOCK_GAMES.map((game) => {
        const favorite = favoriteFor(game);
        const underdog = underdogFor(game);
        const sdTeam = flipped.includes(game.id) ? underdog : favorite;
        const ats = picks.ats.find((pick) => pick.gameId === game.id);
        const total = picks.totals.find((pick) => pick.gameId === game.id);

        return (
          <article
            key={game.id}
            className="grid grid-cols-[40px_minmax(82px,1fr)_40px_116px] items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:grid-cols-[48px_minmax(110px,1fr)_48px_142px] sm:gap-2 sm:p-2"
          >
            <Logo
              abbreviation={game.away.abbreviation}
              selected={ats?.team === game.away.abbreviation}
            />
            <GameInfo game={game} />
            <Logo
              abbreviation={game.home.abbreviation}
              selected={ats?.team === game.home.abbreviation}
            />
            <div
              className="grid grid-cols-3 gap-1"
              aria-label={`${game.away.abbreviation} at ${game.home.abbreviation} picks`}
            >
              <span className="text-center text-[9px] font-bold text-slate-500">
                ATS
              </span>
              <span className="text-center text-[9px] font-bold text-slate-500">
                O/U
              </span>
              <span className="text-center text-[9px] font-bold text-slate-500">
                SIDE
              </span>
              <PickButton
                selected={ats?.team === game.away.abbreviation}
                onClick={() =>
                  updatePicks((current) => ({
                    ...current,
                    ats: toggleTeamPick(
                      current.ats,
                      { gameId: game.id, team: game.away.abbreviation },
                      6,
                    ),
                    bestBet:
                      current.bestBet?.gameId === game.id &&
                      current.bestBet.team !== game.away.abbreviation
                        ? null
                        : current.bestBet,
                  }))
                }
              >
                {game.away.abbreviation}
                <br />
                {formatSpread(spreadFor(game, game.away.abbreviation))}
              </PickButton>
              <PickButton
                selected={total?.direction === "over"}
                onClick={() =>
                  updatePicks((current) => ({
                    ...current,
                    totals: toggleTotalPick(
                      current.totals,
                      { gameId: game.id, direction: "over" },
                      3,
                    ),
                  }))
                }
              >
                O<br />
                {game.total}
              </PickButton>
              <PickButton
                selected={isTeamSelected(picks.suddenDeath, game.id, sdTeam)}
                onClick={() =>
                  updatePicks((current) => ({
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
              >
                SD
                <br />
                {sdTeam}
              </PickButton>
              <PickButton
                selected={ats?.team === game.home.abbreviation}
                onClick={() =>
                  updatePicks((current) => ({
                    ...current,
                    ats: toggleTeamPick(
                      current.ats,
                      { gameId: game.id, team: game.home.abbreviation },
                      6,
                    ),
                    bestBet:
                      current.bestBet?.gameId === game.id &&
                      current.bestBet.team !== game.home.abbreviation
                        ? null
                        : current.bestBet,
                  }))
                }
              >
                {game.home.abbreviation}
                <br />
                {formatSpread(spreadFor(game, game.home.abbreviation))}
              </PickButton>
              <PickButton
                selected={total?.direction === "under"}
                onClick={() =>
                  updatePicks((current) => ({
                    ...current,
                    totals: toggleTotalPick(
                      current.totals,
                      { gameId: game.id, direction: "under" },
                      3,
                    ),
                  }))
                }
              >
                U<br />
                {game.total}
              </PickButton>
              <div className="grid grid-cols-[1fr_16px] gap-0.5 sm:grid-cols-[1fr_18px]">
                <PickButton
                  selected={isTeamSelected(picks.underdog, game.id, underdog)}
                  onClick={() =>
                    updatePicks((current) => ({
                      ...current,
                      underdog: isTeamSelected(
                        current.underdog,
                        game.id,
                        underdog,
                      )
                        ? null
                        : { gameId: game.id, team: underdog },
                    }))
                  }
                >
                  UD
                  <br />
                  {underdog}
                </PickButton>
                <button
                  type="button"
                  aria-label={`Swap sudden death side for ${game.away.abbreviation} at ${game.home.abbreviation}`}
                  onClick={() =>
                    setFlipped((current) =>
                      current.includes(game.id)
                        ? current.filter((id) => id !== game.id)
                        : [...current, game.id],
                    )
                  }
                  className="rounded border border-slate-700 text-[10px] text-slate-300"
                >
                  ⇄
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FormB({
  picks,
  updatePicks,
}: {
  picks: Picks;
  updatePicks: React.Dispatch<React.SetStateAction<Picks>>;
}) {
  const [active, setActive] = useState<{
    gameId: string;
    kind: "team" | "total";
    team?: string;
  } | null>(null);

  return (
    <div className="space-y-2">
      {MOCK_GAMES.map((game) => {
        const ats = picks.ats.find((pick) => pick.gameId === game.id);
        const total = picks.totals.find((pick) => pick.gameId === game.id);
        const context = active?.gameId === game.id ? active : null;
        const team = context?.team;
        const underdog = underdogFor(game);

        return (
          <article
            key={game.id}
            className="grid grid-cols-[40px_minmax(82px,1fr)_40px_116px] items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:grid-cols-[52px_minmax(110px,1fr)_52px_132px] sm:gap-2 sm:p-2"
          >
            <button
              type="button"
              onClick={() =>
                setActive({
                  gameId: game.id,
                  kind: "team",
                  team: game.away.abbreviation,
                })
              }
              aria-label={`Choose ${game.away.name}`}
            >
              <Logo
                abbreviation={game.away.abbreviation}
                selected={ats?.team === game.away.abbreviation}
              />
            </button>
            <GameInfo
              game={game}
              onActivate={() => setActive({ gameId: game.id, kind: "total" })}
            />
            <button
              type="button"
              onClick={() =>
                setActive({
                  gameId: game.id,
                  kind: "team",
                  team: game.home.abbreviation,
                })
              }
              aria-label={`Choose ${game.home.name}`}
            >
              <Logo
                abbreviation={game.home.abbreviation}
                selected={ats?.team === game.home.abbreviation}
              />
            </button>
            <div className="grid min-h-24 grid-cols-2 gap-1">
              {!context && (
                <div className="col-span-2 grid place-items-center rounded-lg border border-dashed border-slate-700 px-2 text-center text-xs text-slate-400">
                  Tap a team or the total
                </div>
              )}
              {context?.kind === "team" && team && (
                <>
                  <PickButton
                    selected={ats?.team === team}
                    onClick={() =>
                      updatePicks((current) => ({
                        ...current,
                        ats: toggleTeamPick(
                          current.ats,
                          { gameId: game.id, team },
                          6,
                        ),
                        bestBet:
                          current.bestBet?.gameId === game.id &&
                          current.bestBet.team !== team
                            ? null
                            : current.bestBet,
                      }))
                    }
                  >
                    ATS
                  </PickButton>
                  <PickButton
                    selected={isTeamSelected(picks.suddenDeath, game.id, team)}
                    onClick={() =>
                      updatePicks((current) => ({
                        ...current,
                        suddenDeath: isTeamSelected(
                          current.suddenDeath,
                          game.id,
                          team,
                        )
                          ? null
                          : { gameId: game.id, team },
                      }))
                    }
                  >
                    SD
                  </PickButton>
                  <PickButton
                    disabled={team !== underdog}
                    selected={isTeamSelected(picks.underdog, game.id, team)}
                    onClick={() =>
                      updatePicks((current) => ({
                        ...current,
                        underdog: isTeamSelected(
                          current.underdog,
                          game.id,
                          team,
                        )
                          ? null
                          : { gameId: game.id, team },
                      }))
                    }
                  >
                    UD
                  </PickButton>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    className="text-xs text-slate-400"
                  >
                    Done
                  </button>
                </>
              )}
              {context?.kind === "total" && (
                <>
                  <PickButton
                    selected={total?.direction === "over"}
                    onClick={() =>
                      updatePicks((current) => ({
                        ...current,
                        totals: toggleTotalPick(
                          current.totals,
                          { gameId: game.id, direction: "over" },
                          3,
                        ),
                      }))
                    }
                  >
                    OVER
                    <br />
                    {game.total}
                  </PickButton>
                  <PickButton
                    selected={total?.direction === "under"}
                    onClick={() =>
                      updatePicks((current) => ({
                        ...current,
                        totals: toggleTotalPick(
                          current.totals,
                          { gameId: game.id, direction: "under" },
                          3,
                        ),
                      }))
                    }
                  >
                    UNDER
                    <br />
                    {game.total}
                  </PickButton>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    className="col-span-2 text-xs text-slate-400"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Summary({
  picks,
  setPicks,
}: {
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [message, setMessage] = useState("");
  const gameById = useMemo(
    () => new Map(MOCK_GAMES.map((game) => [game.id, game])),
    [],
  );

  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-11 flex-1 rounded-lg border border-slate-600 px-3 text-left text-sm font-bold"
        >
          ATS {picks.ats.length}/6 · O/U {picks.totals.length}/3 · BB{" "}
          {picks.bestBet ? "✓" : "—"} · SD {picks.suddenDeath ? "✓" : "—"} · UD{" "}
          {picks.underdog ? "✓" : "—"}
        </button>
        <button
          type="button"
          onClick={() => setMessage(validationMessage(picks))}
          className="min-h-11 rounded-lg bg-emerald-500 px-5 font-black text-slate-950"
        >
          SUBMIT
        </button>
      </div>
      {expanded && (
        <div className="mt-2">
          <p className="mb-1 text-xs text-slate-400">
            Tap an ATS pick to mark Best Bet.
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {picks.ats.map((pick) => {
              const isBestBet =
                picks.bestBet && pickKey(picks.bestBet) === pickKey(pick);
              return (
                <button
                  key={pickKey(pick)}
                  type="button"
                  onClick={() =>
                    setPicks((current) => ({
                      ...current,
                      bestBet: isBestBet ? null : pick,
                    }))
                  }
                  className={`min-h-11 min-w-14 rounded-full border px-2 text-xs font-black ${isBestBet ? "border-amber-300 bg-amber-300 text-slate-950" : idleClass}`}
                >
                  {pick.team}
                  {isBestBet ? " · BB" : ""}
                </button>
              );
            })}
            {picks.ats.length === 0 && (
              <span className="py-3 text-xs text-slate-500">
                No ATS picks yet
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-300">
            <span>
              {picks.totals
                .map(
                  (pick) =>
                    `${gameById.get(pick.gameId)?.away.abbreviation}/${gameById.get(pick.gameId)?.home.abbreviation} ${pick.direction === "over" ? "O" : "U"}`,
                )
                .join(" · ") || "No totals yet"}
            </span>
            <button
              type="button"
              onClick={() => {
                setPicks(EMPTY_PICKS);
                setMessage("");
              }}
              className="min-h-10 shrink-0 px-2 underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-1 text-xs font-semibold text-amber-200">
          {message}
        </p>
      )}
    </aside>
  );
}

export function PicksPrototype() {
  const [variant, setVariant] = useState<Variant>("A");
  const [picks, setPicks] = useState<Picks>(EMPTY_PICKS);

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-950 px-2 pb-56 text-slate-100 sm:px-4">
      <header className="sticky top-0 z-10 -mx-2 border-b border-slate-700 bg-slate-950/95 px-3 py-3 backdrop-blur sm:-mx-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">
              HPPP · 2026
            </p>
            <h1 className="text-2xl font-black">Week 1 picks</h1>
          </div>
          <span className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold">
            Unlocked 🔓
          </span>
        </div>
        <div
          className="mt-3 grid grid-cols-2 rounded-xl bg-slate-900 p-1"
          aria-label="Pick form variant"
        >
          {(["A", "B"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setVariant(option)}
              className={`min-h-11 rounded-lg text-sm font-black ${variant === option ? "bg-white text-slate-950" : "text-slate-400"}`}
            >
              FORM {option}
            </button>
          ))}
        </div>
      </header>
      <p className="my-3 text-sm text-slate-400">
        Prototype data only. Switching forms preserves every selection.
      </p>
      {variant === "A" ? (
        <FormA picks={picks} updatePicks={setPicks} />
      ) : (
        <FormB picks={picks} updatePicks={setPicks} />
      )}
      <Summary picks={picks} setPicks={setPicks} />
    </main>
  );
}
