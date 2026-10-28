"use client";
import { TeamLogo } from "./team-logo";
import { TEXT_TEAMS_KEY, useDisplayPreference } from "./profile-preferences";
export function TableTeam({
  team,
  src,
}: {
  team: string;
  src?: string | null;
}) {
  const text = useDisplayPreference(TEXT_TEAMS_KEY);
  return (
    <span
      aria-label={team}
      className="inline-grid min-h-8 min-w-8 place-items-center font-black"
    >
      {text || !src ? (
        <span className="text-xs">{team}</span>
      ) : (
        <TeamLogo
          team={team}
          src={src}
          size={32}
          contrast="dark"
          className="size-8 object-contain"
        />
      )}
    </span>
  );
}
