// Showing a movie night's date and time in the host's time zone. Safe for server and browser.

export function validTimeZone(tz: unknown): string | null {
  if (typeof tz !== "string" || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(iso));
  }
}

export const fullDay = (iso: string, tz: string) => fmt(iso, tz, { weekday: "long", month: "long", day: "numeric" });
export const shortDay = (iso: string, tz: string) => fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });
export const weekday = (iso: string, tz: string) => fmt(iso, tz, { weekday: "short" });
export const month = (iso: string, tz: string) => fmt(iso, tz, { month: "short" });
export const dayNum = (iso: string, tz: string) => fmt(iso, tz, { day: "numeric" });
export const time = (iso: string, tz: string) => fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
