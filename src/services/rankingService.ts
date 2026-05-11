import { supabase } from "../lib/supabase.js";
import { generateSlug } from "../components/SEO.js";

export interface RankingFilter {
  state?: string;
  party?: string;
  position?: string;
  year?: number;
  minScore?: number;
  maxScore?: number;
  sortBy?: "percentage" | "name" | "total";
  sortOrder?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

export interface PoliticianRankingEntry {
  name: string;
  slug: string;
  party: string | null;
  state: string | null;
  position: string | null;
  photo_url: string | null;
  percentage: number;
  stats: {
    fulfilled: number;
    partial: number;
    broken: number;
    pending: number;
    total: number;
  };
  score_breakdown: Record<string, number>;
  election_year: number | null;
}

export interface RankingResult {
  politicians: PoliticianRankingEntry[];
  nextCursor: string | null;
  total: number;
}

function mapStatus(s: string): "fulfilled" | "partial" | "broken" | "pending" {
  const lower = (s || "").toLowerCase();
  if (lower === "cumprida" || lower === "fulfilled") return "fulfilled";
  if (lower === "parcialmente_cumprida" || lower === "em_andamento" || lower === "partial" || lower === "partial_fulfilled") return "partial";
  if (lower === "descumprida" || lower === "quebrada" || lower === "broken" || lower === "not_fulfilled") return "broken";
  return "pending";
}

export async function getRanking(filters: RankingFilter = {}): Promise<RankingResult> {
  const limit = Math.min(filters.limit || 20, 100);
  const { data: promises, error } = await supabase
    .from("promises")
    .select("politician_name, party, state, status, fulfillment_score, ano_eleitoral");

  if (error) throw error;

  const statsMap: Record<string, any> = {};

  (promises || []).forEach((p: any) => {
    const key = p.politician_name;
    const s = mapStatus(p.status);

    if (!statsMap[key]) {
      statsMap[key] = {
        name: key,
        party: p.party || null,
        state: p.state || "BR",
        position: p.position || null,
        photo_url: null,
        fulfilled: 0,
        partial: 0,
        broken: 0,
        pending: 0,
        election_year: p.ano_eleitoral || null,
        score_breakdown: {}
      };
    }

    statsMap[key][s]++;
    const scoreBucket = Math.floor((p.fulfillment_score || 0) / 10) * 10;
    statsMap[key].score_breakdown[scoreBucket] = (statsMap[key].score_breakdown[scoreBucket] || 0) + 1;
  });

  const entries: PoliticianRankingEntry[] = Object.values(statsMap)
    .filter((data: any) => {
      if (filters.state && data.state !== filters.state && !(filters.state === "BR" && !data.state)) return false;
      if (filters.party && data.party !== filters.party) return false;
      if (filters.position && data.position !== filters.position) return false;
      if (filters.year && data.election_year !== filters.year) return false;
      return true;
    })
    .map((data: any) => {
      const total = data.fulfilled + data.partial + data.broken + data.pending;
      const percentage = total > 0 ? Math.round((data.fulfilled / total) * 100) : 0;

      if (filters.minScore !== undefined && percentage < filters.minScore) return null;
      if (filters.maxScore !== undefined && percentage > filters.maxScore) return null;

      return {
        name: data.name,
        slug: generateSlug(data.name),
        party: data.party,
        state: data.state,
        position: data.position,
        photo_url: data.photo_url,
        percentage,
        stats: {
          fulfilled: data.fulfilled,
          partial: data.partial,
          broken: data.broken,
          pending: data.pending,
          total
        },
        score_breakdown: data.score_breakdown,
        election_year: data.election_year
      };
    })
    .filter(Boolean) as PoliticianRankingEntry[];

  entries.sort((a, b) => {
    const sortBy = filters.sortBy || "percentage";
    const order = filters.sortOrder || "desc";
    let cmp = 0;
    if (sortBy === "percentage") cmp = b.percentage - a.percentage;
    else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
    else if (sortBy === "total") cmp = b.stats.total - a.stats.total;
    return order === "desc" ? cmp : -cmp;
  });

  let cursorIdx = 0;
  if (filters.cursor) {
    cursorIdx = entries.findIndex(e => e.slug === filters.cursor);
    if (cursorIdx >= 0) entries.splice(0, cursorIdx + 1);
  }

  const page = entries.slice(0, limit);
  const nextCursor = entries.length > limit ? page[page.length - 1]?.slug || null : null;

  return {
    politicians: page,
    nextCursor,
    total: entries.length
  };
}

export async function getPoliticianBySlug(slug: string): Promise<PoliticianRankingEntry | null> {
  const decoded = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const { data: promises } = await supabase
    .from("promises")
    .select("politician_name, party, state, status, fulfillment_score, ano_eleitoral")
    .ilike("politician_name", `%${decoded}%`)
    .limit(200);

  if (!promises?.length) return null;

  const data: any = {
    name: decoded,
    party: null,
    state: null,
    position: null,
    photo_url: null,
    fulfilled: 0,
    partial: 0,
    broken: 0,
    pending: 0,
    election_year: null,
    score_breakdown: {}
  };

  (promises || []).forEach((p: any) => {
    const s = mapStatus(p.status);
    data.party = data.party || p.party || null;
    data.state = data.state || p.state || "BR";
    data.election_year = data.election_year || p.ano_eleitoral || null;
    data[s]++;
    const scoreBucket = Math.floor((p.fulfillment_score || 0) / 10) * 10;
    data.score_breakdown[scoreBucket] = (data.score_breakdown[scoreBucket] || 0) + 1;
  });

  const total = data.fulfilled + data.partial + data.broken + data.pending;
  const percentage = total > 0 ? Math.round((data.fulfilled / total) * 100) : 0;

  return {
    name: data.name,
    slug: generateSlug(data.name),
    party: data.party,
    state: data.state,
    position: data.position,
    photo_url: data.photo_url,
    percentage,
    stats: {
      fulfilled: data.fulfilled,
      partial: data.partial,
      broken: data.broken,
      pending: data.pending,
      total
    },
    score_breakdown: data.score_breakdown,
    election_year: data.election_year
  };
}

export async function comparePoliticians(name1: string, name2: string): Promise<{ politician1: PoliticianRankingEntry; politician2: PoliticianRankingEntry; comparison: any }> {
  const [p1, p2] = await Promise.all([
    getPoliticianBySlug(name1),
    getPoliticianBySlug(name2)
  ]);

  if (!p1 || !p2) throw new Error("Político não encontrado");

  const comparison = {
    score_diff: p1.percentage - p2.percentage,
    total_diff: p1.stats.total - p2.stats.total,
    fulfilled_diff: p1.stats.fulfilled - p2.stats.fulfilled,
    better_score: p1.percentage >= p2.percentage ? p1.name : p2.name,
    better_total: p1.stats.total >= p2.stats.total ? p1.name : p2.name
  };

  return { politician1: p1, politician2: p2, comparison };
}

export async function getRankingStats(): Promise<any> {
  const { data: promises } = await supabase
    .from("promises")
    .select("status, fulfillment_score, state, party");

  const states = new Set<string>();
  const parties = new Set<string>();
  let total = 0, fulfilled = 0, partial = 0, broken = 0;

  (promises || []).forEach((p: any) => {
    total++;
    const s = mapStatus(p.status);
    if (s === "fulfilled") fulfilled++;
    else if (s === "partial") partial++;
    else if (s === "broken") broken++;
    if (p.state) states.add(p.state);
    if (p.party) parties.add(p.party);
  });

  return {
    total,
    fulfilled,
    partial,
    broken,
    pending: total - fulfilled - partial - broken,
    fulfilled_rate: total > 0 ? Math.round((fulfilled / total) * 100) : 0,
    states_covered: states.size,
    parties_covered: parties.size,
    parties: Array.from(parties)
  };
}

export default { getRanking, getPoliticianBySlug, comparePoliticians, getRankingStats };