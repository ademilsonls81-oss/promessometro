import { supabase } from "../lib/supabase.js";
import Parser from "rss-parser";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1"
});

const parser = new Parser();

interface EvidenceResult {
  source: string;
  sourceType: string;
  sourceCredibility: number;
  title: string;
  content: string;
  url: string;
  publishedDate: string | null;
  relevanceScore: number;
  evidenceType: string;
  aiAnalysis: any;  // any-ok
}

interface SearchContext {
  promiseTitle: string;
  promiseDescription?: string;
  politicianName: string;
  category?: string;
}

const EVIDENCE_SEARCH_SOURCES = [
  { name: "G1 - Politique", url: "https://g1.globo.com/politica/rss/", type: "journalism", credibility: 90 },
  { name: "G1 - Brazil News", url: "https://g1.globo.com/rss/g1/", type: "journalism", credibility: 90 },
  { name: "UOL - Política", url: "https://noticias.uol.com.br/politica/rss.xml", type: "journalism", credibility: 85 },
  { name: "Folha de S.Paul", url: "https://feeds.folha.uol.com.br/poder/rss.xml", type: "journalism", credibility: 90 },
  { name: "Estadão - Política", url: "https://politica.estadao.com.br/rss", type: "journalism", credibility: 90 },
  { name: "Portal da Transparência", url: "https://portaldatransparencia.gov.br/rss/descargas.xml", type: "government", credibility: 100 },
  { name: "Senado News", url: "https://www12.senado.leg.br/noticias/rss", type: "government", credibility: 95 },
  { name: "Câmara News", url: "https://www.camara.leg.br/noticias/rss", type: "government", credibility: 95 },
  { name: "Governo Federal", url: "https://www.gov.br/rss/canal/500", type: "government", credibility: 95 },
  { name: "Poder360", url: "https://www.poder360.com.br/feed/", type: "journalism", credibility: 85 },
  { name: "Metropoles", url: "https://www.metropoles.com.br/feed", type: "journalism", credibility: 80 },
];

const FULFILLMENT_KEYWORDS = {
  fulfilled: [
    "entregue", "concluído", "inaugurado", "lançado", "implementado", "criado",
    "realizado", "executado", "cumprido", "atingiu", "meta alcançada", "pronto",
    "finalizado", "obra entregue", "unidade entregue", "inauguração", "sorteio",
    "contratado", "licitado", "aprovado", "autorizado", "sanctionado"
  ],
  partial: [
    "parcial", "parte", "fase", "em andamento", "em execução", "em construção",
    "em implantação", "previsão", "cronograma", "etapa", "primeira fase",
    "segunda fase", "partial", "partialmente"
  ],
  broken: [
    "atrasado", "cancelado", "descumpriu", "não cumprido", "falha", "fracasso",
    "abandono", "interrompido", "suspenso", "revogado", "derrogado", "ineficaz",
    "não atingida", "meta não cumprida", "promessa descumprida", "demora",
    "problema", "escândalo", "investigação", "denúncia", "irregularidade"
  ]
};

export async function searchEvidenceForPromise(context: SearchContext): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = [];
  const searchTerms = buildSearchTerms(context);

  console.log(`[Evidence] Searching for: ${searchTerms.join(", ")}`);

  for (const source of EVIDENCE_SEARCH_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items || [];

      for (const item of items.slice(0, 20)) {
        const title = item.title || "";
        const content = (item.content || item.contentSnippet || "").substring(0, 2000);
        const fullText = `${title} ${content}`.toLowerCase();

        const matchesSearch = searchTerms.some(term => fullText.includes(term.toLowerCase()));
        
        if (matchesSearch) {
          const relevanceScore = calculateRelevance(title, content, searchTerms);
          const evidenceType = await analyzeEvidenceType(title, content, context);
          const aiAnalysis = await analyzeWithAI(title, content, context, evidenceType);

          results.push({
            source: source.name,
            sourceType: source.type,
            sourceCredibility: source.credibility,
            title: item.title || "",
            content: content.substring(0, 1000),
            url: item.link || "",
            publishedDate: item.pubDate || null,
            relevanceScore,
            evidenceType,
            aiAnalysis
          });
        }
      }
    } catch (err) {  // any-ok
      console.log(`[Evidence] Error fetching ${source.name}: ${err.message}`);
    }
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, 10);
}

function buildSearchTerms(context: SearchContext): string[] {
  const terms = [context.politicianName];
  
  const titleWords = context.promiseTitle
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .filter(w => w.length > 3);
  
  terms.push(...titleWords.slice(0, 5));
  
  if (context.category) {
    terms.push(context.category);
  }
  
  return [...new Set(terms)];
}

