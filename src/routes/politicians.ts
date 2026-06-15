import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { get as cacheGet, set as cacheSet, invalidate as cacheInvalidate } from "../services/cacheService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

interface PoliticianStats {
  fulfilled: number;
  partial: number;
  broken: number;
  pending: number;
  total: number;
  percentage: number;
}

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { role, state, search, limit = 20, offset = 0 } = req.query;

    let query = supabase.from("politicians").select("*", { count: "exact" });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }
    if (role) {
      query = query.eq("position", role);
    }
    if (state) {
      query = query.eq("state", state);
    }

    const { data: politicians, error, count } = await query
      .order("name")
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const politiciansWithStats = await Promise.all(
      (politicians || []).map(async (p: any) => {  // any-ok
        const stats = await getPoliticianStats(p.name);
        return { ...p, stats };
      })
    );

    return res.json({ politicians: politiciansWithStats, total: count });
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/ranking", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const cacheKey = `ranking:${limit}:${offset}`;

    const cached = cacheGet<{ ranking: any[]; total: number; stats: any }>(cacheKey);  // any-ok
    if (cached) return res.json(cached);

    const { data: rankingData, error } = await supabase
      .from("politicians_ranking")
      .select("*")
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      const { data: promises, error: fallbackError } = await supabase
        .from("promises")
        .select("politician_name, status, fulfillment_score");

      if (fallbackError) {
        return res.status(500).json({ error: fallbackError.message });
      }

      const statsMap: Record<string, { fulfilled: number; partial: number; broken: number; pending: number; total: number; totalScore: number }> = {};

      (promises || []).forEach((p: any) => {  // any-ok
        const name = p.politician_name;
        if (!statsMap[name]) {
          statsMap[name] = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: 0, totalScore: 0 };
        }
        statsMap[name].total++;
        statsMap[name].totalScore += p.fulfillment_score || 50;

        switch (p.status) {
          case "cumprida":
          case "fulfilled":
            statsMap[name].fulfilled++;
            break;
          case "parcial":
          case "parcialmente_cumprida":
          case "em_andamento":
          case "partial":
          case "partial_fulfilled":
            statsMap[name].partial++;
            break;
          case "quebrada":
          case "descumprida":
          case "nao_cumprida":
          case "broken":
          case "not_fulfilled":
            statsMap[name].broken++;
            break;
          default:
            statsMap[name].pending++;
        }
      });

      const ranking = Object.entries(statsMap).map(([name, stats]) => {
        const percentage = stats.total > 0 ? Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100) : 50;
        return {
          name,
          role: null,
          state: null,
          party: null,
          stats,
          percentage,
          promise_count: stats.total
        };
      });

      ranking.sort((a, b) => b.percentage - a.percentage);

      const fallbackResult = { 
        ranking, 
        total: ranking.length,
        stats: {
          total_promises: promises?.length || 0,
          total_politicians: ranking.length
        }
      };
      cacheSet(cacheKey, fallbackResult);
      return res.json(fallbackResult);
    }

    const ranking = (rankingData || []).map((p: any) => ({  // any-ok
      id: p.id,
      name: p.name,
      slug: p.slug,
      photo_url: p.photo_url,
      party: p.party,
      role: p.role,
      state: p.state,
      stats: {
        fulfilled: p.fulfilled || 0,
        partial: p.partial || 0,
        broken: p.broken || 0,
        pending: (p.total_promises || 0) - (p.fulfilled || 0) - (p.partial || 0) - (p.broken || 0),
        total: p.total_promises || 0,
        percentage: p.percentage || 50
      },
      percentage: p.percentage || 50,
      promise_count: p.total_promises || 0
    }));

    const result = { 
      ranking, 
      total: ranking.length,
      stats: {
        total_promises: ranking.reduce((sum: number, p: any) => sum + (p.stats?.total || 0), 0),  // any-ok
        total_politicians: ranking.length
      }
    };
    cacheSet(cacheKey, result);
    return res.json(result);
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/:name", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    const { data: politician, error: politicianError } = await supabase
      .from("politicians")
      .select("*")
      .ilike("name", `%${decodedName}%`)
      .maybeSingle();

    if (politicianError) {
      return res.status(500).json({ error: politicianError.message });
    }

    const { data: promises, error: promisesError } = await supabase
      .from("promises")
      .select("*")
      .ilike("politician_name", `%${decodedName}%`)
      .order("created_at", { ascending: false });

    if (promisesError) {
      return res.status(500).json({ error: promisesError.message });
    }

    if (!promises || promises.length === 0) {
      return res.status(404).json({ error: "PolÃ­tico nÃ£o encontrado" });
    }

    const stats = calculateStats(promises);

    const politicianData = politician || {
      name: decodedName,
      party: null,
      position: null,
      state: null,
      photo_url: null
    };

    return res.json({
      ...politicianData,
      stats,
      promises: promises.map((p: any) => ({  // any-ok
        id: p.id,
        title: p.promise_title,
        description: p.promise_description,
        category: p.category,
        status: p.status,
        evidence: p.evidence,
        source_link: p.source_link,
        fulfillment_score: p.fulfillment_score,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
    });
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

async function getPoliticianStats(name: string): Promise<PoliticianStats> {
  const { data: promises } = await supabase
    .from("promises")
    .select("status")
    .ilike("politician_name", `%${name}%`);

  return calculateStats(promises || []);
}

function calculateStats(promises: any[]): PoliticianStats {  // any-ok
  const stats: PoliticianStats = {
    fulfilled: 0,
    partial: 0,
    broken: 0,
    pending: 0,
    total: promises.length,
    percentage: 50
  };

  promises.forEach((p: any) => {  // any-ok
    switch (p.status) {
      case "cumprida":
      case "fulfilled":
        stats.fulfilled++;
        break;
      case "parcial":
      case "parcialmente_cumprida":
      case "em_andamento":
      case "partial":
      case "partial_fulfilled":
        stats.partial++;
        break;
      case "quebrada":
      case "descumprida":
      case "nao_cumprida":
      case "broken":
      case "not_fulfilled":
        stats.broken++;
        break;
      default:
        stats.pending++;
    }
  });

  if (stats.total > 0) {
    stats.percentage = Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100);
  }

  return stats;
}

export default router;