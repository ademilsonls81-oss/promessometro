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
  em_andamento: { label: "Em Andamento", icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
  nao_iniciada: { label: "Não Iniciada", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10" },
  descumprida: { label: "Descumprida", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
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
        .select("*")
        .limit(50);

      if (fetchError) throw fetchError;

      const found = (data || []).find((p: any) => {
        const pSlug = generateSlug(p.promise_title || p.title || "");
        return pSlug === slugText || p.id === slugText;
      });

      if (found) {
        setPromise({
          id: found.id,
          politician_name: found.politician_name || found.nome_politico || "",
          party: found.party || found.partido,
          state: found.state || found.estado,
          title: found.promise_title || found.title || found.titulo,
          description: found.promise_description || found.description,
          category: found.category || found.categoria,
          status: found.status,
          fulfillment_score: found.fulfillment_score || 0,
          source_link: found.source_link || found.link_fonte,
          created_at: found.created_at
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
      supabase
        .from("promise_explanations")
        .select("*")
        .eq("promise_id", promise.id)
        .order("gerado_em", { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => setExplanation(data))
        .catch(console.error)
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