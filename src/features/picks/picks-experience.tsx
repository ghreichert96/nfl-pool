"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { WeekSelector } from "@/components/week-selector";
import { CompactPageHeader } from "@/components/compact-page-header";
import { PREVIEW_MINIMIZED_KEY } from "@/components/profile-preferences";
import { createClient } from "../../lib/supabase/client";
import { preserveLockedPicks } from "./submission";

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

function serializePicks(picks: Picks) {
  return JSON.stringify({
    ats: [...picks.ats].sort(
      (a, b) =>
        a.gameId.localeCompare(b.gameId) || a.team.localeCompare(b.team),
    ),
    totals: [...picks.totals].sort(
      (a, b) =>
        a.gameId.localeCompare(b.gameId) ||
        a.direction.localeCompare(b.direction),
    ),
    bestBet: picks.bestBet,
    suddenDeath: picks.suddenDeath,
    underdog: picks.underdog,
  });
}

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
  if (normalized === "SPE" || normalized === "HOL")
    return "bg-amber-300 text-slate-950";
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

function ResultMark({ result }: { result?: "win" | "loss" | "tie" }) {
  if (!result) return null;
  return (
    <span
      aria-label={`${result} result`}
      title={result}
      className={`pointer-events-none font-black leading-none ${result === "win" ? "text-emerald-300" : result === "loss" ? "text-red-300" : "text-amber-300"}`}
    >
      {result === "win" ? "✓" : result === "loss" ? "✕" : "—"}
    </span>
  );
}

function HeaderStatusIcon({
  kind,
  state,
}: {
  kind: "lines" | "picks";
  state: "open" | "frozen" | "empty" | "modified" | "submitted";
}) {
  if (kind === "lines" && state === "frozen")
    return <span aria-hidden="true">❄</span>;
  if (kind === "lines")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 6h10v7H3zM5 6V4.5a3 3 0 0 1 5.7-1.3" />
      </svg>
    );
  if (state === "submitted") return <span aria-hidden="true">✓</span>;
  if (state === "modified") return <span aria-hidden="true">~</span>;
  return <span aria-hidden="true">○</span>;
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

function Logo({
  abbreviation,
  logoUrl,
  compact = false,
}: {
  abbreviation: string;
  logoUrl?: string | null;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`team-logo grid shrink-0 place-items-center rounded-full border-2 text-[11px] font-black ${compact ? "size-8" : "size-10"}`}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={compact ? 26 : 32}
          height={compact ? 26 : 32}
          unoptimized
          className={`${compact ? "size-7" : "size-8"} object-contain`}
        />
      ) : (
        abbreviation
      )}
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

function CrownIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 18"
      className={className}
      fill="currentColor"
    >
      <path d="M2 4l5 5 5-8 5 8 5-5-2 12H4L2 4Z" />
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
        {status === "final" && (
          <span className="absolute top-1 right-1 text-[11px]">
            <ResultMark result={teamResult(game, team, "ats")} />
          </span>
        )}
        <Logo
          abbreviation={team}
          logoUrl={
            (team === game.away.abbreviation ? game.away : game.home).logoUrl
          }
        />
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
          className={`absolute -top-1 z-10 grid size-6 place-items-center rounded-t-sm rounded-b-full border leading-none shadow-md ${side === "away" ? "-right-4" : "-left-4"} ${bestBet ? "border-amber-100 bg-amber-300 text-slate-950 shadow-[inset_0_2px_3px_rgb(0_0_0/0.35)]" : "control-raised text-slate-300"}`}
        >
          <CrownIcon />
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
        {!locked && game.lineFrozen && (
          <span className="text-[8px] font-black uppercase text-amber-300">
            Line frozen
          </span>
        )}
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
                <span className="inline-flex items-center gap-0.5">
                  {pick.label}
                  {status === "final" && <ResultMark result={pick.result} />}
                </span>
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
            {game.kickoff}
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
  const [sdDisplayOverride, setSdDisplayOverride] = useState<string | null>(
    null,
  );
  const [sdFlipping, setSdFlipping] = useState(false);
  const sdHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sdFlipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sdLastTapAt = useRef(0);
  const sdLongPressFired = useRef(false);
  const locked = (game.status ?? "upcoming") !== "upcoming";
  const ats = picks.ats.find((pick) => pick.gameId === game.id);
  const total = picks.totals.find((pick) => pick.gameId === game.id);
  const favorite = favoriteFor(game);
  const underdog = underdogFor(game);
  const selectedSdTeam =
    picks.suddenDeath?.gameId === game.id ? picks.suddenDeath.team : favorite;
  const sdTeam = sdDisplayOverride ?? selectedSdTeam;
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
      let nextBestBet = bestBetStillSelected ? current.bestBet : null;

      if (current.bestBet && !bestBetStillSelected) {
        nextBestBet = null;
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

  function toggleSdTeam(team: string) {
    setPicks((current) => ({
      ...current,
      suddenDeath: isTeamSelected(current.suddenDeath, game.id, team)
        ? null
        : { gameId: game.id, team },
    }));
  }

  function switchDisplayedSdTeam() {
    setSdDisplayOverride(sdTeam === favorite ? underdog : favorite);
    setPicks((current) => ({ ...current, suddenDeath: null }));
    setSdFlipping(true);
    if (sdFlipTimer.current) clearTimeout(sdFlipTimer.current);
    sdFlipTimer.current = setTimeout(() => setSdFlipping(false), 300);
  }

  function cancelSdHold() {
    if (sdHoldTimer.current) clearTimeout(sdHoldTimer.current);
    sdHoldTimer.current = null;
  }

  function startSdHold(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    sdLongPressFired.current = false;
    sdHoldTimer.current = setTimeout(() => {
      switchDisplayedSdTeam();
      sdLongPressFired.current = true;
      navigator.vibrate?.(20);
    }, 400);
  }

  useEffect(
    () => () => {
      if (sdHoldTimer.current) clearTimeout(sdHoldTimer.current);
      if (sdFlipTimer.current) clearTimeout(sdFlipTimer.current);
    },
    [],
  );

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
            className={`relative min-h-9 rounded-md border transition-colors ${awayIsFavorite ? "order-1" : "order-4"} ${sdUnavailable ? "opacity-45" : ""} ${isTeamSelected(picks.suddenDeath, game.id, sdTeam) ? selectedClass : idleClass}`}
          >
            <button
              type="button"
              aria-label={`Sudden Death ${sdTeam}`}
              title="Double-tap or press and hold to show the other team"
              aria-pressed={isTeamSelected(picks.suddenDeath, game.id, sdTeam)}
              disabled={Boolean(locked || sdUnavailable)}
              onPointerDown={startSdHold}
              onPointerUp={cancelSdHold}
              onPointerCancel={cancelSdHold}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  switchDisplayedSdTeam();
                }
              }}
              onClick={() => {
                if (sdLongPressFired.current) {
                  sdLongPressFired.current = false;
                  return;
                }
                const now = performance.now();
                if (
                  sdLastTapAt.current > 0 &&
                  now - sdLastTapAt.current <= 240
                ) {
                  sdLastTapAt.current = 0;
                  switchDisplayedSdTeam();
                  return;
                }
                sdLastTapAt.current = now;
                if (!sdTeamUsed) toggleSdTeam(sdTeam);
              }}
              className={`h-full min-h-9 w-full touch-manipulation select-none text-[11px] font-black disabled:opacity-30 ${sdFlipping ? "sd-card-flip" : ""}`}
            >
              {sdTeam} · SD{sdTeamUsed ? " · USED" : ""}
            </button>
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

