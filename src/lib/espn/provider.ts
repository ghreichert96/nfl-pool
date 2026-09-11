import { z } from "zod";

const competitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  score: z.string().regex(/^\d+$/).transform(Number),
  team: z.object({ abbreviation: z.string().min(2).max(4) }),
});

const competitionSchema = z.object({
  competitors: z.array(competitorSchema),
  status: z.object({
    displayClock: z.string().default(""),
    period: z.number().int().nonnegative().default(0),
    type: z.object({
      state: z.string(),
      completed: z.boolean(),
      description: z.string().default(""),
      detail: z.string().default(""),
      shortDetail: z.string().default(""),
    }),
  }),
});

const eventSchema = z.object({
  id: z.string().min(1),
  date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid datetime")
    .transform((value) => new Date(value).toISOString()),
  competitions: z.array(competitionSchema).min(1),
});

const scoreboardSchema = z.object({ events: z.array(eventSchema) });

export type EspnLiveEvent = {
  id: string;
  kickoffAt: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  period: number;
  clock: string;
  state:
    "scheduled" | "live" | "halftime" | "final" | "postponed" | "cancelled";
  detail: string;
};

export async function fetchEspnNflScoreboard(fetcher: typeof fetch = fetch) {
  const response = await fetcher(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000",
    { headers: { accept: "application/json" }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`ESPN scoreboard returned ${response.status}`);
  const parsed = scoreboardSchema.parse(await response.json());
  return parseEvents(parsed.events);
}

function parseEvents(events: z.infer<typeof eventSchema>[]): EspnLiveEvent[] {
  return events.flatMap((event) => {
    const competition = event.competitions[0];
    const away = competition.competitors.find(
      (team) => team.homeAway === "away",
    );
    const home = competition.competitors.find(
      (team) => team.homeAway === "home",
    );
    if (!away || !home) return [];
    const status = competition.status;
    const state = espnState(status.type);
    return [
      {
        id: event.id,
        kickoffAt: event.date,
        awayTeam: normalizeEspnTeam(away.team.abbreviation),
        homeTeam: normalizeEspnTeam(home.team.abbreviation),
        awayScore: away.score,
        homeScore: home.score,
        period: status.period,
        clock: status.displayClock,
        state,
        detail: liveDetail(state, status.period, status.displayClock),
      },
    ];
  });
}

function espnState(
  type: z.infer<typeof competitionSchema>["status"]["type"],
): EspnLiveEvent["state"] {
  const text =
    `${type.description} ${type.detail} ${type.shortDetail}`.toLowerCase();
  if (type.completed) return "final";
  if (text.includes("postpon")) return "postponed";
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("halftime")) return "halftime";
  if (type.state === "in") return "live";
  return "scheduled";
}

export function normalizeEspnTeam(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "WSH" ? "WAS" : normalized;
}

export function liveDetail(
  state: EspnLiveEvent["state"],
  period: number,
  clock: string,
) {
  if (state === "final") return "Final · Verifying";
  if (state === "halftime") return "Halftime";
  if (state === "postponed") return "Postponed";
  if (state === "cancelled") return "Cancelled";
  if (state !== "live") return "Scheduled";
  const periodLabel =
    period <= 4
      ? `Q${Math.max(period, 1)}`
      : period === 5
        ? "OT"
        : `${period - 4}OT`;
  return clock ? `${periodLabel} · ${clock}` : periodLabel;
}
