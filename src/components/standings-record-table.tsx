"use client";

import { useMemo, useState } from "react";
import { EntryDetailRow } from "@/components/entry-performance";
import { StrikeMark, underdogRankColor } from "@/components/standing-marks";
import { StickyTableHeader } from "@/components/sticky-table-header";
import { ranksByPayout } from "@/features/competition/performance";

export type StandingsRecordRow = {
  entryId: number;
  name: string;
  mainRank: number;
  wins: number;
  losses: number;
  ties: number;
  winPercentage: string;
  gamesBack: string;
  underdogPoints: string;
  underdogRank: number;
  sd1Strikes: number;
  sd2Strikes: number | null;
  sd2StrikeLimit: number;
  sd2Started: boolean;
  bestBetRecord: string;
  atsRecord: string;
  totalRecord: string;
  mainPayout: number;
  totalPayout: number;
};

export function StandingsRecordTable({
  rows,
  entryId,
  overall,
}: {
  rows: StandingsRecordRow[];
  entryId?: number;
  overall: boolean;
}) {
  const [sortMode, setSortMode] = useState<
    "main" | "payout-desc" | "payout-asc"
  >("main");
  const payoutValues = useMemo(
    () => new Map(rows.map((row) => [row.entryId, row.totalPayout])),
    [rows],
  );
  const payoutRanks = useMemo(
    () =>
      ranksByPayout(
        payoutValues,
        sortMode === "payout-asc" ? "ascending" : "descending",
      ),
    [payoutValues, sortMode],
  );
  const orderedRows = useMemo(() => {
    if (!overall || sortMode === "main") return rows;
    return [...rows].sort((left, right) => {
      const value =
        sortMode === "payout-desc"
          ? right.totalPayout - left.totalPayout
          : left.totalPayout - right.totalPayout;
      return value || left.mainRank - right.mainRank;
    });
  }, [overall, rows, sortMode]);
  const headers = overall
    ? ["RK", "TM", "W-L-T", "Win %", "GB", "UD Pts", "SD1", "SD2", "Payout"]
    : ["RK", "TM", "W-L-T", "BB", "ATS", "O/U", "Payout"];
  const nextSortMode = () =>
    setSortMode((current) =>
      current === "main"
        ? "payout-desc"
        : current === "payout-desc"
          ? "payout-asc"
          : "main",
    );
  const sortLabel =
    sortMode === "main"
      ? "Sort by total payout, highest first"
      : sortMode === "payout-desc"
        ? "Sort by total payout, lowest first"
        : "Return to Main ranking";
  const ariaSort =
    sortMode === "payout-desc"
      ? "descending"
      : sortMode === "payout-asc"
        ? "ascending"
        : "none";

  return (
    <section className="game-card overflow-clip rounded-xl border shadow-xl">
      <StickyTableHeader
        columnWidths={
          overall
            ? [44, 64, 82, 64, 52, 64, 52, 52, 92]
            : [44, 64, 82, 72, 72, 72, 92]
        }
      >
        <table className="pool-table w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  aria-sort={
                    overall && index === headers.length - 1
                      ? ariaSort
                      : undefined
                  }
                  className={
                    index === 0
                      ? "rank-cell sticky left-0 z-30"
                      : index === 1
                        ? "entry-cell sticky left-11 z-20"
                        : index === headers.length - 1
                          ? "payout-cell sticky right-0 z-20"
                          : ""
                  }
                >
                  {overall && index === headers.length - 1 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      aria-label={sortLabel}
                      title={sortLabel}
                      onClick={nextSortMode}
                    >
                      Payout
                      {sortMode === "payout-desc" ? (
                        <span aria-hidden="true">▼</span>
                      ) : sortMode === "payout-asc" ? (
                        <span aria-hidden="true">▲</span>
                      ) : null}
                    </button>
                  ) : (
                    header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row) => (
              <EntryDetailRow
                key={row.entryId}
                entryId={row.entryId}
                name={row.name}
                className={row.entryId === entryId ? "own-entry" : ""}
              >
                <td className="rank-cell sticky left-0 z-20">
                  {overall && sortMode !== "main"
                    ? payoutRanks.get(row.entryId)
                    : row.mainRank}
                </td>
                <th scope="row" className="entry-cell sticky left-11 z-10">
                  {row.name}
                </th>
                <td className="whitespace-nowrap font-bold">
                  {`${row.wins}-${row.losses}-${row.ties}`}
                </td>
                {overall ? (
                  <>
                    <td>{row.winPercentage}</td>
                    <td>{row.gamesBack}</td>
                    <td
                      className={`font-black ${underdogRankColor(row.underdogRank)}`}
                    >
                      {row.underdogPoints}
                    </td>
                    <td>
                      <StrikeMark strikes={row.sd1Strikes} />
                    </td>
                    <td>
                      {row.sd2Started && row.sd2Strikes !== null ? (
                        <StrikeMark
                          strikes={row.sd2Strikes}
                          limit={row.sd2StrikeLimit}
                        />
                      ) : (
                        <span aria-label="SD2 not started">—</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{row.bestBetRecord}</td>
                    <td>{row.atsRecord}</td>
                    <td>{row.totalRecord}</td>
                  </>
                )}
                <td className="payout-cell sticky right-0 z-10 font-black">
                  {formatMoney(overall ? row.totalPayout : row.mainPayout)}
                </td>
              </EntryDetailRow>
            ))}
          </tbody>
        </table>
      </StickyTableHeader>
      <p className="border-t border-slate-700 px-3 py-2 text-xs text-slate-300">
        Payouts reflect results through the selected week.
        {!overall &&
          " ATS includes Best Bet twice; BB shows its separate record."}
      </p>
    </section>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