function calculateRelevance(title: string, content: string, searchTerms: string[]): number {
  const fullText = `${title} ${content}`.toLowerCase();
  let score = 0;
  
  searchTerms.forEach(term => {
    if (title.toLowerCase().includes(term.toLowerCase())) {
      score += 30;
    }
    if (content.toLowerCase().includes(term.toLowerCase())) {
      score += 10;
    }
  });

  return Math.min(score, 100);
}

async function analyzeEvidenceType(title: string, content: string, context: SearchContext): Promise<string> {
  const fullText = `${title} ${content}`.toLowerCase();
  
  const fulfilledCount = FULFILLMENT_KEYWORDS.fulfilled.filter(k => fullText.includes(k)).length;
  const brokenCount = FULFILLMENT_KEYWORDS.broken.filter(k => fullText.includes(k)).length;
  const partialCount = FULFILLMENT_KEYWORDS.partial.filter(k => fullText.includes(k)).length;

  if (fulfilledCount > brokenCount && fulfilledCount > partialCount) {
    return "fulfillment";
  } else if (brokenCount > fulfilledCount && brokenCount > partialCount) {
    return "break";
  } else if (partialCount > 0) {
    return "partial";
  }

  return "neutral";
}

async function analyzeWithAI(title: string, content: string, context: SearchContext, evidenceType: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em verificação de fatos políticos brasileiros.
Analise se esta evidência prova que uma promessa foi cumprida, quebrada, ou parcialmente cumprida.

Contexto da promessa:
- Político: ${context.politicianName}
- Promessa: ${context.promiseTitle}
- Categoria: ${context.category || "Não informada"}

Responda APENAS em JSON válido com esta estrutura:
{
  "verdict": "fulfilled|partial|broken|neutral|unrelated",
  "reasoning": "explicação de 1-2 frases",
  "key_facts": ["fato 1", "fato 2"],
  "confidence": 0-100,
  "evidence_quality": "high|medium|low"
}`
        },
        {
          role: "user",
          content: `Título: ${title}\n\nConteúdo: ${content.substring(0, 1500)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (result.verdict === "fulfilled" || result.verdict === "partial" || result.verdict === "broken") {
      return result;
    }
    
    return { ...result, evidence_type: evidenceType };
  } catch (err) {
    console.error("[Evidence] AI analysis error:", err);
    return { verdict: "neutral", confidence: 0, error: "AI analysis failed" };
  }
}

export async function saveEvidence(promiseId: string, evidence: EvidenceResult): Promise<string | null> {
  const { data, error } = await supabase.from("promise_evidences").insert({
    promise_id: promiseId,
    source_name: evidence.source,
    source_url: evidence.url,
    source_type: evidence.sourceType,
    source_credibility: evidence.sourceCredibility,
    title: evidence.title,
    content: evidence.content,
    published_date: evidence.publishedDate ? new Date(evidence.publishedDate).toISOString() : null,
    evidence_type: evidence.evidenceType,
    confidence_score: evidence.aiAnalysis?.confidence || evidence.relevanceScore,
    ai_analysis: evidence.aiAnalysis,
    validation_status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).select("id").single();

  if (error) {
    console.error("[Evidence] Save error:", error);
    return null;
  }

  return data?.id || null;
}

export async function autoSearchAndSaveForPromise(promiseId: string): Promise<number> {
  const { data: promise, error: promiseError } = await supabase
    .from("promises")
    .select("*")
    .eq("id", promiseId)
    .single();

  if (promiseError || !promise) {
    console.error("[Evidence] Promise not found:", promiseId);
    return 0;
  }

  const context: SearchContext = {
    promiseTitle: promise.promise_title,
    promiseDescription: promise.promise_description || undefined,
    politicianName: promise.politician_name,
    category: promise.category || undefined
  };

  const evidences = await searchEvidenceForPromise(context);
  let savedCount = 0;

  for (const evidence of evidences.slice(0, 5)) {
    const id = await saveEvidence(promiseId, evidence);
    if (id) savedCount++;
  }

  return savedCount;
}

export async function verifyEvidenceIntegrity(evidenceId: string): Promise<boolean> {
  try {
    const { data: evidence } = await supabase
      .from("promise_evidences")
      .select("*")
      .eq("id", evidenceId)
      .single();

    if (!evidence) return false;

    const hashInput = `${evidence.id}${evidence.title}${evidence.source_url}${evidence.content || ""}`;
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const { error } = await supabase
      .from("promise_evidences")
      .update({ blockchain_hash: hash, integrity_verified: true })
      .eq("id", evidenceId);

    return !error;
  } catch (err) {
    console.error("[Evidence] Verify error:", err);
    return false;
  }
}

export async function logValidation(evidenceId: string, action: string, userId: string, notes?: string): Promise<void> {
  await supabase.from("evidence_validation_logs").insert({
    evidence_id: evidenceId,
    action,
    user_id: userId,
    notes,
    created_at: new Date().toISOString()
  });
}