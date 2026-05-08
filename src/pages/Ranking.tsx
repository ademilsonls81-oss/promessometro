import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Search, TrendingUp, TrendingDown, Clock, User, Loader2 } from "lucide-react";
import { Button } from "../components/ui";
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

  useEffect(() => {
    fetchRanking();
  }, []);

  async function fetchRanking() {
    try {
      setLoading(true);
      
      // Buscar promessas com dados do político
      const { data: promises, error } = await supabase
        .from('promises')
        .select('politician_id, politician_name, status, fulfillment_score, politicians(name, party, state)');

      if (error) throw error;

      const statsMap: Record<string, any> = {};
      
      (promises || []).forEach((p: any) => {
        const politicianId = p.politician_id || p.politician_name;
        
        if (!statsMap[politicianId]) {
          // Pegar nome completo da tabela politicians ou usar nome da promise
          const fullName = p.politicians?.name || p.politician_name;
          statsMap[politicianId] = { 
            name: fullName,
            party: p.politicians?.party || null,
            state: p.politicians?.state || null,
            fulfilled: 0, 
            partial: 0, 
            broken: 0, 
            pending: 0 
          };
        }
        
        statsMap[politicianId].total = (statsMap[politicianId].fulfilled + statsMap[politicianId].partial + statsMap[politicianId].broken + statsMap[politicianId].pending + 1);
        
        // Suporta status em inglês E português
        const status = p.status?.toLowerCase() || '';
        
        if (status === 'fulfilled' || status === 'realizada' || status === 'cumprida') {
          statsMap[politicianId].fulfilled++;
        } else if (status === 'partial' || status === 'partial_fulfilled' || status === 'em_andamento' || status === 'parcial') {
          statsMap[politicianId].partial++;
        } else if (status === 'broken' || status === 'not_fulfilled' || status === 'quebrada' || status === 'não cumprida') {
          statsMap[politicianId].broken++;
        } else {
          statsMap[politicianId].pending++;
        }
      });

      const rankingData = Object.values(statsMap).map((data: any) => ({
        name: data.name,
        role: null as string | null,
        state: data.state,
        party: data.party,
        percentage: data.total > 0 ? Math.round((data.fulfilled + data.partial * 0.5) / data.total * 100) : 50,
        stats: {
          fulfilled: data.fulfilled,
          partial: data.partial,
          broken: data.broken,
          pending: data.pending,
          total: data.total
        },
        promise_count: data.fulfilled + data.partial + data.broken + data.pending
      }));

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

  const filteredRanking = ranking.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.party?.toLowerCase().includes(search.toLowerCase()) ||
    p.state?.toLowerCase().includes(search.toLowerCase())
  );

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
        </div>

        {ranking.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Nenhum político encontrado.</p>
            <p className="text-gray-600 text-sm mt-2">Comece reportando promessas na página inicial.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRanking.map((politician, idx) => (
              <Link key={politician.name} to={`/politico/${encodeURIComponent(politician.name)}`} className="block">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group bg-dark-card border border-white/5 hover:border-white/10 p-4 md:p-6 rounded-3xl transition-all cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="text-2xl font-display font-bold text-gray-700 w-8">
                      {idx + 1}º
                    </div>

                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center border border-white/5 overflow-hidden">
                      <span className="text-xl font-bold text-white/50">
                        {politician.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-lg font-bold group-hover:text-neon-cyan transition-colors">
                        {politician.name}
                      </h3>
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
                          className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}