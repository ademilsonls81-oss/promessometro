import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ChevronLeft, Trophy, Loader2 } from "lucide-react";
import { getRanking } from "../services/rankingService.js";
import SEO from "../components/SEO.js";

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins", BR: "Brasil (Federal)"
};

export default function StatePage() {
  const [state, setState] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/estado\/([A-Z]{2}|BR)/i);
    if (match) {
      setState(match[1].toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (state) fetchState(state);
  }, [state]);

  async function fetchState(uf: string) {
    setLoading(true);
    try {
      const result = await getRanking({ state: uf, limit: 50, sortBy: "percentage", sortOrder: "desc" });
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const ufName = UF_NAMES[state] || state;

  return (
    <>
      <SEO
        title={`Políticos de ${ufName} | Promessômetro`}
        description={`Acompanhe o ranking de promessas dos políticos de ${ufName}. Score de cumprimento e estatísticas por partido.`}
        path={`/estado/${state}`}
        type="website"
      />

      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-6xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar para o Ranking
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <MapPin className="w-6 h-6 text-neon-cyan" />
            </div>
            <div>
              <span className="text-sm font-bold text-neon-cyan tracking-wider uppercase">{state}</span>
              <h1 className="text-4xl md:text-5xl font-display font-bold">{ufName}</h1>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-400 text-xl">{error}</p>
            </div>
          ) : data && data.total > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                <div className="bg-dark-card border border-white/5 p-6 rounded-3xl">
                  <div className="text-3xl font-bold text-neon-cyan">{data.total}</div>
                  <div className="text-gray-500 text-sm">Políticos</div>
                </div>
                <div className="bg-dark-card border border-white/5 p-6 rounded-3xl">
                  <div className="text-3xl font-bold text-green-400">
                    {data.politicians.filter((p: any) => p.percentage >= 70).length}
                  </div>
                  <div className="text-gray-500 text-sm">Alta performance (70%+)</div>
                </div>
                <div className="bg-dark-card border border-white/5 p-6 rounded-3xl">
                  <div className="text-3xl font-bold text-yellow-400">
                    {Math.round(data.politicians.reduce((acc: number, p: any) => acc + p.percentage, 0) / data.total)}%
                  </div>
                  <div className="text-gray-500 text-sm">Score médio</div>
                </div>
              </div>

              <div className="space-y-4">
                {data.politicians.map((p: any, idx: number) => (
                  <Link key={p.name} to={`/comparar/${p.slug}-vs-${data.politicians[0]?.slug || p.slug}`} className="block">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group bg-dark-card border border-white/5 hover:border-white/10 p-4 md:p-6 rounded-3xl transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`text-2xl font-bold w-8 ${idx < 3 ? "text-yellow-400" : "text-gray-700"}`}>
                          {idx + 1}º
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center">
                          <span className="font-bold text-white/50">{p.name[0]}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold group-hover:text-neon-cyan transition-colors">{p.name}</h3>
                          <p className="text-gray-500 text-sm">{p.party || ""}</p>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${p.percentage >= 70 ? "text-green-400" : p.percentage >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                            {p.percentage}%
                          </div>
                          <div className="text-gray-500 text-xs">{p.stats.total} promessas</div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <MapPin className="w-16 h-16 mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500 text-lg">Nenhum político encontrado para {ufName}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}