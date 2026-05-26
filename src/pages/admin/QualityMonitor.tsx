import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../lib/api";
import { getAuthHeaders } from "../../lib/authHeaders";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, RotateCcw, ThumbsUp, Filter, Clock, Bug, FileSearch, ListChecks } from "lucide-react";

interface MonitorItem {
  id: string;
  promiseId: string;
  promiseTitle: string;
  politicianName: string;
  politicianId: string;
  state: string | null;
  score: number | null;
  status: string;
  category: string;
  issues: string[];
  issuesCount: number;
  model: string;
  evaluatedAt: string | null;
  fontesCount: number;
  fontesTotal: number;
  justification: string;
}

interface MonitorCounts {
  valid: number;
  warning: number;
  invalid: number;
  notEvaluated: number;
}

interface CorrectionLog {
  id: number;
  evaluation_id: string;
  promise_id: string;
  problem: string;
  action: string;
  details: string;
  corrected_by: string;
  created_at: string;
}

const tabs = [
  { key: 'all', label: 'Todas', icon: ListChecks },
  { key: 'valid', label: 'Válidas', icon: CheckCircle },
  { key: 'warning', label: 'Warning', icon: AlertTriangle },
  { key: 'invalid', label: 'Inválidas', icon: XCircle },
  { key: 'notEvaluated', label: 'Não avaliadas', icon: Clock },
];

