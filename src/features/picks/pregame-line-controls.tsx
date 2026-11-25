"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { editPregameLine } from "./edit-pregame-line-action";
import { formatSpread, type Game } from "./model";

export function PregameLineLock({
  game,
  children,
}: {
  game: Game;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const locked = Boolean(game.lineFrozen);
  const matchup = `${game.away.abbreviation} at ${game.home.abbreviation}`;
  return (
    <>
      <button
        type="button"
        aria-label={`${locked ? "Unlock" : "Lock"} lines for ${matchup}`}
        title={locked ? "Unlock lines" : "Lock lines"}
        className="control-raised inline-grid size-6 place-items-center rounded border"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const result = await editPregameLine(Number(game.id), {
                locked: !locked,
              });
              if (!result.ok) setError(result.message);
            } catch {
              setError("Line change could not be saved.");
            }
          });
        }}
      >
        {children}
      </button>
      {error && (
        <span role="alert" className="text-[10px] text-red-400">
          {error}
        </span>
      )}
    </>
  );
}

export function PregameLineEditor({
  game,
  children,
}: {
  game: Game;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Edit lines for ${game.away.abbreviation} at ${game.home.abbreviation}`}
        aria-haspopup="dialog"
        className="rounded px-0.5 hover:bg-slate-500/15 focus-visible:outline-2 focus-visible:outline-sky-500"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && <LineEditorDialog game={game} onClose={() => setOpen(false)} />}
    </>
  );
}

function LineEditorDialog({
  game,
  onClose,
}: {
  game: Game;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [spread, setSpread] = useState(game.awaySpread);
  const [total, setTotal] = useState(game.total);
  const [updatedAt] = useState(game.lineUpdatedAt);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      aria-labelledby="pregame-line-title"
      className="game-card fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-sm rounded-xl border p-4 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/65"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <h2 id="pregame-line-title" className="mb-3 text-sm font-black">
        Edit matchup lines
      </h2>
      <form
        action={() => {
          if (!updatedAt) return;
          setError("");
          startTransition(async () => {
            try {
              const result = await editPregameLine(Number(game.id), {
                spread,
                total,
                updatedAt,
              });
              if (result.ok) close();
              else setError(result.message);
            } catch {
              setError("Line change could not be saved.");
            }
          });
        }}
      >
        <fieldset
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] p-2 text-xs font-bold"
        >
          <span>{game.away.abbreviation}</span>
          <LineStepper
            label="Away spread"
            value={spread}
            display={formatSpread(spread)}
            min={-99}
            max={99}
            onChange={setSpread}
          />
          <span>@</span>
          <span>{game.home.abbreviation}</span>
          <span className="border-l border-[var(--line)] pl-2">O/U</span>
          <LineStepper
            label="Total"
            value={total}
            display={String(total)}
            min={0.5}
            max={999}
            onChange={setTotal}
          />
        </fieldset>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={close}
            className="control-raised rounded border px-3 py-1.5 text-xs font-bold"
          >
            Cancel
          </button>
          <button disabled={pending} className="admin-button">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function LineStepper({
  label,
  value,
  display,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid min-w-10 justify-items-center gap-0.5 tabular-nums">
      <button
        type="button"
        aria-label={`Raise ${label.toLowerCase()} by half a point`}
        disabled={value >= max}
        className="control-raised h-7 w-full rounded border"
        onClick={() => onChange(value + 0.5)}
      >
        ▴
      </button>
      <output aria-label={label} className="text-sm">
        {display}
      </output>
      <button
        type="button"
        aria-label={`Lower ${label.toLowerCase()} by half a point`}
        disabled={value <= min}
        className="control-raised h-7 w-full rounded border"
        onClick={() => onChange(value - 0.5)}
      >
        ▾
      </button>
    </div>
  );
}
