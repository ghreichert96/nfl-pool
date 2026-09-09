import { z } from "zod";

const outcomeSchema = z.object({
  name: z.string(),
  price: z.number().optional(),
  point: z.number(),
});
const marketSchema = z.object({
  key: z.enum(["spreads", "totals"]),
  outcomes: z.array(outcomeSchema),
});
const bookmakerSchema = z.object({
  key: z.string(),
  title: z.string(),
  last_update: z.string().datetime().optional(),
  markets: z.array(marketSchema),
});
const eventSchema = z.object({
  id: z.string().min(1),
  sport_key: z.string(),
  commence_time: z.string().datetime(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(bookmakerSchema),
});
const responseSchema = z.array(eventSchema);

const scoreSchema = z.object({
  name: z.string(),
  score: z.string().regex(/^\d+$/),
});
const scoreEventSchema = z.object({
  id: z.string().min(1),
  sport_key: z.string(),
  commence_time: z.string().datetime(),
  completed: z.boolean(),
  home_team: z.string(),
  away_team: z.string(),
  scores: z.array(scoreSchema).nullable(),
  last_update: z.string().datetime().nullable(),
});

export type OddsEvent = z.infer<typeof eventSchema>;
export type ScoreEvent = z.infer<typeof scoreEventSchema>;

export async function fetchNflOdds(
  apiKey: string,
  window?: { from: string; to: string },
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/",
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  if (window) {
    url.searchParams.set("commenceTimeFrom", wholeSecondIso(window.from));
    url.searchParams.set("commenceTimeTo", wholeSecondIso(window.to));
  }
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `Odds API returned ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  return {
    events: responseSchema.parse(await response.json()),
    quota: {
      remaining: numberHeader(response.headers.get("x-requests-remaining")),
      used: numberHeader(response.headers.get("x-requests-used")),
      last: numberHeader(response.headers.get("x-requests-last")),
    },
  };
}

export async function fetchNflScores(
  apiKey: string,
  options: { includeCompleted: boolean; eventIds?: string[] },
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores/",
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("dateFormat", "iso");
  if (options.includeCompleted) url.searchParams.set("daysFrom", "1");
  if (options.eventIds?.length)
    url.searchParams.set("eventIds", options.eventIds.join(","));

  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `Odds API scores returned ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  const payload = z.array(z.unknown()).parse(await response.json());
  const parsed = payload.map((event) => scoreEventSchema.safeParse(event));
  return {
    events: parsed.flatMap((event) => (event.success ? [event.data] : [])),
    invalidEvents: parsed.filter((event) => !event.success).length,
    quota: {
      remaining: numberHeader(response.headers.get("x-requests-remaining")),
      used: numberHeader(response.headers.get("x-requests-used")),
      last: numberHeader(response.headers.get("x-requests-last")),
    },
  };
}

function wholeSecondIso(value: string) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function numberHeader(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