function WeeklyCommentEditor({
  draftTarget,
  initialComment,
  locked,
  action,
}: {
  draftTarget?: { entryId: number; weekId: number };
  initialComment: string;
  locked: boolean;
  action?: (
    target: { entryId: number; weekId: number },
    body: string,
  ) => Promise<{ ok: boolean; message: string }>;
}) {
  const [comment, setComment] = useState(initialComment);
  const [savedComment, setSavedComment] = useState(initialComment);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const changed = comment.trim() !== savedComment;

  return (
    <section
      className="game-card rounded-xl border p-3"
      aria-label="Weekly comment"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          htmlFor="weekly-comment"
          className="text-xs font-black uppercase"
        >
          Weekly comment
        </label>
        <span
          className={
            savedComment && !changed
              ? "text-[10px] text-emerald-400"
              : "text-[10px] text-slate-500"
          }
        >
          {saving
            ? "Saving…"
            : savedComment && !changed
              ? "Comment saved."
              : `${comment.length}/40`}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          id="weekly-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 40))}
          disabled={locked}
          maxLength={40}
          placeholder="Talk a little trash…"
          className={`control-raised min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-base ${savedComment ? "border-emerald-600 bg-emerald-950/30" : ""}`}
        />
        <button
          type="button"
          aria-label="Save weekly comment"
          disabled={locked || saving || !changed || !draftTarget || !action}
          onClick={async () => {
            if (!draftTarget || !action) return;
            setSaving(true);
            const result = await action(draftTarget, comment);
            setSaving(false);
            setStatus(result.message);
            if (result.ok) setSavedComment(comment.trim());
          }}
          className={`control-pressed grid size-11 shrink-0 place-items-center rounded-lg border disabled:opacity-40 ${savedComment && !changed ? "border-emerald-400 bg-emerald-700 text-white" : ""}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12.5 4.2 4.2L19 7" />
          </svg>
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span role="status" className="text-[10px] text-slate-500">
          {locked
            ? "Comments locked after the final kickoff"
            : status && !status.toLowerCase().includes("saved")
              ? status
              : "Optional · visible immediately"}
        </span>
      </div>
    </section>
  );
}

function StatusBadge({
  item,
  submitted,
}: {
  item: { label: string; filled: boolean };
  submitted: boolean;
}) {
  return (
    <span
      className={`rounded border px-1 py-0.5 ${submitted && item.filled ? "border-transparent bg-emerald-600/80 text-white" : item.filled ? "border-fuchsia-300 bg-fuchsia-900 text-fuchsia-100" : "border-amber-400 bg-amber-950 text-amber-200"}`}
    >
      {item.label}
    </span>
  );
}

function Preview({
  picks,
  setPicks,
  games,
  draftTarget,
  submitAction,
  submittedDraft,
  setSubmittedDraft,
}: {
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
  games: Game[];
  draftTarget?: { entryId: number; weekId: number };
  submitAction?: (
    target: { entryId: number; weekId: number },
    picks: Picks,
  ) => Promise<{ ok: boolean; message: string }>;
  submittedDraft: string | null;
  setSubmittedDraft: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [message, setMessage] = useState(
    draftTarget ? "Draft saved" : "Draft saved on this device",
  );
  const [submitting, setSubmitting] = useState(false);
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device preference is browser-only
    setMinimized(window.localStorage.getItem(PREVIEW_MINIMIZED_KEY) === "true");
  }, []);
  const gameMap = useMemo(
    () => new Map(games.map((game) => [game.id, game])),
    [games],
  );
  const savedPicks = useMemo(
    () => (submittedDraft ? (JSON.parse(submittedDraft) as Picks) : null),
    [submittedDraft],
  );
  const serializedDraft = serializePicks(picks);
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
      : "Not Submitted";
  const mainStatusItems = [
    { label: `ATS ${picks.ats.length}/6`, filled: picks.ats.length === 6 },
    {
      label: `O/U ${picks.totals.length}/3`,
      filled: picks.totals.length === 3,
    },
    { label: "BB", filled: Boolean(picks.bestBet) },
  ];
  const sideStatusItems = [
    { label: "UD", filled: Boolean(picks.underdog) },
    { label: "SD", filled: Boolean(picks.suddenDeath) },
  ];

  return (
    <aside className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-2xl border-t-4 border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur sm:bottom-0">
      {minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand picks preview"
          className="absolute -top-7 left-3 z-10 grid h-6 w-9 place-items-center rounded-t-md border-x border-t border-slate-600 bg-slate-950 text-base leading-none text-slate-200 shadow-[0_-2px_5px_rgb(0_0_0/0.35)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-4 translate-y-px"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m4 12 6-6 6 6" />
          </svg>
        </button>
      )}
      {!minimized && (
        <div className="relative space-y-1 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize picks preview"
            className="absolute top-0 left-3 z-10 grid h-6 w-9 place-items-center rounded-b-md border-x border-b border-slate-600 bg-slate-950 text-base leading-none text-slate-200 shadow-md"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-4 -translate-y-px"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m4 8 6 6 6-6" />
            </svg>
          </button>
          <div
            className="grid grid-cols-[48px_repeat(6,minmax(0,1fr))] items-center gap-0.5 pt-1.5"
            aria-label="Main picks"
          >
            <span aria-hidden="true" />
            {Array.from({ length: 6 }, (_, index) => {
              const pick = picks.ats[index];
              const removedGameId = savedPicks?.ats[index]?.gameId;
              const removedPick = Boolean(
                modified &&
                !pick &&
                removedGameId &&
                (gameMap.get(removedGameId)?.status ?? "upcoming") ===
                  "upcoming",
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
                (gameMap.get(pick.gameId)?.status ?? "upcoming") ===
                  "upcoming" &&
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
                    <span className="absolute -top-2.5 z-10 text-amber-300 drop-shadow-[0_1px_1px_#000]">
                      <CrownIcon className="h-3.5 w-5" />
                    </span>
                  )}
                  <Logo
                    abbreviation={pick.team}
                    compact
                    logoUrl={
                      (pick.team === gameMap.get(pick.gameId)?.away.abbreviation
                        ? gameMap.get(pick.gameId)?.away
                        : gameMap.get(pick.gameId)?.home
                      )?.logoUrl
                    }
                  />
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_48px_48px] gap-1 text-[9px] font-black">
            {Array.from({ length: 3 }, (_, index) => {
              const pick = picks.totals[index];
              if (!pick)
                return (
                  <span
                    key={index}
                    className="truncate rounded-full border border-dashed border-slate-700 px-0.5 py-1 text-center text-slate-600"
                  >
                    OU{index + 1}
                  </span>
                );
              const game = gameMap.get(pick.gameId);
              return (
                <span
                  key={pick.gameId}
                  aria-label={`${game?.away.abbreviation} at ${game?.home.abbreviation}, ${pick.direction}`}
                  className={`truncate rounded-full border px-0.5 py-1 text-center ${previewResultClass(game, standingForTotal(game, pick.direction))}`}
                >
                  {game?.away.abbreviation}/{game?.home.abbreviation}{" "}
                  {pick.direction === "over" ? "O" : "U"}
                </span>
              );
            })}
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
            <span
              aria-label={
                picks.suddenDeath
                  ? `${picks.suddenDeath.team} Sudden Death`
                  : "Sudden Death not selected"
              }
              className={`truncate rounded-full border px-1 py-1 text-center ${picks.suddenDeath ? previewResultClass(gameMap.get(picks.suddenDeath.gameId), standingForTeam(gameMap.get(picks.suddenDeath.gameId), picks.suddenDeath.team, "side")) : "border-dashed border-slate-700 text-slate-600"}`}
            >
              {picks.suddenDeath?.team ?? "—"}·SD
            </span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-[52px_1fr_minmax(112px,1.25fr)] border-t border-slate-800">
        <div className="flex flex-col justify-center gap-1 border-r border-slate-800 px-1">
          <button
            type="button"
            onClick={() => {
              setPicks((current) =>
                preserveLockedPicks(EMPTY_PICKS, current, games),
              );
              setMessage("Draft cleared");
            }}
            className="text-[10px] font-bold text-slate-300 underline"
          >
            Clear
          </button>
          {savedPicks && modified && (
            <button
              type="button"
              onClick={() => {
                setPicks(savedPicks);
                setMessage("Submission restored");
              }}
              className="border-t border-slate-800 pt-1 text-[9px] font-bold text-cyan-300 underline"
            >
              Revert
            </button>
          )}
        </div>
        <div
          aria-label={submitted ? "Submission saved" : "Submission status"}
          className={`flex flex-wrap content-center gap-1 px-1.5 py-1 text-[9px] font-black transition-colors ${submitted && complete ? "bg-emerald-800" : submitted ? "bg-amber-950" : modified ? "bg-fuchsia-950" : "bg-slate-900"}`}
        >
          <div className="grid gap-0.5">
            <div className="flex gap-1">
              {mainStatusItems.map((item) => (
                <StatusBadge
                  key={item.label}
                  item={item}
                  submitted={submitted}
                />
              ))}
            </div>
            <div className="flex gap-1">
              {sideStatusItems.map((item) => (
                <StatusBadge
                  key={item.label}
                  item={item}
                  submitted={submitted}
                />
              ))}
              <span
                className={`self-center whitespace-nowrap px-1 text-[9px] leading-none ${submitted ? "text-emerald-200" : modified ? "text-fuchsia-200" : complete ? "text-cyan-200" : "text-amber-200"}`}
              >
                <strong>{statusLabel}</strong>
                {submitted && picks.bestBet
                  ? ` (BB = ${picks.bestBet.team})`
                  : ""}
              </span>
            </div>
          </div>
          <span role="status" className="sr-only">
            {message}
          </span>
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (draftTarget && submitAction) {
              setSubmitting(true);
              const result = await submitAction(draftTarget, picks);
              setSubmitting(false);
              setMessage(result.message);
              if (!result.ok) return;
            }

            setSubmittedDraft(serializePicks(picks));
            if (!draftTarget) setMessage("Demo submission recorded");
          }}
          className={`min-h-12 px-3 text-lg font-black shadow-[inset_0_-3px_0_rgb(5_90_65/0.55)] active:shadow-[inset_0_3px_5px_rgb(5_46_22/0.55)] disabled:opacity-60 ${submitted ? "bg-emerald-500 text-slate-950" : "bg-emerald-600 text-white"}`}
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
  weeks?: { week_number: number; label: string }[];
  linesFrozen?: boolean;
  initialSubmittedPicks?: Picks;
  scoreFreshness?: { label: string; stale: boolean };
};

export function PicksExperience({
  games = MOCK_GAMES,
  initialPicks = EMPTY_PICKS,
  draftTarget,
  weekNumber = 1,
  submitAction,
  initialComment = "",
  commentLocked = false,
  commentAction,
  usedSuddenDeathTeams = [],
  weeks = [{ week_number: weekNumber, label: `Week ${weekNumber}` }],
  linesFrozen = false,
  initialSubmittedPicks,
  scoreFreshness,
}: PicksExperienceProps) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [submittedDraft, setSubmittedDraft] = useState<string | null>(
    initialSubmittedPicks ? serializePicks(initialSubmittedPicks) : null,
  );
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

  const hasDraftSelections =
    picks.ats.length > 0 ||
    picks.totals.length > 0 ||
    Boolean(picks.bestBet || picks.suddenDeath || picks.underdog);
  const pickStatus =
    submittedDraft !== null
      ? "Submitted"
      : hasDraftSelections
        ? "Modified"
        : "Not Submitted";
  return (
    <div className="mx-auto max-w-2xl px-2 pb-[calc(12rem+env(safe-area-inset-bottom))] sm:pb-36">
      <CompactPageHeader
        sticky
        className="-mx-2"
        title={
          <span className="flex min-w-0 items-center gap-1 text-[9px] font-black uppercase">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 ${linesFrozen ? "border-amber-600 text-amber-300" : "border-cyan-700 text-cyan-300"}`}
            >
              <HeaderStatusIcon
                kind="lines"
                state={linesFrozen ? "frozen" : "open"}
              />
              {linesFrozen ? "Frozen" : "Open"}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 ${pickStatus === "Submitted" ? "border-emerald-700 text-emerald-300" : pickStatus === "Modified" ? "border-fuchsia-700 text-fuchsia-300" : "border-slate-700 text-slate-300"}`}
            >
              <HeaderStatusIcon
                kind="picks"
                state={
                  pickStatus === "Submitted"
                    ? "submitted"
                    : pickStatus === "Modified"
                      ? "modified"
                      : "empty"
                }
              />
              {pickStatus}
            </span>
            {scoreFreshness && (
              <span
                className={`whitespace-nowrap text-[8px] normal-case tracking-normal ${scoreFreshness.stale ? "text-amber-300" : "text-slate-400"}`}
              >
                {scoreFreshness.label}
              </span>
            )}
          </span>
        }
        action={<WeekSelector weeks={weeks} selected={weekNumber} />}
      />
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
        <WeeklyCommentEditor
          draftTarget={draftTarget}
          initialComment={initialComment}
          locked={commentLocked}
          action={commentAction}
        />
      </section>
      <Preview
        picks={picks}
        setPicks={setPicks}
        games={games}
        draftTarget={draftTarget}
        submitAction={submitAction}
        submittedDraft={submittedDraft}
        setSubmittedDraft={setSubmittedDraft}
      />
    </div>
  );
}
