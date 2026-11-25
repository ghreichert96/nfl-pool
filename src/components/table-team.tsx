"use client";
import { TeamLogo } from "./team-logo";
import { TEXT_TEAMS_KEY, useDisplayPreference } from "./profile-preferences";
export function TableTeam({
  team,
  src,
  size = 32,
}: {
  team: string;
  src?: string | null;
  size?: number;
}) {
  const text = useDisplayPreference(TEXT_TEAMS_KEY);
  return (
    <span
      aria-label={team}
      className="inline-grid place-items-center font-black"
      style={{ minHeight: size, minWidth: size }}
    >
      {text || !src ? (
        <span className="text-xs">{team}</span>
      ) : (
        <TeamLogo
          team={team}
          src={src}
          size={size}
          contrast="dark"
          className="object-contain"
        />
      )}
    </span>
  );
}
