import React from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  Info,
  Lightbulb,
  Shield,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Brain,
  AlertCircle
} from "lucide-react";

interface Evidence {
  descricao?: string;
  fonte?: string;
  url?: string | null;
  data?: string | null;
}

interface EvaluationDetail {
  status: string;
  fulfillment_score: number;
  criterio_aplicado: string;
  justificativa: string;
  evidencias_usadas: Evidence[];
  o_que_falta: string;
  o_que_foi_feito: string;
  confianca: number;
  motivo_confianca: string;
  modelo_ia?: string;
  gerado_em?: string;
  revisado_em?: string;
  tipo_promessa?: string;
}

interface PromiseEvaluationProps {
  evaluation: EvaluationDetail | null;
  loading?: boolean;
  onRefresh?: () => void;
  expanded?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; description: string }> = {
  cumprida: { 
    label: "Cumprida", 
    color: "text-green-400", 
    bg: "bg-green-500/10 border-green-500/30",
    icon: <CheckCircle className="w-5 h-5" />,
    description: "A promessa foi concretizada com evidências verificáveis"
  },
  parcialmente_cumprida: { 
    label: "Parcialmente Cumprida", 
    color: "text-yellow-400", 
    bg: "bg-yellow-500/10 border-yellow-500/30",
    icon: <Minus className="w-5 h-5" />,
    description: "Houve progresso, mas a promessa não foi completamente atendida"
  },
  em_andamento: { 
    label: "Em Andamento", 
    color: "text-blue-400", 
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "A promessa está em execução, com ações verificáveis em curso"
  },
  nao_iniciada: { 
    label: "Não Iniciada", 
    color: "text-gray-400", 
    bg: "bg-gray-500/10 border-gray-500/30",
    icon: <Clock className="w-5 h-5" />,
    description: "Não foram encontradas ações relacionadas à promessa"
  },
  descumprida: { 
    label: "Descumprida", 
    color: "text-red-400", 
    bg: "bg-red-500/10 border-red-500/30",
    icon: <XCircle className="w-5 h-5" />,
    description: "A promessa foi explicitamente descumprida ou houve ação contrária"
  },
  nao_classificada: { 
    label: "Não Classificada", 
    color: "text-gray-500", 
    bg: "bg-gray-500/10 border-gray-500/30",
    icon: <AlertCircle className="w-5 h-5" />,
    description: "A promessa não pode ser verificada automaticamente"
  },
};

