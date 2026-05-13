import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Search, TrendingUp, TrendingDown, Clock, User, Loader2, Filter } from "lucide-react";
import { Button } from "../components/ui";
import { ShareButtons } from "../components/ShareButtons";
import { supabase } from "../lib/supabaseClient";

interface PoliticianStats {
  fulfilled: number;
  partial: number;
  broken: number;
  pending: number;
  total: number;
}

interface Politician {
  name: string;
  role: string | null;
  state: string | null;
  party: string | null;
  percentage: number;
  stats: PoliticianStats;
  promise_count: number;
}

interface RankingStats {
  total_promises: number;
  total_politicians: number;
  fulfilled_percentage: number;
  broken_percentage: number;
}

export default function Ranking() {
  const [ranking, setRanking] = useState<Politician[]>([]);
  const [stats, setStats] = useState<RankingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    fetchRanking();
  }, []);

  async function fetchRanking() {
    try {
      setLoading(true);
      
      // Buscar promessas - apenas campos que existem
      const { data: promises, error } = await supabase
        .from('promises')
        .select('id, politician_name, party, status, fulfillment_score');

      if (error) throw error;

      // Buscar políticos para get party/state
      const { data: politicians } = await supabase.from('politicians').select('id, name, party, state');

      const statsMap: Record<string, any> = {};
      
      (promises || []).forEach((p: any) => {
        const politicianKey = p.politician_name;
        
        // Find politician data
        const polData = politicians?.find((pol: any) => pol.name === p.politician_name);
        
        if (!statsMap[politicianKey]) {
          statsMap[politicianKey] = { 
            name: polData?.name || p.politician_name,
            party: polData?.party || p.party || null,
            state: polData?.state || null,
            cargo: 'Presidente',
            fulfilled: 0, 
            partial: 0, 
            broken: 0, 
            pending: 0 
          };
        }
        
        const status = p.status?.toLowerCase() || '';
        const hasScore = (p.fulfillment_score || 0) > 0;
        
        if ((status === 'cumprida') && hasScore) {
          statsMap[politicianKey].fulfilled++;
        } else if ((status === 'parcialmente_cumprida') && hasScore) {
          statsMap[politicianKey].partial++;
        } else if ((status === 'em_andamento') && hasScore) {
          statsMap[politicianKey].pending++;
        } else if ((status === 'descumprida' || status === 'quebrada') && hasScore) {
          statsMap[politicianKey].broken++;
        } else {
          statsMap[politicianKey].pending++;
        }
      });

      const rankingData = Object.values(statsMap).map((data: any) => {
        const approved = data.fulfilled + data.partial + data.broken;
        const totalWithPending = approved + data.pending;
        const percentage = totalWithPending > 0 ? Math.round((data.fulfilled / totalWithPending) * 100) : 0;
        return {
          name: data.name,
          role: data.cargo,
          state: data.state,
          party: data.party,
          percentage,
          stats: {
            fulfilled: data.fulfilled,
            partial: data.partial,
            broken: data.broken,
            pending: data.pending,
            total: totalWithPending
          },
          promise_count: approved + data.pending
        };
      });

      rankingData.sort((a, b) => b.percentage - a.percentage);
      setRanking(rankingData);

      const totalPromises = promises?.length || 0;
      const totalPoliticians = rankingData.length;
      
      const fulfilled = rankingData.reduce((acc, p) => acc + p.stats.fulfilled, 0);
      const broken = rankingData.reduce((acc, p) => acc + p.stats.broken, 0);
      
      setStats({
        total_promises: totalPromises,
        total_politicians: totalPoliticians,
        fulfilled_percentage: totalPromises > 0 ? Math.round((fulfilled / totalPromises) * 100) : 0,
        broken_percentage: totalPromises > 0 ? Math.round((broken / totalPromises) * 100) : 0
      });
      setError(null);
    } catch (err: any) {
      console.error("[Ranking] Error fetching:", err);
      setError("Erro ao carregar ranking: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredRanking = useMemo(() => {
    return ranking.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.party?.toLowerCase().includes(search.toLowerCase()) ||
        p.state?.toLowerCase().includes(search.toLowerCase());
      const matchParty = partyFilter === "all" || p.party === partyFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "high" && p.percentage >= 70) ||
        (statusFilter === "medium" && p.percentage >= 40 && p.percentage < 70) ||
        (statusFilter === "low" && p.percentage < 40);
      return matchSearch && matchParty && matchStatus;
    });
  }, [ranking, search, partyFilter, statusFilter]);

  const visibleRanking = filteredRanking.slice(0, visibleCount);
  const allParties = useMemo(() => [...new Set(ranking.map(p => p.party).filter(Boolean))].sort() as string[], [ranking]);

  const statusBadge = (percentage: number) => {
    if (percentage >= 70) return { label: "Alto", color: "text-green-400 bg-green-500/10 border-green-500/30", dot: "bg-green-400" };
    if (percentage >= 40) return { label: "Médio", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", dot: "bg-yellow-400" };
    return { label: "Baixo", color: "text-red-400 bg-red-500/10 border-red-500/30", dot: "bg-red-400" };
  };

  const fulfilledCount = ranking.reduce((acc, p) => acc + p.stats.fulfilled, 0);
  const brokenCount = ranking.reduce((acc, p) => acc + p.stats.broken, 0);
  const totalPromises = ranking.reduce((acc, p) => acc + p.stats.fulfilled + p.stats.partial + p.stats.broken + p.stats.pending, 0);

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (error && ranking.length === 0) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={fetchRanking}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <span className="text-sm font-bold text-yellow-500 tracking-wider uppercase">Ranking Nacional</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            Quem <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan text-glow-purple">cumpre</span> o que promete?
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Acompanhe em tempo real o desempenho dos políticos brasileiros. Baseado em dados reais, notícias validadas e participação popular.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-white/5 p-6 rounded-3xl"
          >
            <div className="p-2 w-fit rounded-lg bg-white/5 mb-4 text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold mb-1">{totalPromises}</div>
            <div className="text-gray-500 text-sm">Promessas Rastreadas</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-card border border-white/5 p-6 rounded-3xl"
          >
            <div className="p-2 w-fit rounded-lg bg-white/5 mb-4 text-green-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold mb-1">{stats?.fulfilled_percentage || 0}%</div>
            <div className="text-gray-500 text-sm">Cumpridas</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-dark-card border border-white/5 p-6 rounded-3xl"
          >
            <div className="p-2 w-fit rounded-lg bg-white/5 mb-4 text-red-400">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold mb-1">{stats?.broken_percentage || 0}%</div>
            <div className="text-gray-500 text-sm">Quebradas</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-card border border-white/5 p-6 rounded-3xl"
          >
            <div className="p-2 w-fit rounded-lg bg-white/5 mb-4 text-neon-cyan">
              <User className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold mb-1">{stats?.total_politicians || 0}</div>
            <div className="text-gray-500 text-sm">Políticos Monitorados</div>
          </motion.div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nome, partido ou estado..."
              className="w-full bg-dark-card border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:border-neon-purple outline-none transition-all placeholder:text-gray-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="bg-dark-card border border-white/5 rounded-xl pl-10 pr-8 py-3 text-sm appearance-none cursor-pointer min-h-[48px] focus:border-neon-purple outline-none"
              >
                <option value="all">Todos os partidos</option>
                {allParties.map(party => (
                  <option key={party} value={party}>{party}</option>
                ))}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-dark-card border border-white/5 rounded-xl px-4 py-3 text-sm cursor-pointer min-h-[48px] focus:border-neon-purple outline-none"
            >
              <option value="all">Todos os scores</option>
              <option value="high">Alto (70%+)</option>
              <option value="medium">Médio (40-69%)</option>
              <option value="low">Baixo (&lt;40%)</option>
            </select>

            <ShareButtons
              data={{
                title: "Ranking de Políticos",
                text: `Ranking de políticos brasileiros por cumprimento de promessas. Acompanhe no Promessômetro!`,
                url: window.location.href
              }}
              compact={true}
            />
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Nenhum político encontrado.</p>
            <p className="text-gray-600 text-sm mt-2">Comece reportando promessas na página inicial.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {visibleRanking.map((politician, idx) => {
                const badge = statusBadge(politician.percentage);
                return (
                  <Link key={politician.name} to={`/politico/${encodeURIComponent(politician.name)}`} className="block">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group bg-dark-card border border-white/5 hover:border-white/10 p-4 md:p-6 rounded-3xl transition-all cursor-pointer"
                    >
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className={`text-2xl font-display font-bold w-8 ${idx < 3 ? "text-yellow-400" : "text-gray-700"}`}>
                          {idx + 1}º
                        </div>

                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center border border-white/5 overflow-hidden">
                          <span className="text-xl font-bold text-white/50">
                            {politician.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold group-hover:text-neon-cyan transition-colors">
                              {politician.name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${badge.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} inline-block mr-1`} />
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm">
                            {politician.role || "Político"} • {politician.state || "Nacional"} {politician.party && `· ${politician.party}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-green-400">{politician.stats.fulfilled} ✔</div>
                          <div className="text-yellow-400">{politician.stats.partial} ~</div>
                          <div className="text-red-400">{politician.stats.broken} ✘</div>
                        </div>

                        <div className="w-full md:w-48">
                          <div className="flex justify-between text-xs font-bold mb-2">
                            <span className="text-gray-500 uppercase tracking-wider">Cumprimento</span>
                            <span className="text-neon-cyan">{politician.percentage}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${politician.percentage}%` }}
                              className={`h-full rounded-full ${politician.percentage >= 70 ? "bg-green-500" : politician.percentage >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {visibleCount < filteredRanking.length && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setVisibleCount(v => v + 20)}
                  className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all min-h-[48px]"
                >
                  Ver mais ({filteredRanking.length - visibleCount} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}