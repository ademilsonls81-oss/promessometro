import { supabase } from "../lib/supabase.js";

export interface ElectionData {
  year: number;
  total_promises: number;
  total_politicians: number;
  fulfilled_rate: number;
  top_politicians: PoliticianSummary[];
  by_status: Record<string, number>;
  by_party: Record<string, number>;
}

export interface PoliticianSummary {
  name: string;
  slug: string;
  party: string | null;
  state: string | null;
  percentage: number;
  total: number;
  fulfilled: number;
}

function mapStatus(s: string): string {
  const lower = (s || "").toLowerCase();
  if (lower === "cumprida" || lower === "fulfilled") return "fulfilled";
  if (lower === "parcialmente_cumprida" || lower === "em_andamento" || lower === "partial") return "partial";
  if (lower === "descumprida" || lower === "quebrada" || lower === "broken") return "broken";
  return "pending";
}

export async function getElectionData(year: number, limit: number = 20): Promise<ElectionData> {
  const { data: promises } = await supabase
    .from("promises")
    .select("politician_name, party, state, status, fulfillment_score, ano_eleitoral, category")
    .eq("ano_eleitoral", year);

  if (!promises?.length) {
    return {
      year,
      total_promises: 0,
      total_politicians: 0,
      fulfilled_rate: 0,
      top_politicians: [],
      by_status: { fulfilled: 0, partial: 0, broken: 0, pending: 0 },
      by_party: {}
    };
  }

  const statsMap: Record<string, any> = {};
  const byStatus = { fulfilled: 0, partial: 0, broken: 0, pending: 0 };
  const byParty: Record<string, number> = {};

  (promises || []).forEach((p: any) => {
    const key = p.politician_name;
    const s = mapStatus(p.status);
    byStatus[s]++;
    if (p.party) byParty[p.party] = (byParty[p.party] || 0) + 1;

    if (!statsMap[key]) {
      statsMap[key] = { name: key, party: p.party || null, state: p.state || null, fulfilled: 0, total: 0 };
    }
    statsMap[key].total++;
    if (s === "fulfilled") statsMap[key].fulfilled++;
  });

  const topPoliticians: PoliticianSummary[] = Object.values(statsMap)
    .map((data: any) => {
      const percentage = data.total > 0 ? Math.round((data.fulfilled / data.total) * 100) : 0;
      const slug = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return {
        name: data.name,
        slug,
        party: data.party,
        state: data.state,
        percentage,
        total: data.total,
        fulfilled: data.fulfilled
      };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, limit);

  const total = promises.length;
  const fulfilledRate = total > 0 ? Math.round((byStatus.fulfilled / total) * 100) : 0;

  return {
    year,
    total_promises: total,
    total_politicians: Object.keys(statsMap).length,
    fulfilled_rate: fulfilledRate,
    top_politicians: topPoliticians,
    by_status: byStatus,
    by_party: byParty
  };
}

export async function getAvailableElectionYears(): Promise<number[]> {
  const { data } = await supabase
    .from("promises")
    .select("ano_eleitoral")
    .not("ano_eleitoral", "is", null)
    .order("ano_eleitoral", { ascending: false });

  const years = [...new Set((data || []).map((p: any) => p.ano_eleitoral).filter(Boolean))] as number[];
  return years;
}

export async function getElectionComparison(years: number[]): Promise<Record<number, { total: number; fulfilled: number; rate: number }>> {
  const result: Record<number, { total: number; fulfilled: number; rate: number }> = {};

  for (const year of years) {
    const { data } = await supabase
      .from("promises")
      .select("status")
      .eq("ano_eleitoral", year);

    const total = (data || []).length;
    const fulfilled = (data || []).filter((p: any) => mapStatus(p.status) === "fulfilled").length;
    result[year] = { total, fulfilled, rate: total > 0 ? Math.round((fulfilled / total) * 100) : 0 };
  }

  return result;
}

export async function getPromiseByElection(year: number, options: { status?: string; party?: string; limit?: number; cursor?: string } = {}): Promise<any> {
  let query = supabase
    .from("promises")
    .select("id, politician_name, promise_title, status, fulfillment_score, party, state, category, created_at")
    .eq("ano_eleitoral", year)
    .order("created_at", { ascending: false });

  if (options.status) query = query.eq("status", options.status);
  if (options.party) query = query.eq("party", options.party);

  const limit = Math.min(options.limit || 20, 100);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  return { promises: data || [], total: data?.length || 0 };
}

export async function getPoliticianHistory(name: string): Promise<any[]> {
  const { data } = await supabase
    .from("promises")
    .select("ano_eleitoral, status, fulfillment_score, promise_title, created_at")
    .ilike("politician_name", `%${name}%`)
    .order("ano_eleitoral", { ascending: true });

  const byYear: Record<number, any[]> = {};
  (data || []).forEach((p: any) => {
    const year = p.ano_eleitoral || 0;
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(p);
  });

  return Object.entries(byYear)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, promises]) => {
      const total = promises.length;
      const fulfilled = promises.filter((p: any) => mapStatus(p.status) === "fulfilled").length;
      const avgScore = promises.reduce((acc: number, p: any) => acc + (p.fulfillment_score || 0), 0) / total;
      return {
        year: Number(year),
        total,
        fulfilled,
        rate: total > 0 ? Math.round((fulfilled / total) * 100) : 0,
        avg_score: Math.round(avgScore),
        promises
      };
    });
}

export default { getElectionData, getAvailableElectionYears, getElectionComparison, getPromiseByElection, getPoliticianHistory };