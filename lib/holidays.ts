/**
 * Philippine public holidays, fetched from the free Nager.Date API (no key).
 * https://date.nager.at/api/v3/PublicHolidays/{year}/PH
 *
 * Cached in-memory per year for the life of the server process.
 */

export type Holiday = {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  /** Nager "types" — e.g. ["Public"]. We surface it for classification hints. */
  types?: string[];
};

const cache = new Map<number, { at: number; data: Holiday[] }>();
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

export async function getPHHolidays(year: number): Promise<Holiday[]> {
  const hit = cache.get(year);
  // Note: Date.now() is fine here — this is the server runtime, not a workflow.
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Holiday API returned ${res.status}`);
  }
  const raw = (await res.json()) as Array<{
    date: string;
    localName: string;
    name: string;
    types?: string[];
  }>;

  const data: Holiday[] = raw.map((h) => ({
    date: h.date,
    localName: h.localName,
    name: h.name,
    types: h.types,
  }));

  cache.set(year, { at: Date.now(), data });
  return data;
}
