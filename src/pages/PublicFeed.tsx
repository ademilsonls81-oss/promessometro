import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, Search, Filter, ChevronRight, ExternalLink, PartyPopper, TrendingUp, AlertCircle, Link as LinkIcon } from "lucide-react";

function toSlug(name: string): string {
  if (!name) return '';
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface Promise {
  id: string;
  politician_name: string;
  politician_photo_url?: string | null;
  slug?: string;
  party: string | null;
  state: string | null;
  promise_title: string;
  promise_description: string | null;
  data_promessa: string | null;
  source_link: string | null;
  source_doc_url: string | null;
  evidence: string | null;
  category: string;
  status: string;
  fulfillment_score: number;
  created_at: string;
  evidence_count?: number;
  evidences_used?: { titulo?: string; url: string; resumo?: string }[];
  verification_notes?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  cumprida: { label: "Cumprida", color: "text-green-400", bg: "bg-green-500/10", icon: <CheckCircle className="w-4 h-4" /> },
  parcial: { label: "Parciais", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: <Clock className="w-4 h-4" /> },
  parcialmente_cumprida: { label: "Parciais", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: <Clock className="w-4 h-4" /> },
  em_andamento: { label: "Em Andamento", color: "text-orange-400", bg: "bg-orange-500/10", icon: <TrendingUp className="w-4 h-4" /> },
  nao_iniciada: { label: "Pendente", color: "text-blue-400", bg: "bg-blue-500/10", icon: <Clock className="w-4 h-4" /> },
  descumprida: { label: "Descumprida", color: "text-red-400", bg: "bg-red-500/10", icon: <XCircle className="w-4 h-4" /> },
  quebrada: { label: "Descumprida", color: "text-red-400", bg: "bg-red-500/10", icon: <XCircle className="w-4 h-4" /> },
  nao_classificada: { label: "Não Classificada", color: "text-gray-400", bg: "bg-gray-500/10", icon: <Clock className="w-4 h-4" /> },
  pendente: { label: "Pendente", color: "text-blue-400", bg: "bg-blue-500/10", icon: <Clock className="w-4 h-4" /> },
};

const statusFilters = [
  { key: "all", label: "Todas" },
  { key: "cumprida", label: "Cumpridas" },
  { key: "parcial", label: "Parciais" },
  { key: "descumprida", label: "Descumpridas" },
];

const categories = [
  "Saúde", "Educação", "Segurança", "Economia", "Infraestrutura", 
  "Meio Ambiente", "Trabalho", "Habitação", "Transporte", "Outros"
];

export default function PublicFeed() {
  const [promises, setPromises] = useState<Promise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pageStats, setPageStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchPromises();
  }, []);

  async function fetchPromises() {
    try {
      setError(null);
      const response = await fetch('/api/promises');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro na API');
      }
      const data = await response.json();
      setPromises(data.promises || []);
      if (data.stats) {
        setPageStats(data.stats);
      }
    } catch (err: unknown) {
      console.error("[PublicFeed] fetchPromises error:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setPromises([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredPromises = promises?.filter((p) => {
    const status = p.status?.toLowerCase();
    let matchesStatus = filter === "all";
    if (filter === "cumprida") matchesStatus = status === "cumprida" || status === "fulfilled";
    if (filter === "parcial") matchesStatus = status === "parcial" || status === "parcialmente_cumprida" || status === "em_andamento";
    if (filter === "descumprida") matchesStatus = status === "descumprida" || status === "broken";
    
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesSearch = 
      p.promise_title.toLowerCase().includes(search.toLowerCase()) ||
      p.politician_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig["nao_classificada"];
  };

  const fulfilledCount = pageStats?.cumprida ?? promises.filter(p => p.status === "cumprida").length;
  const partialCount = pageStats?.parcial ?? promises.filter(p => p.status === "parcial").length;
  const brokenCount = pageStats?.quebrada ?? promises.filter(p => p.status === "quebrada").length;
  const pendingCount = pageStats?.pendente ?? promises.filter(p => p.status === "pendente").length;
  const totalEvidences = promises.reduce((acc, p) => acc + (p.evidence_count || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-16 pb-12 text-center"
        >
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            Promessas <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan text-glow-purple">Políticas</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Acompanhe as promessas dos políticos brasileiros. Cada promessa é verificada com evidências reais.
          </p>
        </motion.div>

        {!loading && promises.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-dark-card border border-green-500/20 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{fulfilledCount}</div>
              <div className="text-xs text-gray-500">Cumpridas</div>
            </div>
            <div className="bg-dark-card border border-yellow-500/20 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{partialCount}</div>
              <div className="text-xs text-gray-500">Parcialmente</div>
            </div>
            <div className="bg-dark-card border border-red-500/20 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{brokenCount}</div>
              <div className="text-xs text-gray-500">Descumpridas</div>
            </div>
            <div className="bg-dark-card border border-gray-500/20 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-400">{pendingCount}</div>
              <div className="text-xs text-gray-500">Pendentes</div>
            </div>
          </div>
        )}

        {totalEvidences > 0 ? (
          <div className="text-center mb-4 text-xs text-blue-400">
            📰 {totalEvidences} evidências indexadas para {promises.length} promessas
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 p-2 bg-dark-card border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 px-2 w-full md:w-auto">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filter === f.key 
                    ? "bg-neon-purple text-white shadow-lg shadow-neon-purple/20" 
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64 px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar promessas..."
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:border-neon-purple outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              categoryFilter === "all" ? "bg-neon-cyan text-black" : "bg-white/5 text-gray-400"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                categoryFilter === cat ? "bg-neon-cyan text-black" : "bg-white/5 text-gray-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredPromises.length > 0 ? (
          <div className="space-y-4">
            {filteredPromises.map((promise, idx) => {
              const status = getStatusConfig(promise.status);
              return (
                <motion.div
                  key={promise.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-dark-card border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`flex items-center gap-1.5 text-xs font-bold ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                        {promise.category && (
                          <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded">
                            {promise.category}
                          </span>
                        )}
                        <span className="text-gray-600 text-xs text-right">
                          {new Date(promise.data_promessa || promise.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
                        {promise.promise_title}
                      </h3>
                      {promise.promise_description && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-3 italic">
                          "{promise.promise_description}"
                        </p>
                      )}

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Progresso</span>
                          <span className="text-xs font-bold text-white">{promise.fulfillment_score || 0}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${promise.fulfillment_score || 0}%`,
                              backgroundColor: (promise.fulfillment_score || 0) >= 80 ? '#22c55e' :
                                (promise.fulfillment_score || 0) >= 50 ? '#eab308' :
                                (promise.fulfillment_score || 0) >= 20 ? '#3b82f6' : '#ef4444'
                            }}
                          />
                        </div>
                      </div>

                      {promise.evidences_used && promise.evidences_used.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          <span className="text-xs font-bold text-gray-400">Evidências:</span>
                          {promise.evidences_used.slice(0, 3).map((ev, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <LinkIcon className="w-3 h-3 text-neon-cyan mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                {ev.url && ev.url !== '#' ? (
                                  <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline font-medium truncate block">
                                    {ev.titulo || ev.url}
                                  </a>
                                ) : (
                                  <span className="text-gray-300 font-medium truncate block">{ev.titulo || 'Fonte não disponível'}</span>
                                )}
                                {ev.resumo && (
                                  <p className="text-gray-500 line-clamp-1 mt-0.5">{ev.resumo}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {promise.verification_notes && (
                        <div className="mb-3 p-2.5 bg-white/5 rounded-lg border border-white/5">
                          <span className="text-xs font-bold text-gray-400 block mb-1">Justificativa da IA:</span>
                          <p className="text-xs text-gray-300 line-clamp-3">{promise.verification_notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                            {promise.politician_photo_url ? (
                              <img
                                src={promise.politician_photo_url}
                                alt={promise.politician_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.querySelector('.pf-fallback')!.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <span className={`text-[10px] font-bold text-white/50 pf-fallback ${promise.politician_photo_url ? 'hidden' : ''}`}>
                              {promise.politician_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </span>
                          </div>
                          <span className="text-neon-cyan font-medium">
                            {promise.politician_name}
                          </span>
                        </div>
                        {promise.party && (
                          <span className="text-gray-500">{promise.party}</span>
                        )}
                        {promise.state && (
                          <span className="text-gray-600 text-xs">• {promise.state}</span>
                        )}
                      </div>
                      {promise.evidences_used && promise.evidences_used.length > 0 ? (
                          <div className="mt-3 inline-flex items-center gap-2">
                            <LinkIcon className="w-3 h-3 text-neon-cyan" />
                            <span className="text-xs text-neon-cyan">{promise.evidence_count || promise.evidences_used.length} evidência(s)</span>
                            {promise.evidences_used[0]?.url && promise.evidences_used[0].url !== '#' && (
                              <a
                                href={promise.evidences_used[0].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-400 hover:text-neon-cyan transition-colors"
                              >
                                Ver fonte <ExternalLink className="w-3 h-3 inline" />
                              </a>
                            )}
                          </div>
                        ) : promise.source_link ? (
                          <a
                            href={promise.source_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-neon-cyan hover:underline mt-3"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Ver Fonte Oficial
                          </a>
                        ) : (
                          <div className="mt-3 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs text-yellow-500">Sem evidência cadastrada</span>
                            <Link to="/reportar" className="text-xs text-neon-cyan hover:underline">
                              Ajude a encontrar
                            </Link>
                          </div>
                        )}
                    </div>
                    <Link 
                      to={`/politico/${promise.slug || toSlug(promise.politician_name)}`}
                      className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-neon-cyan transition-colors"
                    >
                      Ver perfil <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Nenhuma promessa encontrada.</p>
            <p className="text-gray-600 text-sm mt-2">Comece acompanhando os políticos no Ranking.</p>
            <Link to="/ranking" className="inline-block mt-4 px-6 py-3 bg-neon-purple text-white rounded-xl font-bold hover:opacity-90 transition-opacity">
              Ver Ranking
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}