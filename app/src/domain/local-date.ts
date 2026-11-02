// Local calendar date as `YYYY-MM-DD` (D-29). No timezones inside the domain:
// parsing and arithmetic use UTC milliseconds, which are exact for whole days.
export type LocalDate = `${number}-${number}-${number}`;

const PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): value is LocalDate {
  return PATTERN.test(value);
}

function utcMs(date: LocalDate): number {
  const [y, m, d] = date.split('-').map((p) => Number(p));
  // m - 1: the string is 1-based, Date.UTC months are 0-based.
  return Date.UTC(y, m - 1, d);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** The latest of whole dates, ignoring nulls; null when all inputs are null. */
export function maxLocalDate(...dates: (LocalDate | null)[]): LocalDate | null {
  let out: LocalDate | null = null;
  for (const d of dates) {
    if (d !== null && (out === null || d > out)) out = d;
  }
  return out;
}

/** Signed whole days from `a` to `b` (`b - a`). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86_400_000);
}

/** Adds calendar months and clamps to the target month's last day (D-30, BR-03): 31 Jan + 1 month = 28/29 Feb. */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const [y, m, d] = date.split('-').map((p) => Number(p));
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm1 = total - ny * 12; // 0-based month
  const nd = Math.min(d, daysInMonth(ny, nm1 + 1));
  return `${ny}-${pad2(nm1 + 1)}-${pad2(nd)}` as LocalDate;
}

/** The device's local calendar date, as a JS Date (D-56). */
export function jsDateToLocalDate(js: Date): LocalDate {
  return `${js.getFullYear()}-${pad2(js.getMonth() + 1)}-${pad2(js.getDate())}` as LocalDate;
}
