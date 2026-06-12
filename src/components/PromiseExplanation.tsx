import React from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink, 
  Info, Lightbulb, AlertCircle, Link as LinkIcon, Shield
} from "lucide-react";

interface EvidenceUsed {
  descricao?: string;
  fonte?: string;
  url?: string | null;
  data?: string | null;
}

interface PromiseExplanationProps {
  status?: string;
  fulfillment_score?: number;
  criterio_aplicado?: string;
  justificativa?: string;
  evidencias_usadas?: EvidenceUsed[] | any[];
  o_que_falta?: string;
  o_que_foi_feito?: string;
  confianca?: number;
  motivo_confianca?: string;
  gerado_em?: string;
  modelo_ia?: string;
}

interface PromiseExplanationComponentProps {
  explanation: any;  // any-ok
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  cumprida: { 
    label: "Cumprida", 
    color: "text-green-400", 
    bg: "bg-green-500/10", 
    icon: <CheckCircle className="w-5 h-5" /> 
  },
  parcialmente_cumprida: { 
    label: "Parcialmente Cumprida", 
    color: "text-yellow-400", 
    bg: "bg-yellow-500/10", 
    icon: <Clock className="w-5 h-5" /> 
  },
  em_andamento: { 
    label: "Em Andamento", 
    color: "text-orange-400", 
    bg: "bg-orange-500/10", 
    icon: <Clock className="w-5 h-5" /> 
  },
  nao_iniciada: { 
    label: "Não Iniciada", 
    color: "text-blue-400", 
    bg: "bg-blue-500/10", 
    icon: <Clock className="w-5 h-5" /> 
  },
  descumprida: { 
    label: "Descumprida", 
    color: "text-red-400", 
    bg: "bg-red-500/10", 
    icon: <XCircle className="w-5 h-5" /> 
  },
  nao_classificada: { 
    label: "Não Classificada", 
    color: "text-gray-400", 
    bg: "bg-gray-500/10", 
    icon: <Clock className="w-5 h-5" /> 
  },
};

export default function PromiseExplanation({ explanation }: PromiseExplanationComponentProps) {
  const config = statusConfig[explanation?.status] || statusConfig.nao_classificada;
  const isLowConfidence = (explanation?.confianca ?? 1) < 0.5;

  const status = explanation?.status || "nao_classificada";
  const score = explanation?.fulfillment_score ?? explanation?.fulfillment_score ?? 0;
  const justificativa = explanation?.justificativa || "Aguardando classificação...";
  const criterio = explanation?.criterio_aplicado || "Aguardando análise";
  const evidencias = explanation?.evidencias_usadas || [];
  const oQueFalta = explanation?.o_que_falta || "Aguardando dados";
  const oQueFeito = explanation?.o_que_foi_feito || "Aguardando dados";
  const confianca = explanation?.confianca ?? 1;
  const motivoConfianca = explanation?.motivo_confianca || "Aguardando análise";
  const geradoEm = explanation?.gerado_em;
  const modeloIa = explanation?.modelo_ia;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-card border border-white/10 rounded-2xl p-6 space-y-4"
    >
      {/* Status e Score */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 ${config.bg} px-4 py-2 rounded-xl`}>
          {config.icon}
          <span className={`font-bold ${config.color}`}>{config.label}</span>
        </div>
        <div className="text-3xl font-bold text-white">
          {score}
          <span className="text-sm text-gray-500 font-normal">/100</span>
        </div>
      </div>

      {/* Baixa Confiança Aviso */}
      {isLowConfidence && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-400 text-sm font-medium">
            Avaliação com baixa confiança — poucos dados disponíveis
          </span>
        </div>
      )}

      {/* Por que essa nota? */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Por que essa nota?
        </h3>
        <p className="text-gray-300">{justificativa}</p>
        <p className="text-xs text-gray-500 mt-1">{criterio}</p>
      </div>

      {/* O que foi feito */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          O que foi feito
        </h3>
        <p className="text-gray-300">{oQueFeito}</p>
      </div>

      {/* O que ainda falta */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-400" />
          O que ainda falta
        </h3>
        <p className="text-gray-300">{oQueFalta}</p>
      </div>

      {/* Evidências usadas */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Evidências usadas
        </h3>
        {Array.isArray(evidencias) && evidencias.length > 0 ? (
          <div className="space-y-2">
            {evidencias.map((ev: any, idx: number) => (  // any-ok
              <div 
                key={idx} 
                className="p-3 bg-black/30 border border-white/5 rounded-xl"
              >
                <p className="text-sm text-gray-300 mb-2">{ev.descricao || ev.description || "Evidência"}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {ev.fonte || ev.fonte || "Fonte"} {ev.data && `• ${ev.data}`}
                  </span>
                  {ev.url ? (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neon-cyan hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver fonte
                    </a>
                  ) : (
                    <span className="text-gray-600 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" />
                      fonte sem link disponível
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Nenhuma evidência disponível.</p>
        )}
      </div>

      {/* Confiança da IA */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Confiança da IA
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  confianca >= 0.7 ? "bg-green-400" :
                  confianca >= 0.4 ? "bg-yellow-400" : "bg-red-400"
                }`}
                style={{ width: `${confianca * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold text-white">
              {Math.round(confianca * 100)}%
            </span>
          </div>
          <p className="text-xs text-gray-500">{motivoConfianca}</p>
        </div>
      </div>

      {/* Rodapé */}
      {(geradoEm || modeloIa) && (
        <div className="text-xs text-gray-600 border-t border-white/5 pt-3">
          {geradoEm && (
            <span>Avaliado por IA em {new Date(geradoEm).toLocaleString("pt-BR")}</span>
          )}
          {geradoEm && modeloIa && " • "}
          {modeloIa && <span>{modeloIa}</span>}
        </div>
      )}
    </motion.div>
  );
}