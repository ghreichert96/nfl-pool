import type { Outcome } from "./scoring";

export function resultVisualClass(stage: "live" | "final", outcome: Outcome) {
  if (stage === "live") {
    if (outcome === "win")
      return "border-amber-400 bg-emerald-950/45 text-emerald-100";
    if (outcome === "loss")
      return "border-amber-400 bg-red-950/45 text-red-100";
    return "border-amber-400 bg-amber-950/30 text-amber-100";
  }
  if (outcome === "win")
    return "border-emerald-700 bg-emerald-900/80 text-white";
  if (outcome === "loss") return "border-red-800 bg-red-950/80 text-white";
  if (outcome === "tie") return "border-slate-600 bg-slate-800/80 text-white";
  return "border-slate-700 bg-slate-900/70 text-slate-500";
}
