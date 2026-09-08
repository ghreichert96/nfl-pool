"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "../../lib/supabase/client";

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
  type Game,
  type Picks,
  type TeamPick,
  type TotalPick,
} from "./model";

const draftStorageKey = "hppp:2026:week-1:draft";
const selectedClass = "control-pressed";
const idleClass = "control-raised text-slate-100";

function isTeamSelected(pick: TeamPick | null, gameId: string, team: string) {
  return pick?.gameId === gameId && pick.team === team;
}

function resultClass(result?: "win" | "loss" | "tie") {
  if (result === "win") return "border-emerald-400 bg-emerald-700 text-white";
  if (result === "loss") return "border-red-400 bg-red-800 text-white";
  if (result === "tie") return "border-slate-400 bg-slate-600 text-white";
  return idleClass;
}

function badgeColorClass(badge: string) {
  const normalized = badge.toUpperCase();
  if (normalized === "TNF") return "bg-teal-400 text-slate-950";
  if (normalized === "INTL") return "bg-cyan-400 text-slate-950";
  if (normalized === "1 PM") return "bg-blue-400 text-slate-950";
  if (normalized === "4 PM") return "bg-orange-400 text-slate-950";
  if (normalized === "SNF") return "bg-violet-400 text-slate-950";
  if (normalized === "MNF") return "bg-fuchsia-400 text-slate-950";
  return "bg-amber-800 text-amber-50";
}

function liveResultClass(result?: "win" | "loss" | "tie") {
  if (result === "win")
    return "border-amber-400 bg-emerald-900/80 text-emerald-100";
  if (result === "loss") return "border-amber-400 bg-red-950/80 text-red-100";
  return "border-amber-400 bg-amber-950/80 text-amber-100";
}

function lockedControlClass(
  status: Game["status"],
  selected: boolean,
  result?: "win" | "loss" | "tie",
) {
  if (!selected) return "border-slate-700 bg-slate-900/70 text-slate-600";
  return status === "final" ? resultClass(result) : liveResultClass(result);
}

function standingForTeam(
  game: Game | undefined,
  team: string,
  kind: "ats" | "side",
) {
  if (!game) return undefined;
  if (game.status === "final") return teamResult(game, team, kind);
  if (game.status !== "live" || !game.score) return undefined;

  const away =
    kind === "ats" ? game.score.away + game.awaySpread : game.score.away;
  const home = game.score.home;
  const teamValue = team === game.away.abbreviation ? away : home;
  const opponentValue = team === game.away.abbreviation ? home : away;
  if (teamValue === opponentValue) return "tie" as const;
  return teamValue > opponentValue ? ("win" as const) : ("loss" as const);
}

function standingForTotal(
  game: Game | undefined,
  direction: TotalPick["direction"],
) {
  if (!game) return undefined;
  if (game.status === "final") return totalResult(game, direction);
  if (game.status !== "live" || !game.score) return undefined;

  const currentTotal = game.score.away + game.score.home;
  if (currentTotal === game.total) return "tie" as const;
  const over = currentTotal > game.total;
  return (direction === "over") === over ? ("win" as const) : ("loss" as const);
}

