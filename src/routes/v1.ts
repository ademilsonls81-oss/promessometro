import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getRanking, getRankingStats, comparePoliticians } from "../services/rankingService.js";
import { getElectionData, getAvailableElectionYears, getElectionComparison, getPromiseByElection, getPoliticianHistory } from "../services/electionService.js";
import { search, suggest } from "../services/searchService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/politicians", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { state, party, position, year, minScore, maxScore, cursor, limit } = req.query;
    const result = await getRanking(supabase, {
      state: state as string,
      party: party as string,
      position: position as string,
      year: year ? Number(year) : undefined,
      minScore: minScore ? Number(minScore) : undefined,
      maxScore: maxScore ? Number(maxScore) : undefined,
      cursor: cursor as string,
      limit: limit ? Number(limit) : 20
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/politicians/compare", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name1, name2 } = req.query;
    if (!name1 || !name2) return res.status(400).json({ error: "name1 and name2 are required" });
    const result = await comparePoliticians(supabase, name1 as string, name2 as string);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}));

router.get("/politicians/history/:name", asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await getPoliticianHistory(supabase, req.params.name);
    res.json({ history: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/promises", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { q, state, party, year, status, category, limit } = req.query;
    const result = await search({
      q: q as string,
      state: state as string,
      party: party as string,
      year: year ? Number(year) : undefined,
      status: status as string,
      category: category as string,
      limit: limit ? Number(limit) : 20
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/search", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { q, state, party, year, status, limit } = req.query;
    const result = await search({
      q: q as string,
      state: state as string,
      party: party as string,
      year: year ? Number(year) : undefined,
      status: status as string,
      limit: limit ? Number(limit) : 20
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/suggest", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    if (!q || (q as string).length < 2) return res.json({ promises: [], politicians: [] });
    const result = await suggest(q as string, limit ? Number(limit) : 5);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/elections", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const years = await getAvailableElectionYears(supabase);
    res.json({ years });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/elections/:year", asyncHandler(async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);
    const { status, party, limit } = req.query;
    const [electionData, promises] = await Promise.all([
      getElectionData(supabase, year),
      getPromiseByElection(supabase, year, {
        status: status as string,
        party: party as string,
        limit: limit ? Number(limit) : 20
      })
    ]);
    res.json({ ...electionData, promises: promises.promises });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/elections/compare", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { years } = req.query;
    const yearList = years ? (years as string).split(",").map(Number) : [2022, 2024];
    const result = await getElectionComparison(supabase, yearList);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result = await getRankingStats(supabase);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

router.get("/docs", asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    name: "PromessÃ´metro API v1",
    version: "1.0.0",
    description: "API pÃºblica para consulta de promessas polÃ­ticas brasileiras",
    endpoints: [
      { method: "GET", path: "/api/v1/politicians", description: "Lista de polÃ­ticos com ranking" },
      { method: "GET", path: "/api/v1/politicians/compare", description: "Comparar dois polÃ­ticos", params: "name1, name2" },
      { method: "GET", path: "/api/v1/politicians/history/:name", description: "HistÃ³rico de um polÃ­tico por eleiÃ§Ã£o" },
      { method: "GET", path: "/api/v1/promises", description: "Lista de promessas com filtros" },
      { method: "GET", path: "/api/v1/search", description: "Busca integrada", params: "q, state, party, year, status" },
      { method: "GET", path: "/api/v1/suggest", description: "SugestÃµes de autocomplete", params: "q, limit" },
      { method: "GET", path: "/api/v1/elections", description: "Anos eleitorais disponÃ­veis" },
      { method: "GET", path: "/api/v1/elections/:year", description: "Dados de uma eleiÃ§Ã£o" },
      { method: "GET", path: "/api/v1/stats", description: "EstatÃ­sticas gerais" }
    ]
  });
}));

export default router;