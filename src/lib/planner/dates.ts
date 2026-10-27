export function calendarDate(value: string): string {
  if (value.startsWith('0000-')) throw new Error('Choose a valid calendar date.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Choose a valid calendar date.");
  const d = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value)
    throw new Error("Choose a valid calendar date.");
  return value;
}
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(value: string, days: number): string {
  const d = new Date(`${calendarDate(value)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekDates(value: string): string[] {
  const dow = new Date(`${calendarDate(value)}T12:00:00Z`).getUTCDay();
  const monday = addDays(value, -(dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function shiftWeek(start: string, offset: number): string {
  return addDays(weekDates(start)[0], offset * 7);
}
export function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
