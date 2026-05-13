import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Clock, 
  Edit3, 
  AlertTriangle, 
  Bot, 
  User, 
  Shield, 
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  MessageSquare
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface TimelineEntry {
  id: string;
  tipo: "avaliacao_ia" | "alteracao_status" | "contestacao" | "evidencia" | "manual";
  data: string;
  titulo: string;
  descricao: string;
  ator?: string;
  detalhes?: Record<string, any>;
  url?: string | null;
}

interface PromiseTimelineProps {
  promiseId: string;
  expanded?: boolean;
}

const tipoConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  avaliacao_ia: { 
    icon: <Bot className="w-4 h-4" />, 
    color: "text-purple-400", 
    bg: "bg-purple-500/10 border-purple-500/20",
    label: "Avaliação IA"
  },
  alteracao_status: { 
    icon: <Edit3 className="w-4 h-4" />, 
    color: "text-blue-400", 
    bg: "bg-blue-500/10 border-blue-500/20",
    label: "Alteração"
  },
  contestacao: { 
    icon: <AlertTriangle className="w-4 h-4" />, 
    color: "text-yellow-400", 
    bg: "bg-yellow-500/10 border-yellow-500/20",
    label: "Contestação"
  },
  evidencia: { 
    icon: <CheckCircle className="w-4 h-4" />, 
    color: "text-green-400", 
    bg: "bg-green-500/10 border-green-500/20",
    label: "Evidência"
  },
  manual: { 
    icon: <User className="w-4 h-4" />, 
    color: "text-gray-400", 
    bg: "bg-gray-500/10 border-gray-500/20",
    label: "Manual"
  },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
}

function getStatusChange(from: string, to: string): { fromLabel: string; toLabel: string; icon: React.ReactNode } {
  const statusLabels: Record<string, string> = {
    cumprida: "Cumprida",
    parcialmente_cumprida: "Parcialmente Cumprida",
    em_andamento: "Em Andamento",
    nao_iniciada: "Pendente",
    pendente: "Pendente",
    descumprida: "Descumprida",
    nao_classificada: "Não Classificada",
    pending: "Pendente",
    em_analise: "Em Análise",
    aceita: "Aceita",
    rejeitada: "Rejeitada"
  };

  const fromIcon = to === "cumprida" ? <TrendingUp className="w-3 h-3" /> :
                   to === "descumprida" ? <TrendingDown className="w-3 h-3" /> :
                   <Minus className="w-3 h-3" />;

  return {
    fromLabel: statusLabels[from] || from,
    toLabel: statusLabels[to] || to,
    icon: fromIcon
  };
}

