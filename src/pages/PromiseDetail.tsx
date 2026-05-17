import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Loader2,
  History,
  Share2,
  Info
} from "lucide-react";
import { Badge, Button } from "../components/ui";
import PromiseEvaluation from "../components/PromiseEvaluation";
import PromiseTimeline from "../components/PromiseTimeline";
import SEO, { generateSlug, generatePromiseSEO } from "../components/SEO";
import { ShareButtons } from "../components/ShareButtons";
import { supabase } from "../lib/supabaseClient";

const statusConfig: Record<string, { label: string; icon: React.ComponentType<any>; color: string; bg: string }> = {
  cumprida: { label: "Cumprida", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  parcialmente_cumprida: { label: "Parcialmente Cumprida", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  parcial: { label: "Parcialmente Cumprida", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  em_andamento: { label: "Em Andamento", icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
  nao_iniciada: { label: "Pendente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10" },
  pendente: { label: "Pendente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10" },
  descumprida: { label: "Descumprida", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  quebrada: { label: "Descumprida", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  nao_classificada: { label: "Não Classificada", icon: AlertTriangle, color: "text-gray-500", bg: "bg-gray-500/10" }
};

interface PromiseData {
  id: string;
  politician_name: string;
  party?: string;
  state?: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  fulfillment_score: number;
  source_link?: string;
  created_at: string;
  last_verified_at?: string;
  ai_evaluation?: string;
  needs_human_review?: boolean;
  evidence_count?: number;
  evidences_used?: any[];
}

export default function PromiseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [promise, setPromise] = useState<PromiseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchPromise(slug);
    }
  }, [slug]);

  async function fetchPromise(slugText: string) {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("promises")
        .select(`
          *,
          politicians(name, slug, photo_url, state, party)
        `)
        .eq("id", slugText)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        const politician = data.politicians;
        setPromise({
          id: data.id,
          politician_name: data.politician_name || politician?.name || "",
          party: data.party || politician?.party,
          state: data.state || politician?.state,
          title: data.promise_title || data.title || "",
          description: data.promise_description || data.description,
          category: data.category || data.categoria,
          status: data.status,
          fulfillment_score: data.fulfillment_score || 0,
          source_link: data.source_link || data.link_fonte,
          created_at: data.created_at,
          last_verified_at: data.last_verified_at,
          ai_evaluation: data.ai_evaluation,
          needs_human_review: data.needs_human_review,
          evidence_count: data.evidence_count,
          evidences_used: data.evidences_used
        });
      } else {
        setError("Promessa não encontrada");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar promessa");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (promise && showEvaluation && !explanation) {
      setLoadingExplanation(true);
      fetch(`/api/evaluate/${promise.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.has_evaluation) {
            setExplanation({
              status: data.status,
              fulfillment_score: data.score,
              criterio_aplicado: data.criteria,
              justificativa: data.justification,
              evidencias_usadas: data.sources,
              o_que_falta: data.what_is_missing,
              o_que_foi_feito: data.what_was_done,
              confianca: data.confidence / 100,
              modelo_ia: data.model,
              gerado_em: data.evaluated_at
            });
          } else {
            // Fallback - criar evaluation básica do status da promessa
            setExplanation({
              status: promise.status,
              fulfillment_score: promise.fulfillment_score,
              criterio_aplicado: 'status_herdado',
              justificativa: promise.ai_evaluation || 'Aguardando avaliação completa',
              evidencias_usadas: promise.evidences_used || [],
              o_que_falta: 'Avaliação detalhada pendente',
              o_que_foi_feito: 'Status herdado do registro original',
              confianca: 0.3,
              modelo_ia: 'heranca-v1',
              gerado_em: promise.last_verified_at || promise.created_at
            });
          }
        })
        .catch(() => {
          setExplanation({
            status: promise.status,
            fulfillment_score: promise.fulfillment_score,
            criterio_aplicado: 'fallback_local',
            justificativa: promise.ai_evaluation || 'Dados carregados diretamente da promessa',
            evidencias_usadas: promise.evidences_used || [],
            o_que_falta: 'Avaliação via servidor indisponível',
            o_que_foi_feito: 'Dados locais',
            confianca: 0.2,
            modelo_ia: 'fallback-v1',
            gerado_em: promise.created_at
          });
        })
        .finally(() => setLoadingExplanation(false));
    }
  }, [promise, showEvaluation]);

  const handleShare = async () => {
    const url = window.location.href;
    const text = `${promise?.title} - ${statusConfig[promise?.status || ""]?.label || promise?.status} (${promise?.fulfillment_score}/100)`;
    if (navigator.share) {
      await navigator.share({ title: text, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (error || !promise) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-4xl">
          <Link to="/promessas" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8">
            <ChevronLeft className="w-4 h-4" />
            Voltar para Promessas
          </Link>
          <div className="text-center py-20">
            <p className="text-red-400 text-xl mb-4">{error || "Promessa não encontrada"}</p>
            <Button onClick={() => navigate("/promessas")}>Ver Todas as Promessas</Button>
          </div>
        </div>
      </div>
    );
  }

  const config = statusConfig[promise.status] || statusConfig.nao_classificada;
  const StatusIcon = config.icon;
  function formatTimeSince(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

const politicianSlug = generateSlug(promise.politician_name);
  const promiseSlug = generateSlug(promise.title);
  const seoData = generatePromiseSEO({ ...promise, slug: `${promiseSlug}-${politicianSlug}` });

  return (
    <>
      <SEO
        title={seoData.title}
        description={seoData.description}
        path={seoData.path}
        type="article"
        publishedTime={seoData.publishedTime}
        schemaOrg={seoData.schemaOrg}
      />

      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-4xl">
          <Link to="/promessas" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar para Promessas
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-white/5 rounded-3xl p-8 mb-8"
          >
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {promise.category && <Badge variant="category">{promise.category}</Badge>}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {config.label}
              </div>
              {promise.fulfillment_score > 0 && (
                <span className="text-sm font-bold text-white">{promise.fulfillment_score}/100</span>
              )}
              {promise.last_verified_at && (
                <span
                  className="flex items-center gap-1 px-2 py-1 bg-neon-purple/10 text-neon-purple text-xs rounded-full cursor-help"
                  title={`Avaliado automaticamente por IA em ${new Date(promise.last_verified_at).toLocaleString('pt-BR')}. ${promise.needs_human_review ? '⚠️ Requer revisão humana.' : 'Avaliação automática.'}`}
                >
                  🤖 AI · {formatTimeSince(promise.last_verified_at)}
                </span>
              )}
              {(promise.evidence_count > 0) && (
                <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full cursor-help" title={`${promise.evidence_count} evidências encontradas e validadas`}>
                  📰 {promise.evidence_count} evid{promise.evidence_count === 1 ? 'ência' : 'ências'}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold mb-4">{promise.title}</h1>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              <Link to={`/politico/${encodeURIComponent(politicianSlug)}`} className="text-lg text-neon-cyan hover:underline">
                {promise.politician_name}
              </Link>
              {promise.party && <span className="text-gray-500">{promise.party} {promise.state && `/ ${promise.state}`}</span>}
            </div>

            {promise.description && <p className="text-gray-400 mb-6 leading-relaxed">{promise.description}</p>}

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" />
                Compartilhar
              </Button>
              <ShareButtons
                data={{
                  title: promise.title,
                  politician: promise.politician_name,
                  status: promise.status,
                  score: promise.fulfillment_score,
                  url: window.location.href
                }}
                compact={true}
              />
              {promise.source_link && (
                <a href={promise.source_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Ver Fonte
                </a>
              )}
            </div>
          </motion.div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">
              As avaliações são geradas por inteligência artificial e revisadas por humanos. Os dados, fontes e metodologia estão disponíveis nas páginas de <Link to="/metodologia" className="text-blue-400 hover:underline">Metodologia</Link> e <Link to="/transparencia" className="text-blue-400 hover:underline">Transparência</Link>.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <button
              onClick={() => setShowEvaluation(!showEvaluation)}
              className="w-full flex items-center justify-between p-4 bg-dark-card border border-white/10 rounded-xl hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-neon-cyan" />
                <span className="font-bold">Ver Avaliação Detalhada</span>
              </div>
              <span className="text-gray-500 text-sm">{showEvaluation ? "Ocultar" : "Expandir"}</span>
            </button>

            {showEvaluation && (
              <div>
                {loadingExplanation ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-neon-purple" />
                  </div>
                ) : explanation ? (
                  <PromiseEvaluation evaluation={explanation} />
                ) : (
                  <div className="bg-dark-card border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-gray-500">Esta promessa ainda não foi avaliada.</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full flex items-center justify-between p-4 bg-dark-card border border-white/10 rounded-xl hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-blue-400" />
                <span className="font-bold">Histórico de Alterações</span>
              </div>
              <span className="text-gray-500 text-sm">{showTimeline ? "Ocultar" : "Expandir"}</span>
            </button>

            {showTimeline && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <PromiseTimeline promiseId={promise.id} expanded />
              </motion.div>
            )}
          </div>

          <div className="text-center">
            <Link to={`/politico/${encodeURIComponent(politicianSlug)}`} className="inline-flex items-center gap-2 text-neon-cyan hover:underline">
              Ver todas as promessas de {promise.politician_name}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}