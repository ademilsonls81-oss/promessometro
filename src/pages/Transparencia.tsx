import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Clock, CheckCircle2, FileText, Github, Cpu, RefreshCw, AlertTriangle, TrendingUp, Users, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Transparencia() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [
        { count: totalPromises },
        { count: totalContestations },
        { count: pendingContestations },
        { count: totalExplanations },
        { count: lowConfidence },
        { data: latestExplanations }
      ] = await Promise.all([
        supabase.from("promises").select("*", { count: "exact", head: true }),
        supabase.from("promise_contestations").select("*", { count: "exact", head: true }),
        supabase.from("promise_contestations").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("promise_explanations").select("*", { count: "exact", head: true }),
        supabase.from("promise_explanations").select("*", { count: "exact", head: true }).lt("confianca", 0.4),
        supabase.from("promise_explanations").select("*, promises(promise_title, politician_name)").eq("is_latest", true).order("gerado_em", { ascending: false }).limit(5)
      ]);

      setStats({
        totalPromises: totalPromises || 0,
        totalContestations: totalContestations || 0,
        pendingContestations: pendingContestations || 0,
        totalExplanations: totalExplanations || 0,
        lowConfidence: lowConfidence || 0,
        aiModel: "llama-3.3-70b-versatile",
        lastUpdate: latestExplanations?.[0]?.gerado_em || new Date().toISOString(),
        latestChanges: latestExplanations || []
      });
    } catch (err) {
      console.error("[Transparencia] Error:", err);
      setStats({
        totalPromises: 0, totalContestations: 0, pendingContestations: 0,
        totalExplanations: 0, lowConfidence: 0, aiModel: "llama-3.3-70b-versatile",
        lastUpdate: new Date().toISOString(), latestChanges: []
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pt-12 pb-24 px-4 bg-background">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-neon-purple/20 rounded-xl">
              <Eye className="w-6 h-6 text-neon-purple" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Transparência</h1>
          </div>
          <p className="text-gray-500 text-sm mb-12">Dados abertos sobre nosso sistema de avaliação</p>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
            </div>
          ) : (
            <div className="space-y-12">
              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-neon-cyan" />
                  Estatísticas do Sistema
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Promessas", value: stats?.totalPromises || 0, icon: FileText, color: "text-neon-cyan" },
                    { label: "Avaliações IA", value: stats?.totalExplanations || 0, icon: Cpu, color: "text-neon-purple" },
                    { label: "Contestações", value: stats?.totalContestations || 0, icon: AlertTriangle, color: "text-yellow-400" },
                    { label: "Pendentes", value: stats?.pendingContestations || 0, icon: Clock, color: "text-orange-400" }
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-dark-card border border-white/5 p-6 rounded-2xl text-center"
                    >
                      <item.icon className={`w-6 h-6 mx-auto mb-3 ${item.color}`} />
                      <div className={`text-3xl font-bold ${item.color}`}>{item.value.toLocaleString("pt-BR")}</div>
                      <div className="text-gray-500 text-sm mt-1">{item.label}</div>
                    </motion.div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-neon-purple" />
                  Modelos de IA Utilizados
                </h2>
                <div className="bg-dark-card border border-white/5 rounded-2xl p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div>
                        <p className="text-white font-medium">llama-3.3-70b-versatile</p>
                        <p className="text-gray-500 text-sm">Groq API — Classificação de promessas</p>
                      </div>
                      <span className="px-3 py-1 bg-neon-purple/20 text-neon-purple text-xs font-medium rounded-full border border-neon-purple/30">
                        Ativo
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div>
                        <p className="text-white font-medium">Confiança &lt; 40%</p>
                        <p className="text-gray-500 text-sm">Avaliações com baixa confiança: {stats?.lowConfidence || 0}</p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/30">
                        Revisão recomendada
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-neon-cyan" />
                  Última Atualização
                </h2>
                <div className="bg-dark-card border border-white/5 rounded-2xl p-6">
                  <p className="text-gray-400 text-sm">
                    Última avaliação gerada:{" "}
                    <span className="text-white font-medium">
                      {stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleString("pt-BR") : "N/A"}
                    </span>
                  </p>
                  <Link
                    to="/auditoria"
                    className="inline-flex items-center gap-2 mt-4 text-neon-cyan hover:text-white text-sm transition-colors"
                  >
                    Ver histórico completo de alterações <ArrowLeft className="w-4 h-4 rotate-180" />
                  </Link>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Github className="w-5 h-5 text-white" />
                  Código Aberto
                </h2>
                <div className="bg-dark-card border border-white/5 rounded-2xl p-6">
                  <p className="text-gray-400 leading-relaxed mb-4">
                    Todo o sistema é de código aberto. Você pode verificar como funcionamos, auditar nossa metodologia e contribuir com melhorias.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="https://github.com/brunocosta/promessometro"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      Repositório GitHub
                    </a>
                    <Link
                      to="/api/v1/docs"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Documentação da API
                    </Link>
                    <Link
                      to="/auditoria"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Registro de Alterações
                    </Link>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-neon-cyan" />
                  Equipe e Governança
                </h2>
                <div className="bg-dark-card border border-white/5 rounded-2xl p-6">
                  <p className="text-gray-400 leading-relaxed mb-4">
                    O Promessômetro é um projeto independente de transparência política. Não temos vínculo com partidos, candidatos ou governos.
                  </p>
                  <ul className="space-y-2 text-gray-400 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-neon-cyan mt-0.5 shrink-0" />
                      Avaliações geradas por IA — sem interferência editorial
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-neon-cyan mt-0.5 shrink-0" />
                      Todos os critérios documentados e públicos
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-neon-cyan mt-0.5 shrink-0" />
                      Qualquer pessoa pode contestar uma avaliação
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-neon-cyan mt-0.5 shrink-0" />
                      Histórico completo de alterações acessível a todos
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}