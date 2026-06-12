import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Vote, ChevronLeft, Trophy, TrendingUp, CheckCircle2, AlertCircle, Clock, Loader2, Share2 } from "lucide-react";
import { getElectionData, getAvailableElectionYears } from "../services/electionService.js";
import SEO from "../components/SEO.js";
import { ShareButtons } from "../components/ShareButtons.js";
import { supabase } from "../lib/supabaseClient";

export default function ElectionPage() {
  const [year, setYear] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (year) fetchElection(year);
  }, [year]);

  async function loadYears() {
    try {
      const years = await getAvailableElectionYears(supabase);
      setAvailableYears(years);
      if (years.length > 0 && !year) {
        setYear(String(years[0]));
      }
    } catch {
      setAvailableYears([2022, 2024]);
      setYear("2022");
    }
  }

  async function fetchElection(y: string) {
    setLoading(true);
    try {
      const result = await getElectionData(supabase, Number(y));
      setData(result);
      setError(null);
    } catch (err) {  // any-ok
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {  // any-ok
    fulfilled: { label: "Cumpridas", color: "text-green-400", icon: CheckCircle2 },
    partial: { label: "Parciais", color: "text-yellow-400", icon: AlertCircle },
    broken: { label: "Quebradas", color: "text-red-400", icon: AlertCircle },
    pending: { label: "Pendentes", color: "text-gray-400", icon: Clock }
  };

  return (
    <>
      <SEO
        title={`Eleição ${year} | Promessômetro`}
        description={`Acompanhe as promessas da eleição ${year}. Rankings, comparativos e estatísticas dos políticos brasileiros.`}
        path={`/eleicao/${year}`}
        type="website"
      />

      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-6xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Link>

          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Vote className="w-6 h-6 text-neon-purple" />
                <span className="text-sm font-bold text-neon-purple tracking-wider uppercase">Ciclo Eleitoral</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold">
                Promessas <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan">de {year}</span>
              </h1>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="bg-dark-card border border-white/10 rounded-xl px-4 py-3 cursor-pointer min-h-[48px] focus:border-neon-purple outline-none"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>Eleição {y}</option>
                ))}
              </select>
              <ShareButtons
                data={{ title: `Promessas da Eleição ${year}`, text: `Acompanhe as promessas políticas da eleição ${year} no Promessômetro`, url: window.location.href }}
                compact={true}
              />
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
          ) : data && data.total_promises > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-dark-card border border-white/5 p-6 rounded-3xl"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                      <span className="text-gray-400 text-sm">{cfg.label}</span>
                    </div>
                    <div className={`text-3xl font-bold ${cfg.color}`}>
                      {data.by_status?.[key] || 0}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Ranking — Eleição {year}
                </h2>

                <div className="space-y-4">
                  {data.top_politicians.map((p: any, idx: number) => (  // any-ok
                    <Link key={p.name} to={`/politico/${p.slug}`} className="block">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group bg-dark-card border border-white/5 hover:border-white/10 p-4 md:p-6 rounded-3xl transition-all"
                      >
                        <div className="flex items-center gap-6">
                          <div className={`text-2xl font-bold w-10 ${idx < 3 ? "text-yellow-400" : "text-gray-700"}`}>
                            {idx + 1}º
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center">
                            <span className="font-bold text-white/50">{p.name[0]}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold group-hover:text-neon-cyan transition-colors">{p.name}</h3>
                            <p className="text-gray-500 text-sm">{p.party || ""} {p.state ? `· ${p.state}` : ""}</p>
                          </div>
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${p.percentage >= 70 ? "text-green-400" : p.percentage >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                              {p.percentage}%
                            </div>
                            <div className="text-gray-500 text-xs">{p.fulfilled}/{p.total}</div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <Vote className="w-16 h-16 mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500 text-lg">Nenhuma promessa encontrada para {year}</p>
              <p className="text-gray-600 text-sm mt-2">Adicione promessas na aba de submissão</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}