type Revision = {
  id: number;
  revision: number;
  submitted_at: string;
};

type RevisionPick = {
  submission_id: number;
  game_id: number;
  kind: string;
  team: string | null;
  total_direction: string | null;
  is_best_bet: boolean;
};

type RevisionGame = {
  id: number;
  away_team: string;
  home_team: string;
};

function labelsBySubmission(picks: RevisionPick[], games: RevisionGame[]) {
  const matchupByGame = new Map(
    games.map((game) => [game.id, `${game.away_team}/${game.home_team}`]),
  );
  const labels = new Map<number, string[]>();
  for (const pick of picks) {
    const matchup = matchupByGame.get(pick.game_id) ?? `G${pick.game_id}`;
    const label =
      pick.kind === "ats"
        ? `${pick.team} ATS${pick.is_best_bet ? " BB" : ""}`
        : pick.kind === "total"
          ? `${matchup} ${pick.total_direction === "over" ? "O" : "U"}`
          : pick.kind === "sudden_death"
            ? `${pick.team} SD`
            : `${pick.team} UD`;
    labels.set(pick.submission_id, [
      ...(labels.get(pick.submission_id) ?? []),
      label,
    ]);
  }
  return labels;
}

export function SubmissionRevisionLog({
  revisions,
  picks,
  games,
  commissionerSubmissionIds = [],
}: {
  revisions: Revision[];
  picks: RevisionPick[];
  games: RevisionGame[];
  commissionerSubmissionIds?: number[];
}) {
  const labels = labelsBySubmission(picks, games);
  const commissionerIds = new Set(commissionerSubmissionIds);
  const changes = new Map<number, { added: string[]; removed: string[] }>();
  let previous = new Set<string>();
  for (const revision of [...revisions].reverse()) {
    const current = new Set(labels.get(revision.id) ?? []);
    changes.set(revision.id, {
      added: [...current].filter((pick) => !previous.has(pick)).sort(),
      removed: [...previous].filter((pick) => !current.has(pick)).sort(),
    });
    previous = current;
  }

  return (
    <ol className="divide-y divide-slate-800">
      {revisions.map((revision) => {
        const diff = changes.get(revision.id) ?? { added: [], removed: [] };
        const isCommissioner = commissionerIds.has(revision.id);
        return (
          <li key={revision.id}>
            <details className="group py-1.5">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="text-slate-500 group-open:rotate-45"
                >
                  +
                </span>
                <strong>R{revision.revision}</strong>
                {isCommissioner && (
                  <span className="rounded border border-amber-700 px-1 text-[8px] font-black uppercase text-amber-300">
                    Commissioner
                  </span>
                )}
                <span className="ml-auto whitespace-nowrap text-emerald-400">
                  +{diff.added.length}
                </span>
                <span className="whitespace-nowrap text-red-400">
                  −{diff.removed.length}
                </span>
                <time className="w-[8.25rem] text-right text-[9px] text-slate-500">
                  {new Date(revision.submitted_at).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </summary>
              <div className="ml-5 mt-1 grid gap-0.5 text-[10px]">
                {diff.added.map((pick) => (
                  <span key={`add-${pick}`} className="text-emerald-300">
                    + {pick}
                  </span>
                ))}
                {diff.removed.map((pick) => (
                  <span key={`remove-${pick}`} className="text-red-300">
                    − {pick}
                  </span>
                ))}
                {!diff.added.length && !diff.removed.length && (
                  <span className="text-slate-500">No changes</span>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
