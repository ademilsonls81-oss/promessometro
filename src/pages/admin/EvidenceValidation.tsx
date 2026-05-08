import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle, XCircle, AlertCircle, Clock, ExternalLink, 
  Shield, Filter, RefreshCw, Loader2, FileText, Link2, TrendingUp, TrendingDown
} from "lucide-react";
import { Button, Badge } from "../../components/ui";
import { supabase } from "../../lib/supabaseClient";

interface Evidence {
  id: string;
  promise_id: string;
  source_name: string;
  source_url: string;
  source_type: string;
  source_credibility: number;
  title: string;
  content: string;
  published_date: string | null;
  evidence_type: string;
  confidence_score: number;
  ai_analysis: any;
  validation_status: string;
  created_at: string;
}

interface PromiseInfo {
  id: string;
  politician_name: string;
  promise_title: string;
  category: string;
}

const typeConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  fulfillment: { label: "Cumprida", color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle },
  partial: { label: "Parcial", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: AlertCircle },
  break: { label: "Quebrada", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  neutral: { label: "Neutro", color: "text-gray-400", bg: "bg-gray-500/10", icon: FileText },
  related: { label: "Relacionado", color: "text-blue-400", bg: "bg-blue-500/10", icon: Link2 }
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-yellow-400" },
  approved: { label: "Aprovada", color: "text-green-400" },
  rejected: { label: "Rejeitada", color: "text-red-400" },
  disputed: { label: "Disputada", color: "text-orange-400" }
};

export default function EvidenceValidation() {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [promises, setPromises] = useState<Record<string, PromiseInfo>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvidences();
  }, [filter]);

  async function fetchEvidences() {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('promise_evidences')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== "all") {
        query = query.eq('validation_status', filter);
      }

      const { data: evidencesData, error: evidencesError } = await query;

      if (evidencesError) throw evidencesError;
      setEvidences(evidencesData || []);

      // Fetch promise info for each evidence
      const uniquePromiseIds = [...new Set((evidencesData || []).map((e: Evidence) => e.promise_id).filter(Boolean))];
      const promisesMap: Record<string, PromiseInfo> = {};

      for (const promiseId of uniquePromiseIds.slice(0, 20)) {
        const { data: promiseData } = await supabase
          .from('promises')
          .select('id, politician_name, promise_title, category')
          .eq('id', promiseId)
          .single();

        if (promiseData) {
          promisesMap[promiseId] = promiseData;
        }
      }
      setPromises(promisesMap);
    } catch (err: any) {
      console.error("[EvidenceValidation] Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function validateEvidence(evidenceId: string, status: "approved" | "rejected") {
    try {
      setProcessing(evidenceId);

      const { error: updateError } = await supabase
        .from('promise_evidences')
        .update({ 
          validation_status: status,
          validated_at: new Date().toISOString()
        })
        .eq('id', evidenceId);

      if (updateError) throw updateError;

      // Log de auditoria
      await supabase.from('promise_audit_log').insert({
        promise_id: null,
        action: 'EVIDENCE_VALIDATED',
        new_value: { evidence_id: evidenceId, status },
        source: 'MANUAL',
        notes: `Evidência ${status} manualmente`
      });

      // Atualizar UI
      setEvidences(prev => prev.map(e => 
        e.id === evidenceId ? { ...e, validation_status: status } : e
      ));

    } catch (err: any) {
      console.error("[EvidenceValidation] Validate error:", err);
      alert("Erro ao validar: " + err.message);
    } finally {
      setProcessing(null);
    }
  }

  const stats = {
    total: evidences.length,
    pending: evidences.filter(e => e.validation_status === 'pending').length,
    approved: evidences.filter(e => e.validation_status === 'approved').length,
    rejected: evidences.filter(e => e.validation_status === 'rejected').length,
    fulfilled: evidences.filter(e => e.evidence_type === 'fulfilled').length,
    broken: evidences.filter(e => e.evidence_type === 'break').length
  };

  return (
    <div className="min-h-screen py-12 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-neon-purple" />
            <h1 className="text-3xl font-bold">Validação de Evidências</h1>
          </div>
          <p className="text-gray-400">
            Sistema à prova de refutação. Aprove evidências de fontes confiáveis para categorizar promessas automaticamente.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button onClick={() => setFilter("all")} className={`p-4 rounded-2xl border text-left transition-all ${filter === "all" ? "border-neon-purple bg-neon-purple/10" : "border-white/5 bg-dark-card"}`}>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-gray-500 text-sm">Total</div>
          </button>
          <button onClick={() => setFilter("pending")} className={`p-4 rounded-2xl border text-left transition-all ${filter === "pending" ? "border-yellow-500 bg-yellow-500/10" : "border-white/5 bg-dark-card"}`}>
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-gray-500 text-sm">Pendentes</div>
          </button>
          <button onClick={() => setFilter("approved")} className={`p-4 rounded-2xl border text-left transition-all ${filter === "approved" ? "border-green-500 bg-green-500/10" : "border-white/5 bg-dark-card"}`}>
            <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
            <div className="text-gray-500 text-sm">Aprovadas</div>
          </button>
          <button onClick={() => setFilter("rejected")} className={`p-4 rounded-2xl border text-left transition-all ${filter === "rejected" ? "border-red-500 bg-red-500/10" : "border-white/5 bg-dark-card"}`}>
            <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
            <div className="text-gray-500 text-sm">Rejeitadas</div>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-dark-card border border-red-500/20 rounded-3xl">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
            <Button onClick={fetchEvidences} className="mt-4">Tentar novamente</Button>
          </div>
        ) : evidences.length === 0 ? (
          <div className="text-center py-20 bg-dark-card border border-white/5 rounded-3xl">
            <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhuma evidência encontrada</p>
            <p className="text-gray-600 text-sm mt-2">
              As evidências são automaticamente pesquisadas quando novas promessas são reportadas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {evidences.map((evidence, idx) => {
              const promise = promises[evidence.promise_id];
              const typeCfg = typeConfig[evidence.evidence_type] || typeConfig.neutral;
              const StatusIcon = typeCfg.icon;
              const statusCfg = statusConfig[evidence.validation_status] || statusConfig.pending;

              return (
                <motion.div
                  key={evidence.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-dark-card border border-white/5 rounded-3xl p-6"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge variant={evidence.source_type as any}>{evidence.source_type}</Badge>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${typeCfg.bg} ${typeCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {typeCfg.label}
                        </div>
                        <span className={`text-xs font-bold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        <span className="text-gray-600 text-xs">
                          Confiança: {evidence.confidence_score}%
                        </span>
                      </div>

                      <h3 className="text-lg font-bold mb-2">{evidence.title}</h3>
                      
                      {promise && (
                        <div className="text-sm text-gray-400 mb-3">
                          {promise.politician_name} • {promise.promise_title?.substring(0, 50)}...
                        </div>
                      )}

                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                        {evidence.content}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> {evidence.source_name}
                        </span>
                        <span className="flex items-center gap-1">
                          ★ {evidence.source_credibility}% confiabilidade
                        </span>
                        {evidence.published_date && (
                          <span>{new Date(evidence.published_date).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:w-48">
                      <a
                        href={evidence.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> Ver Fonte
                      </a>

                      {evidence.validation_status === "pending" && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            className="gap-2"
                            disabled={processing === evidence.id}
                            onClick={() => validateEvidence(evidence.id, "approved")}
                          >
                            {processing === evidence.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            disabled={processing === evidence.id}
                            onClick={() => validateEvidence(evidence.id, "rejected")}
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={fetchEvidences} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}