// =============================================
// Promessômetro - Pipeline de Evidências via RSS
// Busca notícias automaticamente e relaciona com promessas
// =============================================

import { supabase } from "../lib/supabase.js";
import Parser from "rss-parser";

const parser = new Parser();

// Fontes RSS brasileiras
const RSS_FEEDS = [
  { name: "G1 Política", url: "https://g1.globo.com/rss/g1/politica/", category: "politica" },
  { name: "UOL Notícias", url: "https://rss.uol.com.br/feed/noticias.xml", category: "politica" },
  { name: "Folha Poder", url: "https://feeds.folha.uol.com.br/poder/rss091.xml", category: "politica" },
  { name: "Estadão Política", url: "https://www.estadao.com.br/rss/politica/", category: "politica" },
  { name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/politica/feed.rss", category: "politica" },
];

interface Article {
  title: string;
  link: string;
  content: string;
  pubDate: string;
  feedName: string;
}

// Buscar artigos de todos os feeds
async function fetchRSSFeeds(): Promise<Article[]> {
  const allArticles: Article[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[RSS] Fetching: ${feed.name}`);
      const parsed = await parser.parseURL(feed.url);
      
      for (const item of parsed.items || []) {
        allArticles.push({
          title: item.title || "",
          link: item.link || "",
          content: item.contentSnippet || item.content || "",
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          feedName: feed.name,
        });
      }
    } catch (err) {
      console.error(`[RSS] Error fetching ${feed.name}:`, err);
    }
  }

  console.log(`[RSS] Total articles fetched: ${allArticles.length}`);
  return allArticles;
}

// Usar GroQ para analisar se artigo é relevantes para promessa
async function analyzeWithAI(articleTitle: string, articleContent: string, promiseTitle: string): Promise<{
  is_relevant: boolean;
  relevance_score: number;
  analysis: string;
} | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[Evidence] GROQ_API_KEY not configured");
    return null;
  }

  const prompt = `Analise se a notícia abaixo é relevante para verificar a promessa política.

Notícia: "${articleTitle}"
Conteúdo: ${articleContent.substring(0, 500)}
Promessa: "${promiseTitle}"

Retorne JSON: {"is_relevant": true/false, "relevance_score": 0-100, "analysis": "breve justificativa em português"}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-8e-award-winning-20250516",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 256,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    console.error("[Evidence] AI error:", err);
    return null;
  }
}

// Pipeline principal
export async function runEvidencePipeline(): Promise<{
  articles_fetched: number;
  articles_saved: number;
  evidences_found: number;
}> {
  console.log("[Evidence] Starting pipeline...");

  // 1. Buscar artigos RSS
  const articles = await fetchRSSFeeds();
  
  // 2. Buscar promessas cadastradas
  const { data: promises } = await supabase
    .from("promises")
    .select("id, promise_title, politician_name, status")
    .not("status", "eq", "cumprida")
    .not("status", "eq", "descumprida");

  console.log(`[Evidence] Found ${promises?.length || 0} promises to check`);

  let evidencesFound = 0;
  let articlesSaved = 0;

  // 3. Para cada artigo, verificar se relaciona com alguma promessa
  for (const article of articles.slice(0, 50)) { // Limite para não sobrecarregar
    // Verificar se já processamos este link
    const { data: existing } = await supabase
      .from("rss_articles")
      .select("id")
      .eq("link", article.link)
      .single();

    if (existing) continue; // Já processado

    // Salvar artigo
    await supabase.from("rss_articles").insert({
      title: article.title,
      link: article.link,
      content: article.content,
      published_at: article.pubDate,
    });
    articlesSaved++;

    // Verificar relevância com promessas
    for (const promise of promises || []) {
      const searchTerm = promise.promise_title.toLowerCase();
      const articleText = (article.title + " " + article.content).toLowerCase();

      // Verificação simples de palavras-chave
      const keywords = searchTerm.split(" ").filter(w => w.length > 4);
      const hasMatch = keywords.some(k => articleText.includes(k));

      if (hasMatch) {
        // Salvar evidência pendente
        await supabase.from("promise_evidences").insert({
          promise_id: promise.id,
          evidence_link: article.link,
          evidence_description: article.title,
          source_name: article.feedName,
          tipo: "news",
          source_type: "rss"
        });
        
        evidencesFound++;
        console.log(`[Evidence] Found evidence: ${promise.promise_title} - ${article.title.substring(0, 50)}`);
        
        break; // Uma evidência por artigo é suficiente
      }
    }
  }

  console.log(`[Evidence] Pipeline complete: ${articlesSaved} articles, ${evidencesFound} evidences`);

  return {
    articles_fetched: articles.length,
    articles_saved: articlesSaved,
    evidences_found: evidencesFound
  };
}

// Executar a cada 6 horas
export async function scheduleEvidencePipeline() {
  const result = await runEvidencePipeline();
  
  // Notificar admin se encontrou novas evidências
  if (result.evidences_found > 0) {
    console.log(`[Evidence] 🚀 ${result.evidences_found} novas evidências encontradas!`);
  }
  
  return result;
}

// Export
export default {
  runEvidencePipeline,
  scheduleEvidencePipeline
};