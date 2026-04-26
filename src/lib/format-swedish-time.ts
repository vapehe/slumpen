/** IANA-zon för svensk väggtid (normaltid/sommartid via Intl). */
export const EUROPE_STOCKHOLM = "Europe/Stockholm";

const locale = "sv-SE";

/**
 * SQLite CURRENT_TIMESTAMP m.m. lagras som UTC utan suffix. `new Date("… …")` är
 * ogiltig i flera WebView-migrar → då visas råsträngen. Normalisera till ISO UTC.
 */
export function normalizeSqlUtcTimestamp(value: string): string {
  const t = value.trim();
  if (t === "") {
    return t;
  }
  if (/[zZ]$/.test(t)) {
    return t;
  }
  if (/[+-]\d{2}:\d{2}$/.test(t) || /[+-]\d{4}$/.test(t)) {
    return t;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(t);
  if (m != null) {
    return `${m[1]}T${m[2]}${m[3] ?? ""}Z`;
  }
  return t;
}

function parseInstant(value: string): Date | null {
  const normalized = normalizeSqlUtcTimestamp(value);
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) {
    return d;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Formaterar datum+tid för visning i svensk tid oavsett systemets tidszon.
 */
export function formatDateTimeSv(isoOrTimestamp: string, options?: Intl.DateTimeFormatOptions): string {
  const d = parseInstant(isoOrTimestamp);
  if (d == null) {
    return isoOrTimestamp;
  }
  return d.toLocaleString(locale, { ...options, timeZone: EUROPE_STOCKHOLM });
}

/**
 * Endast kalenderdatum i svensk tid (rätt dag vid UTC-nära tider).
 */
export function formatDateSv(isoOrTimestamp: string): string {
  const d = parseInstant(isoOrTimestamp);
  if (d == null) {
    return isoOrTimestamp;
  }
  return d.toLocaleDateString(locale, { timeZone: EUROPE_STOCKHOLM, dateStyle: "medium" });
}
