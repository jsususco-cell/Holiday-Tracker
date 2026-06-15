/**
 * Philippine nationwide holidays, classified per the Official Gazette
 * (https://www.officialgazette.gov.ph/nationwide-holidays/).
 *
 * The Regular vs Special (Non-Working) split is set yearly by Presidential
 * proclamation and is PH-specific, so it's curated here rather than pulled from
 * a generic holiday API. UPDATE THIS LIST each year when the new proclamation
 * is published (and add the year to AVAILABLE_YEARS in the form).
 *
 * "Special (Working)" days (e.g. EDSA Anniversary) are intentionally omitted —
 * they are neither a Regular nor a Special Non-Working holiday for this form.
 */

export type HolidayType = "regular" | "special";

export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
};

const PH_HOLIDAYS: Record<number, Holiday[]> = {
  2026: [
    // ── Regular Holidays ──
    { date: "2026-01-01", name: "New Year's Day", type: "regular" },
    { date: "2026-04-02", name: "Maundy Thursday", type: "regular" },
    { date: "2026-04-03", name: "Good Friday", type: "regular" },
    { date: "2026-04-09", name: "Araw ng Kagitingan (Day of Valor)", type: "regular" },
    { date: "2026-05-01", name: "Labor Day", type: "regular" },
    { date: "2026-06-12", name: "Independence Day", type: "regular" },
    { date: "2026-08-31", name: "National Heroes Day", type: "regular" },
    { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2026-12-25", name: "Christmas Day", type: "regular" },
    { date: "2026-12-30", name: "Rizal Day", type: "regular" },
    // ── Special (Non-Working) Days ──
    { date: "2026-02-17", name: "Chinese New Year", type: "special" },
    { date: "2026-04-04", name: "Black Saturday", type: "special" },
    { date: "2026-08-21", name: "Ninoy Aquino Day", type: "special" },
    { date: "2026-11-01", name: "All Saints' Day", type: "special" },
    { date: "2026-11-02", name: "All Souls' Day", type: "special" },
    { date: "2026-12-08", name: "Feast of the Immaculate Conception of Mary", type: "special" },
    { date: "2026-12-24", name: "Christmas Eve", type: "special" },
    { date: "2026-12-31", name: "Last Day of the Year", type: "special" },
  ],
};

export function availableYears(): number[] {
  return Object.keys(PH_HOLIDAYS)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Holidays for a year, optionally filtered to one type (regular | special). */
export function getPHHolidays(year: number, type?: HolidayType): Holiday[] {
  const list = PH_HOLIDAYS[year] ?? [];
  const filtered = type ? list.filter((h) => h.type === type) : list;
  return [...filtered].sort((a, b) => a.date.localeCompare(b.date));
}
