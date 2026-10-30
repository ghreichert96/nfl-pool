export function StrikeMark({
  strikes,
  limit = 2,
}: {
  strikes: number;
  limit?: number;
}) {
  return (
    <span
      aria-label={`${strikes} ${strikes === 1 ? "strike" : "strikes"}${strikes >= limit ? ", eliminated" : ""}`}
      className={`font-black tracking-wider ${strikes >= limit ? "text-red-400 line-through decoration-2" : strikes === 1 ? "text-orange-300" : "text-emerald-300"}`}
    >
      {strikes > 0 ? "X".repeat(strikes) : "—"}
    </span>
  );
}
export function underdogRankColor(rank: number) {
  return rank === 1
    ? "text-emerald-300"
    : rank <= 3
      ? "text-yellow-300"
      : rank <= 6
        ? "text-orange-300"
        : "text-red-400";
}
