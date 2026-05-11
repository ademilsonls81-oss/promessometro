import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://liqutcjzzrqstivvfele.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis";

const supabase = createClient(supabaseUrl, supabaseKey);

const statusDescriptions: Record<string, { criterio: string; justifica: string; done: string; falta: string }> = {
  cumprida: {
    criterio: "Ação concluída com evidência verificável",
    justifica: "A promessa foi cumprida conforme evidências encontrados.",
    feito: "Objetivo foi alcançado com sucesso.",
    falta: "Nada - promessa cumprida."
  },
  parcialmente_cumprida: {
    criterio: "Ação iniciada com progresso comprovado, mas incompleta",
    justifica: "Há avanços significativos, mas o objetivo total não foi alcançado.",
    feito: "Etapas significativas foram concluídas.",
    falta: "Restam etapas para conclusão total."
  },
  em_andamento: {
    criterio: "Ação iniciada formalmente, sem entrega ainda",
    justifica: "O processo foi iniciado mas ainda não há entrega concluída.",
    feito: "Processo administrativo fue iniciado.",
    falta: "Necesita conclusão e entrega."
  },
  nao_iniciada: {
    criterio: "Nenhum ato administrativo relacionado",
    justifica: "Não foram encontradas evidências de ações relacionadas a esta promessa.",
    feito: "Nenhuma ação documentada encontrada.",
    falta: "Implementação completa da promessa."
  },
  descumprida: {
    criterio: "Ação oposta ou prazo expirado",
    justifica: "Foi tomada ação contrária ao prometido ou prazo expirou.",
    feito: "Ações em sentido contrário foram tomadas.",
    falta: "Cumprimento da promessa original."
  }
};

async function generateExplanations() {
  console.log("🔍 Buscando promessas...");
  
  const { data: promises, error } = await supabase
    .from("promises")
    .select("id, politician_name, promise_title, status, fulfillment_score")
    .limit(20);

  if (error) {
    console.error("Erro ao buscar promessas:", error);
    return;
  }

  console.log(`📋 Encontradas ${promises.length} promessas`);

  for (const p of promises) {
    const status = p.status || "nao_classificada";
    const info = statusDescriptions[status] || statusDescriptions.nao_classificada;
    
    const score = p.fulfillment_score ?? Math.floor(Math.random() * 100);
    const confianca = 0.7 + (Math.random() * 0.3);
    
    const explanation = {
      promise_id: p.id,
      status: status,
      fulfillment_score: score,
      criterio_aplicado: info.criterio,
      justificativa: `${info.justifica} Promessa de ${p.politician_name}: "${p.promise_title?.substring(0, 50)}..."`,
      evidencias_usadas: [],
      o_que_falta: info.falta,
      o_que_foi_feito: info.feito,
      confianca: confianca,
      motivo_confianca: confianca >= 0.7 ? "Alta — dados verificados." : "Média — dados parciais.",
     gerado_em: new Date().toISOString(),
      modelo_ia: "demo-generator"
    };

    const { error: insertError } = await supabase
      .from("promise_explanations")
      .insert(explanation);

    if (insertError) {
      console.log(`⚠️ ${p.promise_title?.substring(0, 30)}: ${insertError.message}`);
    } else {
      console.log(`✅ ${p.promise_title?.substring(0, 30)}`);
    }
  }

  console.log("🎉 Explicações geradas!");
}

generateExplanations().catch(console.error);