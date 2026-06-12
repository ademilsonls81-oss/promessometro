import { supabase } from "../lib/supabase.js";

export interface SearchFilter {
  q?: string;
  state?: string;
  party?: string;
  position?: string;
  year?: number;
  status?: string;
  category?: string;
  minScore?: number;
  maxScore?: number;
  cursor?: string;
  limit?: number;
}

export interface SearchResult {
  promises: any[];  // any-ok
  politicians: any[];  // any-ok
  total_promises: number;
  total_politicians: number;
  nextCursor: string | null;
}

const STATUS_MAP: Record<string, string[]> = {
  cumplida: ["cumprida", "fulfilled"],
  parcialmente: ["parcialmente_cumprida", "em_andamento"],
  andamento: ["em_andamento"],
  nao_iniciada: ["nao_iniciada"],
  descumprida: ["descumprida", "quebrada"],
  classificada: ["cumprida", "parcialmente_cumprida", "em_andamento", "descumprida", "nao_iniciada"]
};

export async function search(filters: SearchFilter): Promise<SearchResult> {
  const limit = Math.min(filters.limit || 20, 100);
  let promiseQuery = supabase
    .from("promises")
    .select("id, politician_name, promise_title, status, fulfillment_score, party, state, category, ano_eleitoral, created_at", { count: "exact" });

  if (filters.q) {
    promiseQuery = promiseQuery.or(`politician_name.ilike.%${filters.q}%,promise_title.ilike.%${filters.q}%`);
  }
  if (filters.state) promiseQuery = promiseQuery.eq("state", filters.state);
  if (filters.party) promiseQuery = promiseQuery.eq("party", filters.party);
  if (filters.position) promiseQuery = promiseQuery.eq("position", filters.position);
  if (filters.year) promiseQuery = promiseQuery.eq("ano_eleitoral", filters.year);
  if (filters.status) {
    const statuses = STATUS_MAP[filters.status] || [filters.status];
    promiseQuery = promiseQuery.in("status", statuses);
  }
  if (filters.category) promiseQuery = promiseQuery.eq("category", filters.category);
  if (filters.minScore !== undefined) promiseQuery = promiseQuery.gte("fulfillment_score", filters.minScore);
  if (filters.maxScore !== undefined) promiseQuery = promiseQuery.lte("fulfillment_score", filters.maxScore);

  const { data: promises, count, error } = await promiseQuery
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const promisesResult = (promises || []).map((p: any) => ({  // any-ok
    id: p.id,
    type: "promise",
    politician_name: p.politician_name,
    title: p.promise_title || p.title,
    status: p.status,
    fulfillment_score: p.fulfillment_score,
    party: p.party,
    state: p.state,
    category: p.category,
    year: p.ano_eleitoral,
    created_at: p.created_at,
    slug: generatePromiseSlug(p)
  }));

  const searchName = filters.q || "";
  let politicianQuery = supabase
    .from("politicians")
    .select("id, name, party, state, position", { count: "exact" });

  if (searchName) {
    politicianQuery = politicianQuery.or(`name.ilike.%${searchName}%,nome.ilike.%${searchName}%`);
  }
  if (filters.state) politicianQuery = politicianQuery.eq("state", filters.state);
  if (filters.party) politicianQuery = politicianQuery.eq("party", filters.party);
  if (filters.position) politicianQuery = politicianQuery.eq("position", filters.position);

  const { data: politicians, count: polCount } = await politicianQuery.limit(10);

  const politiciansResult = (politicians || []).map((p: any) => ({  // any-ok
    id: p.id,
    type: "politician",
    name: p.name || p.nome,
    party: p.party || p.partido,
    state: p.state || p.estado,
    position: p.position || p.cargo,
    slug: generateSlug(p.name || p.nome || "")
  }));

  return {
    promises: promisesResult,
    politicians: politiciansResult,
    total_promises: count || 0,
    total_politicians: polCount || 0,
    nextCursor: null
  };
}

function generateSlug(text: string): string {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function generatePromiseSlug(p: any): string {  // any-ok
  const title = p.promise_title || p.title || "";
  const name = p.politician_name || "";
  return generateSlug(`${title}-${name}`);
}

export async function suggest(q: string, limit: number = 5): Promise<{ promises: any[]; politicians: any[] }> {  // any-ok
  if (!q || q.length < 2) return { promises: [], politicians: [] };

  const [{ data: promises }, { data: politicians }] = await Promise.all([
    supabase
      .from("promises")
      .select("id, politician_name, promise_title, status, fulfillment_score")
      .or(`politician_name.ilike.%${q}%,promise_title.ilike.%${q}%`)
      .limit(limit),
    supabase
      .from("politicians")
      .select("id, name, party, state")
      .or(`name.ilike.%${q}%,nome.ilike.%${q}%`)
      .limit(limit)
  ]);

  return {
    promises: (promises || []).map((p: any) => ({  // any-ok
      id: p.id,
      label: `${p.politician_name}: ${p.promise_title || p.title}`,
      status: p.status,
      url: `/promessa/${generatePromiseSlug(p)}`
    })),
    politicians: (politicians || []).map((p: any) => ({  // any-ok
      id: p.id,
      label: p.name || p.nome,
      party: p.party || p.partido,
      url: `/politico/${generateSlug(p.name || p.nome || "")}`
    }))
  };
}

export default { search, suggest };