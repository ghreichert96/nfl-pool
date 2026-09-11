import Image from "next/image";

const contrastTeams = new Set(["LAR", "NYG", "NYJ", "CAR"]);

export function TeamLogo({
  team,
  src,
  size = 32,
  contrast = "auto",
  className = "",
}: {
  team: string;
  src?: string | null;
  size?: number;
  contrast?: "auto" | "dark";
  className?: string;
}) {
  const normalized = team.toUpperCase();
  if (!src)
    return (
      <span className={`font-black ${className}`} aria-hidden="true">
        {normalized}
      </span>
    );

  return (
    <Image
      src={src}
      alt=""
      title={normalized}
      width={size}
      height={size}
      unoptimized
      className={`team-logo-image team-logo-${normalized.toLowerCase()} ${contrastTeams.has(normalized) ? "team-logo-contrast" : ""} ${contrast === "dark" ? "team-logo-on-dark" : ""} ${className}`}
    />
  );
}