function getConfidenceLevel(confianca: number): { label: string; color: string; bg: string } {
  if (confianca >= 0.7) return { label: "Alta", color: "text-green-400", bg: "bg-green-500" };
  if (confianca >= 0.4) return { label: "Média", color: "text-yellow-400", bg: "bg-yellow-500" };
  return { label: "Baixa", color: "text-red-400", bg: "bg-red-500" };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Data não disponível";
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

export default function PromiseEvaluation({ evaluation, loading, onRefresh, expanded = true }: PromiseEvaluationProps) {
  if (loading) {
    return (
      <div className="bg-dark-card border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-neon-purple" />
          <span className="ml-3 text-gray-400">Carregando avaliação...</span>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-dark-card border border-white/10 rounded-2xl p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-400 mb-2">Avaliação não disponível</h3>
          <p className="text-gray-500 text-sm mb-4">
            Esta promessa ainda não foi avaliada pelo sistema.
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Gerar Avaliação
            </button>
          )}
        </div>
      </div>
    );
  }

  const config = statusConfig[evaluation.status] || statusConfig.nao_classificada;
  const confidence = getConfidenceLevel(evaluation.confianca);
  const scoreColor = evaluation.fulfillment_score >= 70 ? "text-green-400" : 
                      evaluation.fulfillment_score >= 40 ? "text-yellow-400" : "text-red-400";

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Card Principal - Status e Score */}
      <div className={`border rounded-2xl p-6 ${config.bg}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className={`font-bold text-lg ${config.color}`}>{config.label}</h3>
              <p className="text-gray-400 text-sm mt-1">{config.description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-4xl font-bold ${scoreColor}`}>
              {evaluation.fulfillment_score}
              <span className="text-lg text-gray-500 font-normal">/100</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">Score de Cumprimento</p>
          </div>
        </div>

        {/* Critério Aplicado */}
        {evaluation.criterio_aplicado && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Info className="w-4 h-4" />
              <span>Critério aplicado: <strong className="text-white">{evaluation.criterio_aplicado}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Aviso de Baixa Confiança */}
      {evaluation.confianca < 0.5 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">
              Avaliação com baixa confiança
            </p>
            <p className="text-yellow-400/70 text-sm mt-1">
              {evaluation.motivo_confianca || "Poucos dados disponíveis para uma análise precisa."}
            </p>
          </div>
        </div>
      )}

      {/* Seção: Motivo do Score */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          Motivo do Score
        </h4>
        <p className="text-gray-200 leading-relaxed">
          {evaluation.justificativa || "Aguardando análise..."}
        </p>
      </div>

      {/* Seção: O que foi feito */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <TrendingUp className="w-4 h-4 text-green-400" />
          O que foi concluído
        </h4>
        <p className="text-gray-200 leading-relaxed">
          {evaluation.o_que_foi_feito || "Aguardando dados..."}
        </p>
      </div>

      {/* Seção: O que ainda falta */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <Clock className="w-4 h-4 text-orange-400" />
          O que ainda falta
        </h4>
        <p className="text-gray-200 leading-relaxed">
          {evaluation.o_que_falta || "Aguardando dados..."}
        </p>
      </div>

      {/* Seção: Evidências utilizadas */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <FileText className="w-4 h-4 text-cyan-400" />
          Evidências utilizadas ({evaluation.evidencias_usadas?.length || 0})
        </h4>
        
        {evaluation.evidencias_usadas && evaluation.evidencias_usadas.length > 0 ? (
          <div className="space-y-3">
            {evaluation.evidencias_usadas.map((ev, idx) => (
              <div 
                key={idx}
                className="p-4 bg-black/30 border border-white/5 rounded-xl hover:border-white/10 transition-colors"
              >
                <p className="text-gray-300 mb-3 leading-relaxed">
                  {ev.descricao || "Sem descrição disponível"}
                </p>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {ev.fonte || "Fonte não especificada"}
                    </span>
                    {ev.data && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(ev.data)}
                      </span>
                    )}
                  </div>
                  {ev.url ? (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neon-cyan hover:text-white text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver fonte original
                    </a>
                  ) : (
                    <span className="text-gray-600 text-xs flex items-center gap-1">
                      Fonte sem link disponível
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">
            Nenhuma evidência foi utilizada nesta avaliação.
          </p>
        )}
      </div>

      {/* Seção: Fontes consultadas (resumo) */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <ExternalLink className="w-4 h-4 text-blue-400" />
          Fontes consultadas
        </h4>
        <div className="flex flex-wrap gap-2">
          {evaluation.evidencias_usadas && evaluation.evidencias_usadas.length > 0 ? (
            [...new Set(evaluation.evidencias_usadas.map(e => e.fonte).filter(Boolean))].map((fonte, idx) => (
              <span 
                key={idx}
                className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full"
              >
                {fonte}
              </span>
            ))
          ) : (
            <span className="text-gray-500 text-sm italic">Nenhuma fonte específica</span>
          )}
        </div>
      </div>

      {/* Seção: Grau de Confiança da IA */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <Brain className="w-4 h-4 text-purple-400" />
          Grau de Confiança da IA
        </h4>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${confidence.color}`}>
                  {confidence.label}
                </span>
                <span className="text-white font-mono">
                  {Math.round(evaluation.confianca * 100)}%
                </span>
              </div>
              <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${confidence.bg}`}
                  style={{ width: `${evaluation.confianca * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {evaluation.motivo_confianca && (
            <p className="text-sm text-gray-400 leading-relaxed">
              {evaluation.motivo_confianca}
            </p>
          )}
          
          <div className="pt-3 border-t border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Confiança calculada com base na quantidade e qualidade das fontes</span>
              </div>
              {evaluation.tipo_promessa && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Info className="w-4 h-4" />
                  <span>Tipo: {evaluation.tipo_promessa}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seção: Última atualização */}
      <div className="bg-dark-card border border-white/10 rounded-2xl p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          Última atualização
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Avaliação gerada em:</span>
            <span className="text-white font-mono text-sm">
              {formatDate(evaluation.gerado_em)}
            </span>
          </div>
          
          {evaluation.revisado_em && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Última revisão:</span>
              <span className="text-white font-mono text-sm">
                {formatDate(evaluation.revisado_em)}
                {evaluation.revisado_por && (
                  <span className="text-gray-500 ml-2">por {evaluation.revisado_por}</span>
                )}
              </span>
            </div>
          )}
          
          {evaluation.modelo_ia && (
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Brain className="w-3 h-3" />
                <span>Modelo IA: <strong className="text-gray-400">{evaluation.modelo_ia}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botão de atualização */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar avaliação
        </button>
      )}
    </motion.div>
  );
}