function previewResultClass(
  game: Game | undefined,
  result?: "win" | "loss" | "tie",
) {
  if (game?.status === "live") return liveResultClass(result);
  if (game?.status === "final") return resultClass(result);
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
  side,
  bestBet,
  onBestBet,
}: {
  game: Game;
  team: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  side: "away" | "home";
  bestBet: boolean;
  onBestBet: () => void;
}) {
  const status = game.status ?? "upcoming";
  const selectedStateClass =
    status === "live"
      ? `${liveResultClass(standingForTeam(game, team, "ats"))} shadow-[inset_0_3px_5px_rgb(0_0_0/0.5)]`
      : status === "final"
        ? resultClass(teamResult(game, team, "ats"))
        : selectedClass;

  return (
    <div className="relative w-full">
      <button
        type="button"
        aria-label={`${team} ${formatSpread(spreadFor(game, team))}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        className={`flex aspect-square w-full flex-col items-center justify-center rounded-lg border text-xs font-black transition-[transform,box-shadow,background-color] disabled:cursor-not-allowed ${!selected ? "disabled:opacity-35" : ""} ${selected ? selectedStateClass : idleClass}`}
      >
        <Logo abbreviation={team} />
        <span className="mt-1 leading-none">
          {formatSpread(spreadFor(game, team))}
        </span>
      </button>
      {selected && status === "upcoming" && (
        <button
          type="button"
          aria-label={
            bestBet
              ? `Remove ${team} as Best Bet in game row`
              : `Make ${team} Best Bet in game row`
          }
          aria-pressed={bestBet}
          onClick={onBestBet}
          className={`absolute top-1 z-10 grid size-5 place-items-center rounded-t-sm rounded-b-full border text-sm leading-none shadow-md ${side === "away" ? "-right-3.5" : "-left-3.5"} ${bestBet ? "border-amber-200 bg-amber-300 text-slate-950 shadow-[inset_0_2px_3px_rgb(0_0_0/0.35)]" : "control-raised text-slate-400"}`}
        >
          ♛
        </button>
      )}
    </div>
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
      className={`min-h-9 rounded-md border px-1 text-[11px] font-black leading-tight transition-[transform,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-45 ${selected ? selectedClass : idleClass} ${className}`}
    >
      {children}
    </button>
  );
}

function GameInfo({ game, picks }: { game: Game; picks: Picks }) {
  const status = game.status ?? "upcoming";
  const locked = status !== "upcoming";
  const favorite = favoriteFor(game);
  const underdog = underdogFor(game);
  const awayIsFavorite = favorite === game.away.abbreviation;
  const total = picks.totals.find((pick) => pick.gameId === game.id);
  const sdSelected = picks.suddenDeath?.gameId === game.id;
  const udSelected = picks.underdog?.gameId === game.id;
  const sdTeam = sdSelected ? picks.suddenDeath!.team : favorite;
  const lockedControls: Array<{
    label: string;
    selected: boolean;
    result: "win" | "loss" | "tie" | undefined;
  }> = [
    {
      label: `${sdTeam}·SD`,
      selected: sdSelected,
      result: standingForTeam(game, sdTeam, "side"),
    },
    {
      label: `O${game.total}`,
      selected: total?.direction === "over",
      result: standingForTotal(game, "over"),
    },
    {
      label: `U${game.total}`,
      selected: total?.direction === "under",
      result: standingForTotal(game, "under"),
    },
    {
      label: `${underdog}·UD`,
      selected: udSelected,
      result: standingForTeam(game, underdog, "side"),
    },
  ];
  if (!awayIsFavorite) {
    [lockedControls[0], lockedControls[3]] = [
      lockedControls[3],
      lockedControls[0],
    ];
  }

  return (
    <div
      className={`flex h-full min-w-0 flex-col items-center text-center ${locked ? "" : "justify-between py-0.5"}`}
    >
      <div className="flex items-center gap-1">
        <span
          className={`${badgeColorClass(game.badge)} rounded px-1.5 py-0.5 text-[9px] font-black`}
        >
          {game.badge}
        </span>
        <LockIcon locked={locked} />
        {locked && (
          <span className="whitespace-nowrap text-[10px] font-black uppercase text-amber-300">
            {status === "final" ? "Final" : game.score?.detail}
          </span>
        )}
      </div>
      {locked ? (
        <>
          <strong className="flex flex-1 items-center whitespace-nowrap text-[11px]">
            {game.away.abbreviation} {game.score?.away ?? 0} ·{" "}
            {game.home.abbreviation} {game.score?.home ?? 0}
          </strong>
          <div className="grid w-full grid-cols-4 gap-0.5">
            {lockedControls.map((pick) => (
              <span
                key={pick.label}
                className={`truncate rounded-sm border px-0.5 py-1 text-[8px] font-black ${lockedControlClass(status, pick.selected, pick.result)}`}
              >
                {pick.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <strong className="mt-0.5 whitespace-nowrap text-xs">
            {game.away.abbreviation} {formatSpread(game.awaySpread)} @{" "}
            {game.home.abbreviation}
          </strong>
          <span className="whitespace-nowrap text-[11px] text-slate-300">
            O/U {game.total}
          </span>
          <span className="max-w-full truncate whitespace-nowrap text-[9px] text-slate-400">
            {game.kickoff} · {game.location}
          </span>
        </>
      )}
    </div>
  );
}

function GameRow({
  game,
  picks,
  setPicks,
  usedSuddenDeathTeams,
}: {
  game: Game;
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
  usedSuddenDeathTeams: string[];
}) {
  const [sdUnderdog, setSdUnderdog] = useState(false);
  const [sdGestureActive, setSdGestureActive] = useState(false);
  const [sdGestureOverAlternate, setSdGestureOverAlternate] = useState(false);
  const sdHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sdLongPressFired = useRef(false);
  const sdGestureActiveRef = useRef(false);
  const sdGestureOverAlternateRef = useRef(false);
  const locked = (game.status ?? "upcoming") !== "upcoming";
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
  const sdTeamUsed = usedSuddenDeathTeams.includes(sdTeam);
  const udUnavailable = Boolean(
    picks.underdog && picks.underdog.gameId !== game.id,
  );

  function toggleAts(team: string) {
    setPicks((current) => {
      const nextAts = toggleTeamPick(current.ats, { gameId: game.id, team }, 6);
      const bestBetStillSelected = current.bestBet
        ? nextAts.some((pick) => pickKey(pick) === pickKey(current.bestBet!))
        : false;
      const replacementOnGame = nextAts.find((pick) => pick.gameId === game.id);
      let nextBestBet = bestBetStillSelected ? current.bestBet : null;

      if (current.bestBet && !bestBetStillSelected) {
        nextBestBet = replacementOnGame ?? nextAts[0] ?? null;
      }

      return {
        ...current,
        ats: nextAts,
        bestBet: nextBestBet,
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

  function selectSdTeam(team: string) {
    setSdUnderdog(team === underdog);
    setPicks((current) => ({
      ...current,
      suddenDeath: { gameId: game.id, team },
    }));
  }

  function resetSdGesture() {
    if (sdHoldTimer.current) clearTimeout(sdHoldTimer.current);
    sdHoldTimer.current = null;
    sdGestureActiveRef.current = false;
    sdGestureOverAlternateRef.current = false;
    setSdGestureActive(false);
    setSdGestureOverAlternate(false);
  }

  function startSdHold(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    sdLongPressFired.current = false;
    sdHoldTimer.current = setTimeout(() => {
      sdGestureActiveRef.current = true;
      setSdGestureActive(true);
      sdLongPressFired.current = true;
      navigator.vibrate?.(20);
    }, 400);
  }

  function moveSdHold(event: React.PointerEvent<HTMLButtonElement>) {
    if (!sdGestureActiveRef.current) return;
    const overAlternate =
      event.clientY < event.currentTarget.getBoundingClientRect().top;
    sdGestureOverAlternateRef.current = overAlternate;
    setSdGestureOverAlternate(overAlternate);
  }

  function finishSdHold() {
    if (sdHoldTimer.current) clearTimeout(sdHoldTimer.current);
    sdHoldTimer.current = null;
    if (!sdGestureActiveRef.current) return;

    const alternate = sdUnderdog ? favorite : underdog;
    selectSdTeam(sdGestureOverAlternateRef.current ? alternate : sdTeam);
    resetSdGesture();
  }

  return (
    <article
      className={`game-card rounded-xl border p-1.5 ${game.status === "live" ? "game-card-live" : ""} ${game.status === "final" ? "game-card-final" : ""}`}
    >
      <div className="grid grid-cols-[72px_minmax(100px,1fr)_72px] items-center gap-2">
        <TeamToggle
          game={game}
          team={game.away.abbreviation}
          selected={ats?.team === game.away.abbreviation}
          disabled={Boolean(locked || atsAtLimit)}
          onClick={() => toggleAts(game.away.abbreviation)}
          side="away"
          bestBet={isTeamSelected(
            picks.bestBet,
            game.id,
            game.away.abbreviation,
          )}
          onBestBet={() =>
            setPicks((current) => ({
              ...current,
              bestBet: isTeamSelected(
                current.bestBet,
                game.id,
                game.away.abbreviation,
              )
                ? null
                : { gameId: game.id, team: game.away.abbreviation },
            }))
          }
        />
        <GameInfo game={game} picks={picks} />
        <TeamToggle
          game={game}
          team={game.home.abbreviation}
          selected={ats?.team === game.home.abbreviation}
          disabled={Boolean(locked || atsAtLimit)}
          onClick={() => toggleAts(game.home.abbreviation)}
          side="home"
          bestBet={isTeamSelected(
            picks.bestBet,
            game.id,
            game.home.abbreviation,
          )}
          onBestBet={() =>
            setPicks((current) => ({
              ...current,
              bestBet: isTeamSelected(
                current.bestBet,
                game.id,
                game.home.abbreviation,
              )
                ? null
                : { gameId: game.id, team: game.home.abbreviation },
            }))
          }
        />
      </div>
      {!locked && (
        <div className="mt-1 grid grid-cols-4 gap-1">
          <SmallToggle
            className="order-2"
            label={`Over ${game.total}`}
            selected={total?.direction === "over"}
            disabled={Boolean(locked || totalsAtLimit)}
            onClick={() => toggleTotal("over")}
          >
            ▲ O {game.total}
          </SmallToggle>
          <SmallToggle
            className="order-3"
            label={`Under ${game.total}`}
            selected={total?.direction === "under"}
            disabled={Boolean(locked || totalsAtLimit)}
            onClick={() => toggleTotal("under")}
          >
            ▼ U {game.total}
          </SmallToggle>
          <div
            className={`relative min-h-9 rounded-md border transition-colors ${awayIsFavorite ? "order-1" : "order-4"} ${isTeamSelected(picks.suddenDeath, game.id, sdTeam) ? selectedClass : idleClass}`}
          >
            <button
              type="button"
              aria-label={`Sudden Death ${sdTeam}`}
              aria-pressed={isTeamSelected(picks.suddenDeath, game.id, sdTeam)}
              disabled={Boolean(locked || sdUnavailable || sdTeamUsed)}
              onPointerDown={startSdHold}
              onPointerMove={moveSdHold}
              onPointerUp={finishSdHold}
              onPointerCancel={resetSdGesture}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  selectSdTeam(sdUnderdog ? favorite : underdog);
                }
              }}
              onClick={() => {
                if (sdLongPressFired.current) {
                  sdLongPressFired.current = false;
                  return;
                }
                setPicks((current) => ({
                  ...current,
                  suddenDeath: isTeamSelected(
                    current.suddenDeath,
                    game.id,
                    sdTeam,
                  )
                    ? null
                    : { gameId: game.id, team: sdTeam },
                }));
              }}
              className="h-full min-h-9 w-full touch-none select-none text-[11px] font-black disabled:opacity-30"
            >
              {sdTeam} · SD{sdTeamUsed ? " · USED" : ""}
            </button>
            {sdGestureActive && (
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-[calc(100%+5px)] left-0 z-20 grid w-full place-items-center rounded border px-1 py-2 text-[10px] font-black shadow-xl transition-colors ${sdGestureOverAlternate ? "border-amber-200 bg-amber-300 text-slate-950" : "border-fuchsia-300 bg-slate-950 text-slate-100"}`}
              >
                {sdUnderdog ? favorite : underdog}
              </div>
            )}
          </div>
          <SmallToggle
            className={awayIsFavorite ? "order-4" : "order-1"}
            label={`Underdog ${underdog}`}
            selected={isTeamSelected(picks.underdog, game.id, underdog)}
            disabled={Boolean(locked || udUnavailable)}
            onClick={() =>
              setPicks((current) => ({
                ...current,
                underdog: isTeamSelected(current.underdog, game.id, underdog)
                  ? null
                  : { gameId: game.id, team: underdog },
              }))
            }
          >
            {underdog} · UD
          </SmallToggle>
        </div>
      )}
    </article>
  );
}

