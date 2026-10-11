import type { Freshness } from "@/lib/scores/freshness";

export function UpdateStatus({ freshness }: { freshness?: Freshness }) {
  if (!freshness) return null;
  return (
    <span
      role={freshness.stale ? "status" : undefined}
      aria-label={
        freshness.stale
          ? `Scores have not updated for at least two hours during play. Last updated ${freshness.label}.`
          : `Last updated ${freshness.label}`
      }
      title={
        freshness.stale
          ? "Scores have not updated for at least two hours during play"
          : "Last updated"
      }
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[8px] normal-case tracking-normal ${freshness.stale ? "text-amber-300" : "text-slate-400"}`}
    >
      {freshness.stale && (
        <strong
          aria-hidden="true"
          className="flex h-3 w-3 items-center justify-center rounded-full border border-current text-[9px]"
        >
          !
        </strong>
      )}
      {freshness.label}
    </span>
  );
}

export function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.2 7a7 7 0 0 1 11.6-1L20 9M4 15l2.2 3A7 7 0 0 0 17.8 17" />
    </svg>
  );
}
