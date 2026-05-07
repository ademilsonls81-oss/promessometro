import OpenAI from "openai";
import { supabaseAdmin as supabase } from "../lib/supabaseAdmin.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1"
});

export interface PromiseAnalysis {
  isPolitical: boolean;
  containsPromise: boolean;
  politicianName?: string;
  promiseTitle?: string;
  promiseDescription?: string;
  category?: string;
  statusUpdate?: "fulfilled" | "partial" | "broken" | "pending";
  evidenceShort?: string;
}

export async function analyzeNewsForPromises(content: string): Promise<PromiseAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant", // Usando Groq para velocidade
      messages: [
        {
          role: "system",
          content: `Você é um especialista em política brasileira e checagem de fatos. 
          Sua tarefa é analisar textos de notícias e identificar:
          1. Se menciona um político brasileiro.
          2. Se menciona uma promessa feita por ele (nova ou atualização de uma existente).
          3. O status dessa promessa com base no texto.
          
          Responda estritamente em JSON no formato:
          {
            "isPolitical": boolean,
            "containsPromise": boolean,
            "politicianName": string | null,
            "promiseTitle": string | null,
            "promiseDescription": string | null,
            "category": "Saúde" | "Educação" | "Segurança" | "Economia" | "Infraestrutura" | "Outros" | null,
            "statusUpdate": "fulfilled" | "partial" | "broken" | "pending" | null,
            "evidenceShort": string | null
          }`
        },
        {
          role: "user",
          content: `Analise o seguinte texto:\n\n${content.substring(0, 4000)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (err) {
    console.error("AI Analysis error:", err);
    return { isPolitical: false, containsPromise: false };
  }
}

export async function processNewsQueue() {
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "pending")
    .limit(5);

  if (!posts) return;

  for (const post of posts) {
    const analysis = await analyzeNewsForPromises(post.content_raw || post.title);
    
    if (analysis.isPolitical && analysis.containsPromise && analysis.politicianName) {
      console.log(`[AI] Promessa detectada para ${analysis.politicianName}: ${analysis.promiseTitle}`);
      
      // Aqui haveria lógica para:
      // 1. Buscar o político no banco ou criar se não existir
      // 2. Buscar promessa parecida ou criar nova
      // 3. Vincular a evidência (post.link)
      
      await supabase.from("posts").update({ 
        status: "published",
        metadata: { analysis } 
      }).eq("id", post.id);
    } else {
      await supabase.from("posts").update({ status: "archived" }).eq("id", post.id);
    }
  }
}
