import { supabase } from "../lib/supabase.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1"
});

export interface ScraperSource {
  name: string;
  url: string;
  selector?: string;
  type: "rss" | "html" | "api";
}

export const SCRAPER_SOURCES: ScraperSource[] = [
  { name: "G1 - Política", url: "https://g1.globo.com/politica/rss/", type: "rss" },
  { name: "UOL - Política", url: "https://noticias.uol.com.br/politica/rss.xml", type: "rss" },
  { name: "Folha - Poder", url: "https://feeds.folha.uol.com.br/poder/rss.xml", type: "rss" },
  { name: "Estadão - Política", url: "https://politica.estadao.com.br/rss", type: "rss" },
  { name: "CNN Brasil - Política", url: "https://www.cnnbrasil.com.br/politica/feed/", type: "rss" },
  { name: "Terra - Política", url: "https://www.terra.com.br/noticias/mundo/politica/rss.xml", type: "rss" },
];

interface ScraperResult {
  source: string;
  articlesFound: number;
  promisesDetected: number;
  errors: string[];
}

const POLITICAL_KEYWORDS = [
  "prometeu", "promessa", "compromisso", "garantia", "firmou", "assina",
  "defesa", "investimento", "reforma", "criação", "ampliação", "redução",
  "imposto", "saúde", "educação", "segurança", "emprego", "economia",
  "aposentadoria", "previdência", "moradia", "transporte", "meio ambiente"
];

function isPoliticalContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return POLITICAL_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

function extractPromisesFromText(text: string, politician?: string): string[] {
  const promises: string[] = [];
  
  const promisePatterns = [
    /(?:prometeu|promessa|compromisso)[:\s]+([^.]+\.)/gi,
    /"(?:vou|iremos|vamos|pretendo|garanto)[\s\w]+(?:criar|implantar|investir|reduzir|aumentar|construir|reformar)[\s\w]+/gi,
    /(?:meta|objetivo)[:\s]+([^.]+\.)/gi,
  ];

  for (const pattern of promisePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const promise = match[0].trim();
      if (promise.length > 20 && promise.length < 500) {
        promises.push(promise);
      }
    }
  }

  return [...new Set(promises)];
}

async function analyzeWithAI(title: string, content: string): Promise<{
  isPromise: boolean;
  politicianName?: string;
  promiseText?: string;
  category?: string;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em política brasileira. Analise se esta notícia contém uma promessa de político.
          
Responda APENAS em JSON válido:
{
  "isPromise": boolean,
  "politicianName": "string | null",
  "promiseText": "string | null", 
  "category": "Saúde|Educação|Segurança|Economia|Infraestrutura|Meio Ambiente|Trabalho|Outros|null",
  "confidence": 0-1
}

Seja rigoroso: apenas marque isPromise=true se houver uma promessa explícita de um político.`
        },
        {
          role: "user",
          content: `Título: ${title}\n\nConteúdo: ${content.substring(0, 2000)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      isPromise: result.isPromise || false,
      politicianName: result.politicianName || undefined,
      promiseText: result.promiseText || undefined,
      category: result.category || "Outros",
      confidence: result.confidence || 0
    };
  } catch (err) {
    console.error("AI analysis error:", err);
    return { isPromise: false, confidence: 0 };
  }
}

export async function scrapeNewsSources(): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  
  console.log(">>> [Scraper] Starting news sources scan...");

  for (const source of SCRAPER_SOURCES) {
    const result: ScraperResult = {
      source: source.name,
      articlesFound: 0,
      promisesDetected: 0,
      errors: []
    };

    try {
      if (source.type === "rss") {
        const Parser = (await import("rss-parser")).default;
        const parser = new Parser({ customFields: { item: [["content:encoded", "contentEncoded"]] } });
        
        const feed = await parser.parseURL(source.url);
        result.articlesFound = feed.items?.length || 0;

        for (const item of (feed.items || []).slice(0, 10)) {
          const title = item.title || "";
          const content = (item as any).contentEncoded || item.content || item.contentSnippet || "";
          
          if (!isPoliticalContent(title + content)) continue;

          const analysis = await analyzeWithAI(title, content);

          if (analysis.isPromise && analysis.confidence > 0.6) {
            const { error } = await supabase.from("promises").insert({
              politician_name: analysis.politicianName || "Político não identificado",
              promise_title: analysis.promiseText || title.substring(0, 200),
              promise_description: content.substring(0, 1000),
              category: analysis.category || "Outros",
              source_link: item.link || source.url,
              status: "pending_analysis",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: { 
                scraped: true, 
                source: source.name,
                title,
                confidence: analysis.confidence
              }
            });

            if (!error) {
              result.promisesDetected++;
              console.log(`[Scraper] Promise detected: ${analysis.politicianName} - ${analysis.promiseText?.substring(0, 50)}...`);
            }
          }
        }
      }
    } catch (err) {  // any-ok
      result.errors.push(err.message);
      console.error(`[Scraper] Error on ${source.name}: ${err.message}`);
    }

    results.push(result);
  }

  console.log(`>>> [Scraper] Finished. Processed ${results.length} sources.`);
  return results;
}

export async function runPromiseScraper(): Promise<{
  sourcesScanned: number;
  articlesFound: number;
  promisesSaved: number;
}> {
  const results = await scrapeNewsSources();
  
  return {
    sourcesScanned: results.length,
    articlesFound: results.reduce((sum, r) => sum + r.articlesFound, 0),
    promisesSaved: results.reduce((sum, r) => sum + r.promisesDetected, 0)
  };
}