const categoryColors: Record<string, string> = {
  valid: 'text-green-400 bg-green-500/10 border-green-500/20',
  warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  invalid: 'text-red-400 bg-red-500/10 border-red-500/20',
  notEvaluated: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

const categoryLabels: Record<string, string> = {
  valid: '✅ Válidas',
  warning: '⚠️ Com problemas',
  invalid: '❌ Inválidas',
  notEvaluated: '🔄 Não avaliadas',
};

export default function QualityMonitor() {
  const { user, profile, loading } = useAuth();
  const [items, setItems] = useState<MonitorItem[]>([]);
  const [counts, setCounts] = useState<MonitorCounts>({ valid: 0, warning: 0, invalid: 0, notEvaluated: 0 });
  const [needsAttention, setNeedsAttention] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [correctionLogs, setCorrectionLogs] = useState<CorrectionLog[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await api.get('/api/admin/quality-monitor', { headers });
      setItems(res.data?.items || []);
      setCounts(res.data?.counts || { valid: 0, warning: 0, invalid: 0, notEvaluated: 0 });
      setNeedsAttention(res.data?.needsAttention || 0);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Erro ao carregar monitor');
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await api.get('/api/admin/quality-monitor/log', { headers });
      setCorrectionLogs(res.data?.logs || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && profile?.role !== 'admin') return;
    fetchData();
    fetchLogs();
  }, [loading, profile, fetchData, fetchLogs]);

  async function handleReprocessAll() {
    if (!window.confirm(`Reavaliar todas as ${counts.invalid} promessas inválidas?`)) return;
    try {
      setActionLoading('reprocess-all');
      const headers = await getAuthHeaders();
      const res = await api.post('/api/admin/quality-monitor/reprocess-all', {}, { headers });
      alert(`${res.data?.queued || 0} promessas enfileiradas para reavaliação`);
      fetchData();
      fetchLogs();
    } catch (err: any) {
      alert('Erro: ' + (err?.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReprocess(promiseId: string) {
    try {
      setActionLoading(`reprocess-${promiseId}`);
      const headers = await getAuthHeaders();
      await api.post('/api/admin/quality-monitor/reprocess', { promiseId }, { headers });
      fetchData();
      fetchLogs();
    } catch (err: any) {
      alert('Erro: ' + (err?.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(evaluationId: string, promiseId: string) {
    try {
      setActionLoading(`approve-${evaluationId}`);
      const headers = await getAuthHeaders();
      await api.post('/api/admin/quality-monitor/approve', { evaluationId, promiseId }, { headers });
      fetchData();
      fetchLogs();
    } catch (err: any) {
      alert('Erro: ' + (err?.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  }

  const filteredItems = activeTab === 'all' ? items : items.filter(i => i.category === activeTab);

  if (loading) return null;
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-xl font-bold">Acesso restrito</p>
          <p className="text-sm mt-2">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileSearch className="w-8 h-8 text-neon-cyan" />
              Quality Monitor
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Filtro de qualidade entre a IA e o público — metodologia v1.1
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { fetchData(); fetchLogs(); }}
              className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
            <button
              onClick={() => setShowLog(!showLog)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all ${showLog ? 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30' : 'bg-dark-card border-white/10 text-gray-300 hover:text-white'}`}
            >
              <Clock className="w-4 h-4" />
              Log
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          {(['valid', 'warning', 'invalid', 'notEvaluated'] as const).map(cat => (
            <motion.div
              key={cat}
              whileHover={{ scale: 1.02 }}
              className={`p-5 rounded-2xl border ${categoryColors[cat]}`}
            >
              <p className="text-sm opacity-70 mb-1">{categoryLabels[cat]}</p>
              <p className="text-3xl font-bold">{counts[cat]}</p>
            </motion.div>
          ))}
        </div>

        {counts.invalid > 0 && (
          <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bug className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-300">
                <strong>{counts.invalid}</strong> avaliações inválidas detectadas — sem evidências reais
              </span>
            </div>
            <button
              onClick={handleReprocessAll}
              disabled={actionLoading === 'reprocess-all'}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-sm font-bold text-red-300 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${actionLoading === 'reprocess-all' ? 'animate-spin' : ''}`} />
              Reavaliar todas inválidas
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          {tabs.map(tab => {
            const count = tab.key === 'all' ? items.length : counts[tab.key as keyof MonitorCounts] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                    : 'bg-dark-card border border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className="text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {loadingData ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : filteredItems.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-20 text-gray-500"
            >
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-bold">Nenhum problema encontrado</p>
              <p className="text-sm mt-1">Todas as avaliações estão de acordo com a metodologia.</p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {filteredItems.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-2xl border ${categoryColors[item.category] || 'border-white/5 bg-dark-card'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${categoryColors[item.category]}`}>
                          {categoryLabels[item.category] || item.category}
                        </span>
                        {item.issuesCount > 0 && (
                          <span className="text-xs text-red-400 font-bold">
                            {item.issuesCount} problema(s)
                          </span>
                        )}
                      </div>
                      <p className="font-bold truncate">{item.promiseTitle}</p>
                      <p className="text-sm text-gray-400">
                        {item.politicianName}
                        {item.state ? ` • ${item.state}` : ''}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-500">
                          Score: <strong className={item.score != null ? 'text-white' : 'text-gray-500'}>{item.score ?? 'N/A'}</strong>
                        </span>
                        <span className="text-gray-500">
                          Status: <strong className="text-white">{item.status}</strong>
                        </span>
                        <span className="text-gray-500">
                          Fontes: <strong className={item.fontesCount < 2 ? 'text-red-400' : 'text-green-400'}>{item.fontesCount}/{item.fontesTotal}</strong>
                        </span>
                        <span className="text-gray-500">
                          Modelo: <strong className="text-white">{item.model}</strong>
                        </span>
                      </div>
                      {item.issues.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {item.issues.map((issue, idx) => (
                            <p key={idx} className="text-xs text-red-400 flex items-start gap-2">
                              <span>•</span>
                              <span>{issue}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {item.justification && (
                        <p className="text-xs text-gray-500 mt-2 truncate">{item.justification}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.category !== 'valid' && (
                        <>
                          <button
                            onClick={() => handleReprocess(item.promiseId)}
                            disabled={actionLoading === `reprocess-${item.promiseId}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${actionLoading === `reprocess-${item.promiseId}` ? 'animate-spin' : ''}`} />
                            Reavaliar
                          </button>
                          <button
                            onClick={() => handleApprove(item.id, item.promiseId)}
                            disabled={actionLoading === `approve-${item.id}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs font-bold text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {showLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-8"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-neon-cyan" />
              Log de Correções
            </h2>
            {correctionLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma correção registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/5">
                      <th className="text-left py-3 px-4 font-bold">Data</th>
                      <th className="text-left py-3 px-4 font-bold">Problema</th>
                      <th className="text-left py-3 px-4 font-bold">Ação</th>
                      <th className="text-left py-3 px-4 font-bold">Detalhes</th>
                      <th className="text-left py-3 px-4 font-bold">Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionLogs.map(log => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-red-400 max-w-xs truncate">{log.problem}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-sm truncate">{log.details}</td>
                        <td className="py-3 px-4 text-gray-400">{log.corrected_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
