import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { 
  Database, Plus, Trash2, Activity, List, ShieldCheck, Sparkles, Power, 
  Eye, EyeOff, Play, FileText, AlertCircle, Users, CheckCircle, XCircle, 
  Clock, RefreshCw, Newspaper, BarChart3, AlertTriangle
} from "lucide-react";
import {
  Badge,
  EmptyState,
  Input,
  Textarea,
  Select,
  FormField,
  Button,
  Card,
  Spinner,
} from "../components/ui";

interface PromiseStats {
  total: number;
  cumprida: number;
  parcialmente_cumprida: number;
  em_andamento: number;
  nao_iniciada: number;
  descumprida: number;
  pendente: number;
}

interface PoliticianStats {
  total: number;
}

interface EvidenceStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

{/* Helper: obter Bearer token da sessão Supabase */}
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return { "Authorization": `Bearer ${session.access_token}` };
}

export default function Admin() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [promiseStats, setPromiseStats] = useState<PromiseStats | null>(null);
  const [politicianStats, setPoliticianStats] = useState<PoliticianStats | null>(null);
  const [evidenceStats, setEvidenceStats] = useState<EvidenceStats | null>(null);
  
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<any>(null);

  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    setSessionExpired(false);

    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.error("[Admin] getUser error:", error);
        if (error.message.includes("Invalid API key") || error.status === 401) {
          setSessionExpired(true);
        }
        return;
      }
      if (user && isMountedRef.current) {
        setUserId(user.id);
        checkAdminRole(user.id);
      }
    }).catch(err => {
      console.error("[Admin] getUser catch error:", err);
      if (err.message?.includes("auth") || err.status === 401) {
        setSessionExpired(true);
      }
    });
  }, [navigate]);

  async function checkAdminRole(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Error checking admin role:", error.message);
      setIsLoading(false);
      return;
    }

    console.log(`User ${data?.email} has role: ${data?.role}`);

    if (data?.role === 'admin') {
      setIsAdmin(true);
      fetchStats();
    } else {
      setIsLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const [promisesRes, politiciansRes, evidencesRes] = await Promise.all([
        supabase.from('promises').select('status'),
        supabase.from('politicians').select('id', { count: 'exact', head: true }),
        supabase.from('promise_evidences').select('validation_status')
      ]);

      // Calculate promise stats
      const promises = promisesRes.data || [];
      const stats: PromiseStats = {
        total: promises.length,
        cumprimento: promises.filter(p => p.status === 'cumprida').length,
        parcialmente_cumprida: promises.filter(p => p.status === 'parcialmente_cumprida').length,
        em_andamento: promises.filter(p => p.status === 'em_andamento').length,
        nao_iniciada: promises.filter(p => p.status === 'nao_iniciada').length,
        descumprida: promises.filter(p => p.status === 'descumprida').length,
        pendente: promises.filter(p => p.status === 'pendente' || p.status === 'nao_classificada' || p.status === 'nao_iniciada').length
      };
      setPromiseStats(stats);

      // Politicians count
      setPoliticianStats({ total: politiciansRes.count || 0 });

      // Evidence stats
      const evidences = evidencesRes.data || [];
      setEvidenceStats({
        total: evidences.length,
        pending: evidences.filter(e => e.validation_status === 'pending').length,
        approved: evidences.filter(e => e.validation_status === 'approved').length,
        rejected: evidences.filter(e => e.validation_status === 'rejected').length
      });

      if (isMountedRef.current) {
        setIsLoading(false);
      }
    } catch (err) {
      console.error("[Admin] fetchStats error:", err);
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function runEvidencePipeline() {
    setIsRunningPipeline(true);
    setPipelineResult(null);
    try {
      const res = await fetch('/api/evidence/pipeline/run');
      const data = await res.json();
      setPipelineResult(data);
      fetchStats();
    } catch (err: any) {
      setPipelineResult({ status: 'error', message: err.message });
    } finally {
      setIsRunningPipeline(false);
    }
  }

  async function runBatchClassify() {
    setIsClassifying(true);
    setClassifyResult(null);
    try {
      const res = await fetch('/api/score/batch', {
        method: 'POST',
        headers: await getAuthHeaders()
      });
      const data = await res.json();
      setClassifyResult(data);
      fetchStats();
    } catch (err: any) {
      setClassifyResult({ status: 'error', message: err.message });
    } finally {
      setIsClassifying(false);
    }
  }

  async function checkPipelineStatus() {
    try {
      const res = await fetch('/api/evidence/pipeline/status');
      const data = await res.json();
      setPipelineStatus(data);
    } catch (err) {
      console.error("Pipeline status error:", err);
    }
  }

  const handleRelogin = () => {
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-gray-400 mt-4">Carregando painel admin...</p>
        </div>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">Sessão Expirada</h2>
          <p className="text-gray-400 mb-8">
            Sua sessão expirou ou você não tem permissão para acessar esta área.
          </p>
          <button
            onClick={handleRelogin}
            className="px-8 py-4 bg-gradient-to-r from-neon-purple to-neon-cyan text-white rounded-xl font-bold shadow-lg"
          >
            Entrar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) return <div className="p-12 text-center text-red-400">Acesso negado. Apenas administradores.</div>;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl mb-2 flex items-center gap-4">
        <Database className="w-10 h-10 text-neon-purple" />
        Painel Admin - Promessômetro
      </h1>
      <p className="text-gray-400 mb-8">Gerencie promessas, evidências e monitore o sistema</p>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <Users className="w-8 h-8 text-neon-cyan mb-2" />
          <div className="text-3xl font-bold">{politicianStats?.total || 0}</div>
          <div className="text-sm text-gray-400">Políticos</div>
        </div>
        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <FileText className="w-8 h-8 text-neon-purple mb-2" />
          <div className="text-3xl font-bold">{promiseStats?.total || 0}</div>
          <div className="text-sm text-gray-400">Promessas</div>
        </div>
        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <Newspaper className="w-8 h-8 text-neon-green mb-2" />
          <div className="text-3xl font-bold">{evidenceStats?.total || 0}</div>
          <div className="text-sm text-gray-400">Evidências</div>
        </div>
        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <Clock className="w-8 h-8 text-yellow-400 mb-2" />
          <div className="text-3xl font-bold">{evidenceStats?.pending || 0}</div>
          <div className="text-sm text-gray-400">Pendentes</div>
        </div>
      </div>

      {/* Promise Status Breakdown */}
      <div className="mb-8 p-6 bg-dark-card border border-white/10 rounded-2xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-neon-purple" /> Status das Promessas
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3 bg-green-500/10 rounded-xl text-center">
            <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-green-400">{promiseStats?.cumprida || 0}</div>
            <div className="text-xs text-gray-400">Cumprida</div>
          </div>
          <div className="p-3 bg-yellow-500/10 rounded-xl text-center">
            <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-yellow-400">{promiseStats?.parcialmente_cumprida || 0}</div>
            <div className="text-xs text-gray-400">Parcial</div>
          </div>
          <div className="p-3 bg-orange-500/10 rounded-xl text-center">
            <Activity className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-orange-400">{promiseStats?.em_andamento || 0}</div>
            <div className="text-xs text-gray-400">Em Andamento</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-center">
            <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-blue-400">{promiseStats?.nao_iniciada || 0}</div>
            <div className="text-xs text-gray-400">Não Iniciada</div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-xl text-center">
            <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-red-400">{promiseStats?.descumprida || 0}</div>
            <div className="text-xs text-gray-400">Descumprida</div>
          </div>
          <div className="p-3 bg-gray-500/10 rounded-xl text-center">
            <Clock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <div className="text-xl font-bold text-gray-400">{promiseStats?.pendente || 0}</div>
            <div className="text-xs text-gray-400">Pendente</div>
          </div>
        </div>
      </div>

      {/* Evidence Pipeline Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-neon-green" /> Pipeline de Evidências
          </h2>
          
          <p className="text-sm text-gray-400 mb-4">
            Busca notícias automáticamente e relaciona com promessas não cumpridas.
          </p>
          
          <Button
            loading={isRunningPipeline}
            onClick={runEvidencePipeline}
            className="w-full"
          >
            <Play className="w-5 h-5" />
            {isRunningPipeline ? "Executando..." : "Rodar Pipeline"}
          </Button>
          
          {pipelineResult && (
            <div className={`mt-4 p-4 rounded-xl ${pipelineResult.status === 'ok' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              {pipelineResult.status === 'ok' ? (
                <>
                  <div className="text-green-400 font-bold">✓ Pipeline executado</div>
                  <div className="text-sm text-gray-400">
                    Artigos: {pipelineResult.artigos_encontrados} | Evidências: {pipelineResult.evidencias_salvas}
                  </div>
                </>
              ) : (
                <div className="text-red-400">Erro: {pipelineResult.message}</div>
              )}
            </div>
          )}
          
          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => navigate('/admin/evidences')}
              className="flex-1 px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-xl text-sm font-bold hover:bg-neon-cyan/30 transition-all"
            >
              Ver Evidências ({evidenceStats?.pending || 0})
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neon-purple" /> Classificação IA
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Classifica promessas não avaliadas usando IA (Groq).
            </p>
            <Button
              loading={isClassifying}
              onClick={runBatchClassify}
              className="w-full bg-gradient-to-r from-neon-purple to-neon-cyan"
            >
              <Sparkles className="w-5 h-5" />
              {isClassifying ? "Classificando..." : "Classificar Todas"}
            </Button>
            {classifyResult && (
              <div className={`mt-4 p-4 rounded-xl ${classifyResult.status === 'ok' || classifyResult.success > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                {classifyResult.success > 0 ? (
                  <>
                    <div className="text-green-400 font-bold">✓ Classificação completa</div>
                    <div className="text-sm text-gray-400">
                      Processadas: {classifyResult.processed} | Sucesso: {classifyResult.success} | Falhas: {classifyResult.failed}
                    </div>
                  </>
                ) : (
                  <div className="text-red-400">Erro: {classifyResult.error || classifyResult.message}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-purple" /> Links Rápidos
          </h2>
          
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/admin/system-errors')}
              className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-left hover:border-neon-purple/30 transition-all flex items-center justify-between"
            >
              <span>Erros do Sistema</span>
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </button>
            
            <button 
              onClick={() => navigate('/admin/audit-logs')}
              className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-left hover:border-neon-purple/30 transition-all flex items-center justify-between"
            >
              <span>Logs de Auditoria</span>
              <List className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => navigate('/admin/backups')}
              className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-left hover:border-neon-purple/30 transition-all flex items-center justify-between"
            >
              <span>Backups</span>
              <Database className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={fetchStats}
            className="mt-4 w-full px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* Evidence Validation Status */}
      {evidenceStats && evidenceStats.total > 0 && (
        <div className="p-6 bg-dark-card border border-white/10 rounded-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-neon-cyan" /> Validação de Evidências
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-yellow-500/10 rounded-xl text-center">
              <div className="text-2xl font-bold text-yellow-400">{evidenceStats.pending}</div>
              <div className="text-sm text-gray-400">Pendente</div>
            </div>
            <div className="p-4 bg-green-500/10 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-400">{evidenceStats.approved}</div>
              <div className="text-sm text-gray-400">Aprovada</div>
            </div>
            <div className="p-4 bg-red-500/10 rounded-xl text-center">
              <div className="text-2xl font-bold text-red-400">{evidenceStats.rejected}</div>
              <div className="text-sm text-gray-400">Rejeitada</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}