function teamResult(
  game: Game | undefined,
  team: string,
  kind: "ats" | "side",
) {
  if (game?.status !== "final" || !game.result) return undefined;
  const winner = kind === "ats" ? game.result.atsWinner : game.result.winner;
  if (winner === null) return "tie" as const;
  return winner === team ? ("win" as const) : ("loss" as const);
}

function totalResult(
  game: Game | undefined,
  direction: TotalPick["direction"],
) {
  if (game?.status !== "final" || !game.result) return undefined;
  if (game.result.totalWinner === null) return "tie" as const;
  return game.result.totalWinner === direction
    ? ("win" as const)
    : ("loss" as const);
}

function Preview({
  picks,
  setPicks,
  games,
  draftTarget,
  submitAction,
  initialComment,
  commentLocked,
  commentAction,
}: {
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
  games: Game[];
  draftTarget?: { entryId: number; weekId: number };
  submitAction?: (
    target: { entryId: number; weekId: number },
    picks: Picks,
  ) => Promise<{ ok: boolean; message: string }>;
  initialComment: string;
  commentLocked: boolean;
  commentAction?: (
    target: { entryId: number; weekId: number },
    body: string,
  ) => Promise<{ ok: boolean; message: string }>;
}) {
  const [message, setMessage] = useState(
    draftTarget ? "Draft saved" : "Draft saved on this device",
  );
  const [submittedDraft, setSubmittedDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(initialComment);
  const [savedComment, setSavedComment] = useState(initialComment);
  const [commentStatus, setCommentStatus] = useState("");
  const gameMap = useMemo(
    () => new Map(games.map((game) => [game.id, game])),
    [games],
  );
  const savedPicks = useMemo(
    () => (submittedDraft ? (JSON.parse(submittedDraft) as Picks) : null),
    [submittedDraft],
  );
  const serializedDraft = JSON.stringify(picks);
  const complete =
    picks.ats.length === 6 &&
    picks.totals.length === 3 &&
    Boolean(picks.bestBet && picks.suddenDeath && picks.underdog);
  const submitted = submittedDraft === serializedDraft;
  const modified = submittedDraft !== null && !submitted;
  const statusLabel = submitted
    ? "Submitted"
    : modified
      ? "Modified"
      : complete
        ? "Ready"
        : "In progress";
  const statusItems = [
    { label: `ATS ${picks.ats.length}/6`, filled: picks.ats.length === 6 },
    {
      label: `O/U ${picks.totals.length}/3`,
      filled: picks.totals.length === 3,
    },
    { label: "BB", filled: Boolean(picks.bestBet) },
    { label: "SD", filled: Boolean(picks.suddenDeath) },
    { label: "UD", filled: Boolean(picks.underdog) },
  ];

  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t-4 border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur">
      {showComment && (
        <div className="border-b border-slate-800 p-2">
          <label
            className="text-[10px] font-black uppercase tracking-wider text-slate-400"
            htmlFor="weekly-comment"
          >
            Weekly comment
          </label>
          <div className="mt-1 flex gap-1">
            <input
              id="weekly-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 40))}
              disabled={commentLocked}
              maxLength={40}
              placeholder="Talk a little trash…"
              className="control-raised min-h-10 min-w-0 flex-1 rounded-md border px-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setComment(savedComment);
                setShowComment(false);
              }}
              className="control-raised rounded-md border px-2 text-[10px] font-black"
            >
              CANCEL
            </button>
            <button
              type="button"
              disabled={commentLocked || !draftTarget || !commentAction}
              onClick={async () => {
                if (!draftTarget || !commentAction) return;
                const result = await commentAction(draftTarget, comment);
                setCommentStatus(result.message);
                if (result.ok) {
                  setSavedComment(comment.trim());
                  setShowComment(false);
                }
              }}
              className="control-pressed rounded-md border px-3 text-[10px] font-black"
            >
              SAVE
            </button>
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-slate-500">
            <span role="status">
              {commentLocked ? "Comments locked" : commentStatus}
            </span>
            <span>{comment.length}/40</span>
          </div>
        </div>
      )}
      <div className="space-y-1 px-2 py-1.5">
        <div
          className="grid grid-cols-[48px_repeat(6,minmax(0,1fr))] items-center gap-1"
          aria-label="ATS picks"
        >
          <span className="text-center text-[10px] font-black text-slate-400">
            ATS
          </span>
          {Array.from({ length: 6 }, (_, index) => {
            const pick = picks.ats[index];
            const removedGameId = savedPicks?.ats[index]?.gameId;
            const removedPick = Boolean(
              modified &&
              !pick &&
              removedGameId &&
              (gameMap.get(removedGameId)?.status ?? "upcoming") === "upcoming",
            );
            if (!pick)
              return (
                <span
                  key={index}
                  className={`size-9 justify-self-center rounded-full border border-dashed border-slate-700 ${removedPick ? "pick-modified" : ""}`}
                />
              );
            const bestBet = Boolean(
              picks.bestBet && pickKey(picks.bestBet) === pickKey(pick),
            );
            const savedAsAts = savedPicks?.ats.some(
              (savedPick) => pickKey(savedPick) === pickKey(pick),
            );
            const savedAsBestBet = Boolean(
              savedPicks?.bestBet &&
              pickKey(savedPicks.bestBet) === pickKey(pick),
            );
            const pickModified = Boolean(
              modified &&
              (gameMap.get(pick.gameId)?.status ?? "upcoming") === "upcoming" &&
              (!savedAsAts || bestBet !== savedAsBestBet),
            );
            return (
              <button
                key={pickKey(pick)}
                type="button"
                aria-label={`${pick.team}${bestBet ? ", Best Bet" : ", mark Best Bet"}`}
                aria-pressed={Boolean(bestBet)}
                style={
                  bestBet
                    ? { borderColor: "#fcd34d", borderWidth: "2px" }
                    : undefined
                }
                onClick={() =>
                  setPicks((current) => ({
                    ...current,
                    bestBet: bestBet ? null : pick,
                  }))
                }
                className={`relative grid size-9 justify-self-center place-items-center rounded-full border text-[10px] font-black ${previewResultClass(gameMap.get(pick.gameId), standingForTeam(gameMap.get(pick.gameId), pick.team, "ats"))} ${pickModified ? "pick-modified" : ""}`}
              >
                {bestBet && (
                  <span className="absolute -top-1 text-xs text-amber-300">
                    ♛
                  </span>
                )}
                {pick.team}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[48px_48px_repeat(3,minmax(0,1fr))] gap-1 text-[9px] font-black">
          <span
            aria-label={
              picks.suddenDeath
                ? `${picks.suddenDeath.team} Sudden Death`
                : "Sudden Death not selected"
            }
            className={`truncate rounded-full border px-1 py-1 text-center ${picks.suddenDeath ? previewResultClass(gameMap.get(picks.suddenDeath.gameId), standingForTeam(gameMap.get(picks.suddenDeath.gameId), picks.suddenDeath.team, "side")) : "border-dashed border-slate-700 text-slate-600"} ${modified && (gameMap.get(picks.suddenDeath?.gameId ?? savedPicks?.suddenDeath?.gameId ?? "")?.status ?? "upcoming") === "upcoming" && pickKey(picks.suddenDeath ?? { gameId: "", team: "" }) !== pickKey(savedPicks?.suddenDeath ?? { gameId: "", team: "" }) ? "pick-modified" : ""}`}
          >
            {picks.suddenDeath?.team ?? "—"}·SD
          </span>
          <span
            aria-label={
              picks.underdog
                ? `${picks.underdog.team} Underdog`
                : "Underdog not selected"
            }
            className={`truncate rounded-full border px-1 py-1 text-center ${picks.underdog ? previewResultClass(gameMap.get(picks.underdog.gameId), standingForTeam(gameMap.get(picks.underdog.gameId), picks.underdog.team, "side")) : "border-dashed border-slate-700 text-slate-600"} ${modified && (gameMap.get(picks.underdog?.gameId ?? savedPicks?.underdog?.gameId ?? "")?.status ?? "upcoming") === "upcoming" && pickKey(picks.underdog ?? { gameId: "", team: "" }) !== pickKey(savedPicks?.underdog ?? { gameId: "", team: "" }) ? "pick-modified" : ""}`}
          >
            {picks.underdog?.team ?? "—"}·UD
          </span>
          {Array.from({ length: 3 }, (_, index) => {
            const pick = picks.totals[index];
            if (!pick) {
              const removedPick = Boolean(
                modified &&
                savedPicks?.totals[index] &&
                (gameMap.get(savedPicks.totals[index].gameId)?.status ??
                  "upcoming") === "upcoming",
              );
              return (
                <span
                  key={index}
                  className={`truncate rounded-full border border-dashed border-slate-700 px-0.5 py-1 text-center text-slate-600 ${removedPick ? "pick-modified" : ""}`}
                >
                  O/U
                </span>
              );
            }
            const game = gameMap.get(pick.gameId);
            const pickModified = Boolean(
              modified &&
              (game?.status ?? "upcoming") === "upcoming" &&
              !savedPicks?.totals.some(
                (savedPick) =>
                  savedPick.gameId === pick.gameId &&
                  savedPick.direction === pick.direction,
              ),
            );
            return (
              <span
                key={pick.gameId}
                aria-label={`${game?.away.abbreviation} at ${game?.home.abbreviation}, ${pick.direction}`}
                className={`truncate rounded-full border px-0.5 py-1 text-center ${previewResultClass(game, standingForTotal(game, pick.direction))} ${pickModified ? "pick-modified" : ""}`}
              >
                {game?.away.abbreviation} {game?.home.abbreviation}{" "}
                {pick.direction === "over" ? "O" : "U"}
              </span>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-[48px_1fr_minmax(112px,1.25fr)] border-t border-slate-800">
        <div className="grid grid-rows-2 border-r border-slate-800">
          <button
            type="button"
            aria-label="Edit weekly comment"
            aria-expanded={showComment}
            onClick={() => setShowComment((value) => !value)}
            className={`grid place-items-center border-b border-slate-800 ${savedComment ? "text-cyan-300" : "text-slate-400"}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 5h14v10H9l-4 4V5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              setPicks(EMPTY_PICKS);
              setSubmittedDraft(null);
              setMessage("Draft cleared");
            }}
            className="text-[10px] font-bold text-slate-300 underline"
          >
            Clear
          </button>
        </div>
        <div
          aria-label={submitted ? "Submission saved" : "Submission status"}
          className={`flex flex-wrap content-center gap-1 px-1.5 py-1 text-[9px] font-black transition-colors ${submitted && complete ? "bg-emerald-800" : submitted ? "bg-amber-950" : modified ? "bg-fuchsia-950" : "bg-slate-900"}`}
        >
          {statusItems.map((item) => (
            <span
              key={item.label}
              className={`rounded border px-1 py-0.5 ${submitted && item.filled ? "border-transparent bg-emerald-600/80 text-white" : item.filled ? "border-fuchsia-300 bg-fuchsia-900 text-fuchsia-100" : "border-amber-400 bg-amber-950 text-amber-200"}`}
            >
              {item.label}
            </span>
          ))}
          <span
            className={`ml-auto flex min-w-16 flex-col justify-center self-stretch px-1 text-center leading-none ${submitted ? "text-emerald-200" : modified ? "text-fuchsia-200" : complete ? "text-cyan-200" : "text-amber-200"}`}
          >
            <strong>{statusLabel}</strong>
            {submitted && picks.bestBet && (
              <small className="mt-0.5 text-[8px] font-medium">
                (BB = {picks.bestBet.team})
              </small>
            )}
          </span>
          <span role="status" className="sr-only">
            {message}
          </span>
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            const nextPicks =
              !picks.bestBet && picks.ats[0]
                ? { ...picks, bestBet: picks.ats[0] }
                : picks;
            setPicks(nextPicks);

            if (draftTarget && submitAction) {
              setSubmitting(true);
              const result = await submitAction(draftTarget, nextPicks);
              setSubmitting(false);
              setMessage(result.message);
              if (!result.ok) return;
            }

            setSubmittedDraft(JSON.stringify(nextPicks));
            if (!draftTarget) setMessage("Demo submission recorded");
          }}
          className="min-h-12 bg-emerald-500 px-3 text-lg font-black text-slate-950 shadow-[inset_0_-3px_0_rgb(5_90_65/0.55)] active:shadow-[inset_0_3px_5px_rgb(5_46_22/0.55)] disabled:opacity-60"
        >
          {submitting ? "SAVING" : submitted ? "SAVED" : "SUBMIT"}
        </button>
      </div>
    </aside>
  );
}

type PicksExperienceProps = {
  games?: Game[];
  initialPicks?: Picks;
  draftTarget?: { entryId: number; weekId: number };
  entryCode?: string;
  weekNumber?: number;
  submitAction?: (
    target: { entryId: number; weekId: number },
    picks: Picks,
  ) => Promise<{ ok: boolean; message: string }>;
  initialComment?: string;
  commentLocked?: boolean;
  commentAction?: (
    target: { entryId: number; weekId: number },
    body: string,
  ) => Promise<{ ok: boolean; message: string }>;
  usedSuddenDeathTeams?: string[];
};

export function PicksExperience({
  games = MOCK_GAMES,
  initialPicks = EMPTY_PICKS,
  draftTarget,
  entryCode = "HARR",
  weekNumber = 1,
  submitAction,
  initialComment = "",
  commentLocked = false,
  commentAction,
  usedSuddenDeathTeams = [],
}: PicksExperienceProps) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [showHelp, setShowHelp] = useState(false);
  const [draftReady, setDraftReady] = useState(Boolean(draftTarget));

  useEffect(() => {
    if (draftTarget) return;
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
  }, [draftTarget]);

  useEffect(() => {
    if (!draftReady) return;
    if (!draftTarget) {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(picks));
      return;
    }

    const timer = window.setTimeout(async () => {
      const { error } = await createClient().from("weekly_drafts").upsert(
        {
          entry_id: draftTarget.entryId,
          week_id: draftTarget.weekId,
          payload: picks,
          schema_version: 1,
        },
        { onConflict: "entry_id,week_id" },
      );
      if (error) console.error("Draft save failed", error.message);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draftReady, draftTarget, picks]);

  return (
    <main className="pick-shell gunmetal mx-auto min-h-screen max-w-2xl bg-slate-950 px-2 pb-[136px] text-slate-100">
      <header className="sticky top-0 z-30 -mx-2 border-b border-slate-700 bg-slate-950/95 px-2 pt-1 backdrop-blur">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300">
            HPPP · 2026 · {entryCode}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Pool information"
              aria-expanded={showHelp}
              onClick={() => setShowHelp((value) => !value)}
              className="control-raised grid size-6 place-items-center rounded-full border text-xs font-black"
            >
              i
            </button>
            <Link
              href="/account"
              aria-label="Profile"
              className="control-raised grid size-6 place-items-center rounded-full border"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="3.25" />
                <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
              </svg>
            </Link>
          </div>
        </div>
        <nav
          className="grid grid-cols-3 border-b border-slate-600"
          aria-label="Primary"
        >
          <Link
            href="/"
            aria-current="page"
            className="grid min-h-7 place-items-center border-x border-t border-slate-600 bg-slate-100 text-[10px] font-black text-slate-950"
          >
            HOME
          </Link>
          <Link
            href="/standings"
            className="grid min-h-7 place-items-center border-x border-t border-slate-600 bg-slate-900 text-[10px] font-black text-slate-400"
          >
            STANDINGS
          </Link>
          <Link
            href="/rules"
            className="grid min-h-7 place-items-center border-x border-t border-slate-600 bg-slate-900 text-[10px] font-black text-slate-400"
          >
            RULES
          </Link>
        </nav>
        <div className="flex items-center justify-between gap-1 py-1">
          <div className="grid flex-1 grid-cols-2 rounded-lg border border-slate-600 bg-slate-900 p-0.5">
            <span className="control-pressed grid min-h-6 place-items-center rounded text-[10px] font-black uppercase">
              Picks
            </span>
            <Link
              href="/grid"
              className="grid min-h-6 place-items-center rounded text-[10px] font-black uppercase text-slate-400"
            >
              Grid
            </Link>
          </div>
          <select
            aria-label="Week"
            className="min-h-7 rounded border border-slate-600 bg-slate-950 px-2 text-[10px] font-black"
            defaultValue={String(weekNumber)}
          >
            <option value={String(weekNumber)}>Week {weekNumber}</option>
          </select>
        </div>
        {showHelp && (
          <div className="mb-1 rounded border border-fuchsia-400 bg-slate-900 px-2 py-1.5 text-[10px] leading-4 text-slate-200">
            Pick 6 ATS and 3 totals. Use a crown or tap a preview logo to choose
            BB; if omitted, your first ATS becomes BB when submitted. Choose one
            SD and one UD. Hold SD and slide up to switch its team. Submit after
            every change. Each game locks at its scheduled kickoff.
          </div>
        )}
      </header>
      <>
        <section
          className="mt-1.5 space-y-2"
          aria-label={`Week ${weekNumber} games`}
        >
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              picks={picks}
              setPicks={setPicks}
              usedSuddenDeathTeams={usedSuddenDeathTeams}
            />
          ))}
        </section>
        <Preview
          picks={picks}
          setPicks={setPicks}
          games={games}
          draftTarget={draftTarget}
          submitAction={submitAction}
          initialComment={initialComment}
          commentLocked={commentLocked}
          commentAction={commentAction}
        />
      </>
    </main>
  );
}
