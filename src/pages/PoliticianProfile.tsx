import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  MapPin,
  Briefcase,
  Users,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Share2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  History
} from "lucide-react";
import { Badge, Button } from "../components/ui";
import ReportPromiseModal from "../components/ReportPromiseModal";
import PromiseEvaluation from "../components/PromiseEvaluation";
import PromiseTimeline from "../components/PromiseTimeline";
import ContestationModal from "../components/ContestationModal";
import SEO, { generateSlug, generatePoliticianSEO } from "../components/SEO";
import { supabase } from "../lib/supabaseClient";

interface PromiseData {
  id: string;
  promise_title: string;
  promise_description: string | null;
  data_promessa: string | null;
  category: string | null;
  status: string;
  evidence: string | null;
  source_link: string | null;
  fulfillment_score: number;
  created_at: string;
}

interface PoliticianData {
  id: string;
  name: string;
  role: string | null;
  party: string | null;
  state: string | null;
  city: string | null;
  photo_url: string | null;
  bio: string | null;
  stats: {
    fulfilled: number;
    partial: number;
    broken: number;
    pending: number;
    total: number;
    percentage: number;
  };
  promises: PromiseData[];
}

const statusConfig: Record<string, { label: string; icon: React.ComponentType<any>; color: string; bg: string; border: string }> = {
  cumprida: { label: "Cumprida", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  fulfilled: { label: "Cumprida", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  realizada: { label: "Cumprida", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  parcialmente_cumprida: { label: "Parciais", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  parcial: { label: "Parciais", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  partial: { label: "Parciais", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  partial_fulfilled: { label: "Parciais", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  em_andamento: { label: "Em Andamento", icon: AlertCircle, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  in_progress: { label: "Em Andamento", icon: AlertCircle, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  descumprida: { label: "Descumprida", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  broken: { label: "Quebrada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  not_fulfilled: { label: "Quebrada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  quebrada: { label: "Quebrada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  nao_iniciada: { label: "Pendente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  pendente: { label: "Pendente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  pending_analysis: { label: "Em Análise", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  verified: { label: "Verificada", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  rejected: { label: "Rejeitada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  nao_classificada: { label: "Pendente", icon: AlertTriangle, color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/20" }
};

export default function PoliticianProfile() {
  const { id } = useParams<{ id: string }>();
  const [politician, setPolitician] = useState<PoliticianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedPromises, setExpandedPromises] = useState<Record<string, boolean>>({});
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({});
  const [explanations, setExplanations] = useState<Record<string, any>>({});
  const [loadingExplanation, setLoadingExplanation] = useState<Record<string, boolean>>({});
  const [contestationModal, setContestationModal] = useState<{ isOpen: boolean; promiseId: string; promiseTitle: string; politicianName: string }>({
    isOpen: false,
    promiseId: "",
    promiseTitle: "",
    politicianName: ""
  });
  const [contestations, setContestations] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (id) {
      fetchPolitician(id);
    }
  }, [id]);

  async function fetchPolitician(slug: string) {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/politician/${slug}`);
      if (!response.ok) {
        const errData = await response.json();
        setError(errData.error || "Político não encontrado");
        return;
      }
      
      const data = await response.json();
      
      const pol = data.politician;
      const promises = data.promises || [];
      
      const stats = data.stats || { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: promises.length, percentage: 0 };
      stats.total = promises.length;

      setPolitician({
        id: pol.id,
        name: pol.name,
        role: pol.role || pol.position || null,
        party: pol.party || null,
        state: pol.state || null,
        city: pol.city || null,
        photo_url: pol.photo_url || null,
        bio: pol.bio || null,
        stats: {
          ...stats,
          percentage: data.percentage || Math.round((stats.fulfilled / stats.total) * 100)
        },
        promises: promises.map((p: any) => ({
          id: p.id,
          promise_title: p.promise_title || p.title || '',
          promise_description: p.promise_description || p.description || null,
          data_promessa: p.data_promessa || null,
          category: p.category,
          status: p.status,
          evidence: p.evidence || null,
          source_link: p.source_link || p.source_doc_url || null,
          fulfillment_score: p.fulfillment_score || 0,
          created_at: p.created_at
        }))
      });
      setError(null);
    } catch (err: any) {
      console.error("[PoliticianProfile] Error fetching:", err);
      setError("Erro ao carregar perfil: " + err.message);
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

  if (error || !politician) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-5xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8">
            <ChevronLeft className="w-4 h-4" />
            Voltar para o Ranking
          </Link>
          <div className="text-center py-20">
            <p className="text-red-400 text-xl mb-4">{error || "Político não encontrado"}</p>
            <Button onClick={() => window.history.back()}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  const filteredPromises = politician.promises.filter(p => {
    if (filter === "all") return true;
    const status = p.status?.toLowerCase();
    if (filter === "fulfilled") return status === "cumprida" || status === "fulfilled" || status === "realizada" || status === "verified";
    if (filter === "partial") return status === "parcial" || status === "parcialmente_cumprida" || status === "partial" || status === "partial_fulfilled" || status === "em_andamento" || status === "in_progress";
    if (filter === "broken") return status === "descumprida" || status === "broken" || status === "not_fulfilled" || status === "quebrada";
    if (filter === "pending") return status === "pendente" || status === "nao_iniciada" || status === "nao_classificada" || status === "pending_analysis";
    return status === filter;
  });

  const words = politician.name.trim().split(/\s+/);
  const initials = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();

  const politicianSlug = generateSlug(politician.name);
  const seoTitle = `${politician.name} — ${politician.party || ''} | Promessômetro`;
  const seoDescription = `${politician.name} tem ${politician.stats.percentage}% de suas promessas cumpridas (${politician.stats.fulfilled}/${politician.stats.total} cumpridas). Acompanhe o histórico completo.`;
  const seoData = generatePoliticianSEO({ ...politician, stats: politician.stats });

  return (
    <>
      <SEO
        title={seoData.title}
        description={seoData.description}
        path={seoData.path}
        type="profile"
        image={seoData.image}
        schemaOrg={seoData.schemaOrg}
      />
      
      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-5xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar para o Ranking
          </Link>

          <div className="bg-dark-card border border-white/5 rounded-3xl p-8 mb-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 blur-[80px] -z-10" />
            
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center border border-white/10 overflow-hidden shrink-0 shadow-2xl">
                {politician.photo_url ? (
                  <img 
                    src={politician.photo_url} 
                    alt={politician.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.querySelector('.fallback')!.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <span className={`text-4xl font-bold text-white/50 fallback ${politician.photo_url ? 'hidden' : ''}`}>
                  {initials}
                </span>
              </div>
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <h1 className="text-3xl md:text-4xl font-display font-bold">{politician.name}</h1>
                  {politician.promises.length > 0 && <Badge variant="pro">Verificado</Badge>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6 mb-6">
                  {politician.role && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Briefcase className="w-4 h-4" />
                      <span>{politician.role}</span>
                    </div>
                  )}
                  {(politician.city || politician.state) && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{politician.city}{politician.city && politician.state ? ", " : ""}{politician.state}</span>
                    </div>
                  )}
                  {politician.party && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>Partido: {politician.party}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-gray-400 mb-8 leading-relaxed max-w-2xl">
                  {politician.bio || (politician.promises.length > 0 
                    ? `Político monitorado com ${politician.stats.total} promessas rastreadas.`
                    : "Nenhuma promessa registrada ainda.")}
                </p>

                <div className="flex flex-wrap gap-4">
                  <Button variant="primary" className="gap-2">
                    <Share2 className="w-4 h-4" /> Compartilhar Perfil
                  </Button>
                  <Button variant="secondary" className="gap-2">
                    <AlertTriangle className="w-4 h-4" /> Reportar Erro
                  </Button>
                </div>
              </div>

              <div className="w-full md:w-auto p-6 bg-black/40 border border-white/5 rounded-2xl text-center">
                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Índice de Confiança</div>
                <div className="text-5xl font-display font-bold text-neon-cyan mb-2">{politician.stats.percentage}%</div>
                <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden mx-auto">
                  <div className="h-full bg-neon-cyan" style={{ width: `${politician.stats.percentage}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <button 
              onClick={() => setFilter(filter === "fulfilled" ? "all" : "fulfilled")}
              className={`p-4 border rounded-2xl transition-all text-left ${
                filter === "fulfilled" ? "border-green-500/20 bg-green-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
              }`}
            >
              <CheckCircle2 className="w-5 h-5 mb-2 text-green-400" />
              <div className="text-2xl font-bold">{politician.stats.fulfilled}</div>
              <div className="text-gray-500 text-xs uppercase font-bold">Cumpridas</div>
            </button>
            
            <button 
              onClick={() => setFilter(filter === "partial" ? "all" : "partial")}
              className={`p-4 border rounded-2xl transition-all text-left ${
                filter === "partial" ? "border-yellow-500/20 bg-yellow-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
              }`}
            >
              <AlertCircle className="w-5 h-5 mb-2 text-yellow-400" />
              <div className="text-2xl font-bold">{politician.stats.partial}</div>
              <div className="text-gray-500 text-xs uppercase font-bold">Parciais</div>
            </button>
            
            <button 
              onClick={() => setFilter(filter === "broken" ? "all" : "broken")}
              className={`p-4 border rounded-2xl transition-all text-left ${
                filter === "broken" ? "border-red-500/20 bg-red-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
              }`}
            >
              <XCircle className="w-5 h-5 mb-2 text-red-400" />
              <div className="text-2xl font-bold">{politician.stats.broken}</div>
              <div className="text-gray-500 text-xs uppercase font-bold">Quebradas</div>
            </button>
            
            <button 
              onClick={() => setFilter(filter === "pending" ? "all" : "pending")}
              className={`p-4 border rounded-2xl transition-all text-left ${
                filter === "pending" ? "border-gray-500/20 bg-gray-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
              }`}
            >
              <Clock className="w-5 h-5 mb-2 text-gray-400" />
              <div className="text-2xl font-bold">{politician.stats.pending}</div>
              <div className="text-gray-500 text-xs uppercase font-bold">Pendentes</div>
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Promessas de Campanha ({politician.promises.length})</h2>
              <Button variant="primary" size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
                <AlertCircle className="w-4 h-4" /> Sugerir Atualização
              </Button>
            </div>

            {politician.promises.length === 0 ? (
              <div className="text-center py-12 bg-dark-card border border-white/5 rounded-3xl">
                <p className="text-gray-500 text-lg mb-4">Nenhuma promessa encontrada para este político.</p>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                  Reportar Primeira Promessa
                </Button>
              </div>
            ) : filteredPromises.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhuma promessa com este filtro.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredPromises.map(promise => {
                  const config = statusConfig[promise.status?.toLowerCase()] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  
                  return (
                    <motion.div
                      key={promise.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-dark-card border border-white/5 rounded-3xl p-6 md:p-8 hover:border-white/10 transition-all"
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-4">
                            {promise.category && <Badge variant="category">{promise.category}</Badge>}
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {config.label}
                            </div>
                            {promise.fulfillment_score > 0 && (
                              <span className="text-xs font-bold text-gray-500">
                                {promise.fulfillment_score}/100
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold mb-3">{promise.promise_title}</h3>
                          {promise.promise_description && (
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                              {promise.promise_description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> 
                              {new Date(promise.data_promessa || promise.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            {(promise.evidence || promise.source_link) && (
                              <a 
                                href={promise.evidence || promise.source_link || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-neon-cyan hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" /> Ver Evidência
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                const newExpanded = { ...expandedPromises };
                                newExpanded[promise.id] = !newExpanded[promise.id];
                                setExpandedPromises(newExpanded);
                                
                                if (newExpanded[promise.id] && !explanations[promise.id]) {
                                  setLoadingExplanation({ ...loadingExplanation, [promise.id]: true });
                                  try {
                                    const { data } = await supabase
                                      .from("promise_explanations")
                                      .select("*")
                                      .eq("promise_id", promise.id)
                                      .order("gerado_em", { ascending: false })
                                      .limit(1)
                                      .single();
                                    setExplanations({ ...explanations, [promise.id]: data });
                                  } catch (err) {
                                    console.error("Error loading explanation:", err);
                                  } finally {
                                    setLoadingExplanation({ ...loadingExplanation, [promise.id]: false });
                                  }
                                }
                                
                                if (newExpanded[promise.id] && !contestations[promise.id]) {
                                  try {
                                    const { data } = await supabase
                                      .from("promise_contestations")
                                      .select("*")
                                      .eq("promise_id", promise.id)
                                      .eq("status", "aceita")
                                      .order("criado_em", { ascending: false });
                                    setContestations({ ...contestations, [promise.id]: data || [] });
                                  } catch (err) {
                                    console.error("Error loading contestations:", err);
                                  }
                                }
                              }}
                              className="flex items-center gap-1 text-blue-400 hover:text-white transition-colors bg-blue-500/10 px-2 py-1 rounded"
                            >
                              {expandedPromises[promise.id] ? (
                                <>Ver menos <ChevronUp className="w-3 h-3" /></>
                              ) : (
                                <>Ver detalhes <Info className="w-3 h-3" /></>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setContestationModal({
                                isOpen: true,
                                promiseId: promise.id,
                                promiseTitle: promise.promise_title,
                                politicianName: politician.name
                              })}
                              className="flex items-center gap-1 text-yellow-400 hover:text-white transition-colors bg-yellow-500/10 px-2 py-1 rounded"
                            >
                              <AlertTriangle className="w-3 h-3" /> Contestar
                            </button>
                          </div>
                          
                          <AnimatePresence>
                            {expandedPromises[promise.id] && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 overflow-hidden space-y-4"
                              >
                                {loadingExplanation[promise.id] ? (
                                  <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Carregando avaliação detalhada...
                                  </div>
                                ) : explanations[promise.id] ? (
                                  <PromiseEvaluation evaluation={explanations[promise.id]} />
                                ) : (
                                  <div className="text-gray-500 text-sm">
                                    Nenhuma avaliação detalhada disponível.
                                  </div>
                                )}

                                <div className="border-t border-white/5 pt-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newExpanded = { ...expandedTimelines };
                                      newExpanded[promise.id] = !newExpanded[promise.id];
                                      setExpandedTimelines(newExpanded);
                                    }}
                                    className="flex items-center gap-2 text-blue-400 hover:text-white transition-colors bg-blue-500/10 px-3 py-2 rounded-xl text-sm font-medium w-full justify-center"
                                  >
                                    <History className="w-4 h-4" />
                                    {expandedTimelines[promise.id] ? "Ocultar Histórico" : "Ver Histórico de Alterações"}
                                  </button>

                                  <AnimatePresence>
                                    {expandedTimelines[promise.id] && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-4"
                                      >
                                        <PromiseTimeline promiseId={promise.id} />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <ReportPromiseModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            politicianName={politician.name}
          />

          <ContestationModal
            isOpen={contestationModal.isOpen}
            onClose={() => setContestationModal({ ...contestationModal, isOpen: false })}
            promiseId={contestationModal.promiseId}
            promiseTitle={contestationModal.promiseTitle}
            politicianName={contestationModal.politicianName}
          />
        </div>
      </div>
    </>
  );
}