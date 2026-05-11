import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Users, TrendingUp, TrendingDown, Loader2, ArrowRight, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { comparePoliticians } from "../services/rankingService.js";
import SEO from "../components/SEO.js";
import { ShareButtons } from "../components/ShareButtons.js";

export default function ComparePage() {
  const { names } = useParams<{ names: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (names) {
      const parts = names.split("-vs-");
      if (parts.length === 2) {
        fetchCompare(parts[0], parts[1]);
      } else {
        setError("URL inválida. Use o formato: /comparar/nome1-vs-nome2");
        setLoading(false);
      }
    }
  }, [names]);

  async function fetchCompare(name1: string, name2: string) {
    setLoading(true);
    try {
      const result = await comparePoliticians(name1, name2);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar comparação");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-5xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="text-center py-20">
            <Users className="w-16 h-16 mx-auto text-gray-700 mb-4" />
            <p className="text-red-400 text-xl mb-4">{error || "Comparação não encontrada"}</p>
            <p className="text-gray-500 mb-6">Use o formato: /comparar/lula-vs-bolsonaro</p>
          </div>
        </div>
      </div>
    );
  }

  const { politician1, politician2, comparison } = data;
  const winner = comparison.better_score;
  const url = window.location.href;

  const p1Color = politician1.percentage >= 70 ? "text-green-400" : politician1.percentage >= 40 ? "text-yellow-400" : "text-red-400";
  const p2Color = politician2.percentage >= 70 ? "text-green-400" : politician2.percentage >= 40 ? "text-yellow-400" : "text-red-400";

  const statusIcon = (p: any) => {
    const rate = p.percentage;
    if (rate >= 70) return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    if (rate >= 40) return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    return <XCircle className="w-5 h-5 text-red-400" />;
  };

  return (
    <>
      <SEO
        title={`Comparação: ${politician1.name} vs ${politician2.name} | Promessômetro`}
        description={`Compare o score de cumprimento de promessas entre ${politician1.name} e ${politician2.name}.`}
        path={`/comparar/${names}`}
        type="website"
      />

      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-6xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar para o Ranking
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-display font-bold mb-4">
              Comparação de Políticos
            </h1>
            <p className="text-gray-400 text-lg">Score de cumprimento de promessas</p>
            <div className="mt-4 flex justify-center">
              <ShareButtons
                data={{
                  title: `Comparação: ${politician1.name} vs ${politician2.name}`,
                  text: `Compare o score: ${politician1.name} (${politician1.percentage}%) vs ${politician2.name} (${politician2.percentage}%)`,
                  url
                }}
                compact={true}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {[politician1, politician2].map((p, idx) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-dark-card border rounded-3xl p-8 ${p.name === winner ? "border-neon-cyan/50" : "border-white/5"}`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center border border-white/10">
                      <span className="text-xl font-bold text-white/50">
                        {p.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{p.name}</h2>
                      <p className="text-gray-500 text-sm">{p.party || "Sem partido"} • {p.state || "BR"}</p>
                    </div>
                  </div>
                  {p.name === winner && (
                    <span className="px-3 py-1 bg-neon-cyan/20 text-neon-cyan text-sm font-bold rounded-full border border-neon-cyan/30">
                      Melhor Score
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Score de Cumprimento</span>
                    <div className="flex items-center gap-2">
                      {statusIcon(p)}
                      <span className={`text-4xl font-bold ${idx === 0 ? p1Color : p2Color}`}>{p.percentage}%</span>
                    </div>
                  </div>
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.percentage}%` }}
                      transition={{ delay: 0.5 + idx * 0.1, duration: 0.8 }}
                      className={`h-full rounded-full ${p.percentage >= 70 ? "bg-green-500" : p.percentage >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <div className="text-xl font-bold text-green-400">{p.stats.fulfilled}</div>
                    <div className="text-gray-500 text-xs">Cumpridas</div>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                    <div className="text-xl font-bold text-yellow-400">{p.stats.partial}</div>
                    <div className="text-gray-500 text-xs">Parciais</div>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-xl">
                    <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                    <div className="text-xl font-bold text-red-400">{p.stats.broken}</div>
                    <div className="text-gray-500 text-xs">Quebradas</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <div className="text-xl font-bold text-gray-400">{p.stats.total}</div>
                    <div className="text-gray-500 text-xs">Total</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-dark-card border border-white/5 rounded-3xl p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-neon-purple" />
              Resumo Comparativo
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-gray-400">Diferença de score</span>
                <span className={`font-bold text-lg ${comparison.score_diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {comparison.score_diff >= 0 ? "+" : ""}{comparison.score_diff}%
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-gray-400">Total de promessas</span>
                <span className="font-bold">
                  {politician1.stats.total} vs {politician2.stats.total}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-gray-400">Promessas cumpridas</span>
                <span className="font-bold text-green-400">
                  {politician1.stats.fulfilled} vs {politician2.stats.fulfilled}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-gray-400">Vencedor por score</span>
                <span className="font-bold text-neon-cyan">{winner}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}