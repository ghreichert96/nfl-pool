const localOrigins = new Set([
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3008",
  "http://127.0.0.1:3009",
  "http://localhost:3000",
  "http://localhost:3008",
  "http://localhost:3009",
]);

export function getAppOrigin(requestOrigin?: string | null) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (requestOrigin && localOrigins.has(requestOrigin)) {
    return requestOrigin;
  }

  return "http://127.0.0.1:3009";
}