export default function PromiseTimeline({ promiseId, expanded = false }: PromiseTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(expanded);

  useEffect(() => {
    fetchTimeline();
  }, [promiseId]);

  async function fetchTimeline() {
    setLoading(true);
    try {
      const timelineEntries: TimelineEntry[] = [];

      const [auditLog, explanations, contestations] = await Promise.all([
        supabase
          .from("promise_audit_log")
          .select("*")
          .eq("promise_id", promiseId)
          .order("criado_em", { ascending: true }),
        supabase
          .from("promise_explanations")
          .select("*")
          .eq("promise_id", promiseId)
          .order("gerado_em", { ascending: true }),
        supabase
          .from("promise_contestations")
          .select("*")
          .eq("promise_id", promiseId)
          .order("criado_em", { ascending: true })
      ]);

      auditLog.data?.forEach((log: any) => {
        if (log.campo_alterado === "status") {
          const change = getStatusChange(log.valor_anterior || "", log.valor_novo || "");
          timelineEntries.push({
            id: `audit-${log.id}`,
            tipo: "alteracao_status",
            data: log.criado_em,
            titulo: `Status alterado: ${change.fromLabel} → ${change.toLabel}`,
            descricao: log.motivo || "Alteração registrada no sistema",
            ator: log.alterado_por || "Sistema",
            url: null
          });
        } else if (log.campo_alterado === "fulfillment_score") {
          timelineEntries.push({
            id: `audit-${log.id}`,
            tipo: "alteracao_status",
            data: log.criado_em,
            titulo: `Score atualizado: ${log.valor_anterior} → ${log.valor_novo}`,
            descricao: log.motivo || "Score atualizado",
            ator: log.alterado_por || "Sistema"
          });
        }
      });

      explanations.data?.forEach((exp: any) => {
        const confiancaLabel = exp.confianca >= 0.7 ? "Alta" : exp.confianca >= 0.4 ? "Média" : "Baixa";
        timelineEntries.push({
          id: `exp-${exp.id}`,
          tipo: "avaliacao_ia",
          data: exp.gerado_em,
          titulo: `Avaliação IA: ${exp.status} (${exp.fulfillment_score}/100)`,
          descricao: exp.justificativa || "Análise gerada automaticamente",
          ator: exp.modelo_ia || "IA",
          detalhes: {
            confianca: confiancaLabel,
            score: exp.fulfillment_score,
            criterio: exp.criterio_aplicado,
            evidencias: exp.evidencias_usadas?.length || 0
          }
        });
      });

      contestations.data?.forEach((cont: any) => {
        const statusLabel = cont.status === "aceita" ? "Aceita" : 
                           cont.status === "rejeitada" ? "Rejeitada" : 
                           cont.status === "em_analise" ? "Em Análise" : "Pendente";
        timelineEntries.push({
          id: `cont-${cont.id}`,
          tipo: "contestacao",
          data: cont.criado_em,
          titulo: `Contestação ${statusLabel.toLowerCase()}: "${cont.motivo?.substring(0, 50)}..."`,
          descricao: cont.motivo || "",
          ator: cont.nome_contestante || "Anônimo",
          url: cont.evidencia_url,
          detalhes: { status: cont.status }
        });
      });

      timelineEntries.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      setEntries(timelineEntries);
    } catch (err) {
      console.error("[Timeline] Error fetching:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Nenhum histórico disponível para esta promessa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
          <History className="w-4 h-4" />
          Histórico de Alterações ({entries.length})
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-neon-cyan hover:text-white transition-colors"
        >
          {isExpanded ? "Recolher" : "Expandir"}
        </button>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
        
        <div className="space-y-4">
          {entries.map((entry, index) => {
            const config = tipoConfig[entry.tipo] || tipoConfig.manual;
            const showConnector = index < entries.length - 1;
            
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative pl-10"
              >
                <div className={`absolute left-0 w-8 h-8 rounded-full ${config.bg} border flex items-center justify-center ${config.color}`}>
                  {config.icon}
                </div>
                
                {showConnector && isExpanded && (
                  <div className="absolute left-4 top-8 w-px h-4 bg-white/5" />
                )}

                <div className={`${config.bg} border rounded-xl p-4 ${!isExpanded ? 'max-h-20 overflow-hidden' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h5 className={`font-bold text-sm ${config.color}`}>
                        {entry.titulo}
                      </h5>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(entry.data)}
                        <span className="mx-1">•</span>
                        <User className="w-3 h-3" />
                        {entry.ator}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>

                  {isExpanded && (
                    <>
                      <p className="text-gray-400 text-sm mb-3">
                        {entry.descricao}
                      </p>

                      {entry.detalhes && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {entry.detalhes.confianca && (
                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                              Confiança: {entry.detalhes.confianca}
                            </span>
                          )}
                          {entry.detalhes.score && (
                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                              Score: {entry.detalhes.score}/100
                            </span>
                          )}
                          {entry.detalhes.criterio && (
                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                              Critério: {entry.detalhes.criterio}
                            </span>
                          )}
                          {entry.detalhes.evidencias !== undefined && (
                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                              {entry.detalhes.evidencias} evidências
                            </span>
                          )}
                          {entry.detalhes.status && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entry.detalhes.status === 'aceita' ? 'bg-green-500/20 text-green-400' :
                              entry.detalhes.status === 'rejeitada' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {entry.detalhes.status}
                            </span>
                          )}
                        </div>
                      )}

                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver evidência
                        </a>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {!isExpanded && entries.length > 3 && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full py-2 text-sm text-neon-cyan hover:text-white transition-colors"
        >
          Ver todas as {entries.length} alterações
        </button>
      )}
    </div>
  );
}