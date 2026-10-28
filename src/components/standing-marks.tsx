export function StrikeMark({ strikes }: { strikes: number }) {
  return (
    <span
      aria-label={`${strikes} ${strikes === 1 ? "strike" : "strikes"}${strikes >= 2 ? ", eliminated" : ""}`}
      className={`font-black tracking-wider ${strikes >= 2 ? "text-red-400 line-through decoration-2" : strikes === 1 ? "text-orange-300" : "text-emerald-300"}`}
    >
      {strikes >= 2 ? "XX" : strikes === 1 ? "X" : "—"}
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
