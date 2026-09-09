"use client";

import { useActionState, useState } from "react";

import { createRecoveryLink, type RecoveryLinkState } from "./actions";

const initialState: RecoveryLinkState = { ok: false };

export function RecoveryLinkButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(
    createRecoveryLink,
    initialState,
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-w-56">
      <form action={formAction}>
        <input type="hidden" name="user_id" value={userId} />
        <button
          disabled={pending}
          className="control-raised rounded-md border px-3 py-2 text-xs font-black disabled:opacity-50"
        >
          {pending ? "CREATING…" : "CREATE RECOVERY LINK"}
        </button>
      </form>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-2 text-xs ${state.ok ? "text-emerald-300" : "text-red-300"}`}
        >
          {state.message}
        </p>
      )}
      {state.link && (
        <div className="mt-2 grid gap-2">
          <textarea
            aria-label="One-time recovery link"
            readOnly
            rows={3}
            value={state.link}
            className="w-full resize-none rounded border border-slate-700 bg-slate-950 p-2 text-[10px] text-slate-300"
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(state.link!);
              setCopied(true);
            }}
            className="control-pressed rounded border px-3 py-2 text-xs font-black"
          >
            {copied ? "COPIED" : "COPY LINK"}
          </button>
        </div>
      )}
    </div>
  );
}
