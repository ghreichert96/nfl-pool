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

export type OddsEvent = z.infer<typeof eventSchema>;

export async function fetchNflOdds(
  apiKey: string,
  window?: { from: string; to: string },
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/",
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us,us2");
  url.searchParams.set("markets", "spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  if (window) {
    url.searchParams.set("commenceTimeFrom", window.from);
    url.searchParams.set("commenceTimeTo", window.to);
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

function numberHeader(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
