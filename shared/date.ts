export const TZ = "America/Vancouver";
export function localDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dayDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !isNaN(+dayDate(day)) &&
    dayDate(day).toISOString().slice(0, 10) === day
  );
}
export function shiftDay(day: string, n: number) {
  const d = dayDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dateLabels(day: string) {
  const d = dayDate(day),
    tz = { timeZone: "UTC" };
  return {
    fa: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      ...tz,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d),
    faDay: new Intl.DateTimeFormat("fa-IR", { ...tz, weekday: "long" }).format(
      d,
    ),
    faNumber: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      ...tz,
      day: "numeric",
    }).format(d),
    faMonth: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      ...tz,
      month: "long",
    }).format(d),
    en: new Intl.DateTimeFormat("en-CA", {
      ...tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d),
  };
}
export function due(now: Date) {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return h === "08";
}
export function occurrenceStatus(
  occ: { start: string; end: string }[],
  now = new Date(),
) {
  if (occ.some((x) => +new Date(x.start) <= +now && +new Date(x.end) >= +now))
    return "ongoing";
  return occ.some((x) => +new Date(x.start) > +now) ? "upcoming" : "finished";
}
