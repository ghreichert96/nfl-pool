const easternFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function easternLocalToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid local date and time");

  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = easternParts(new Date(instant));
    const rendered = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    instant += desired - rendered;
  }
  return new Date(instant).toISOString();
}

export function nextWeeklyFreeze(previousFreeze: string) {
  const parts = easternParts(new Date(previousFreeze));
  const calendar = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 7, 20, 0),
  );
  const year = calendar.getUTCFullYear();
  const month = String(calendar.getUTCMonth() + 1).padStart(2, "0");
  const day = String(calendar.getUTCDate()).padStart(2, "0");
  return easternLocalToIso(`${year}-${month}-${day}T20:00`);
}

function easternParts(date: Date) {
  const parts = Object.fromEntries(
    easternFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}
