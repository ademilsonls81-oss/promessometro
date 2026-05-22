import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, LogOut, RefreshCw, ChevronRight, CheckCircle, XCircle,
  AlertTriangle, BarChart3, FileText, Gavel, Users, Star, Download,
  Play, Github, Zap, Search, Database, Clock, TrendingUp, Activity,
  ChevronDown, Loader2, AlertCircle, ArrowRight, Package, Bot, Globe,
  UserCheck, Scale, SlidersHorizontal, BookOpen, Award, Calculator
} from "lucide-react";

interface CriterioFalha { id: string; descricao: string }
interface PoliticoQualidade {
  id: string; nome: string; status: string; score_qualidade: number;
  criterios_ok: string[]; criterios_falhos: CriterioFalha[];
  stats: { total_criterios: number; ok: number; falhos: number; total_promises: number; total_explanations: number; total_indicators: number }
}
interface SystemStatus {
  politicians: number; promises: number; evaluated: number;
  never_evaluated: number; heranca_automatica: number; coverage: number;
  last_cron: { execution_id: string; status: string; started_at: string; promises_evaluated: number; hours_ago: number } | null;
  cron_history: any[];
}
interface Politician { id: string; name: string; role: string; state: string; party: string; slug: string }

const BLOCO_LABELS: Record<string, string> = {
  A: "Dados Cadastrais", B: "Promessas (C1)", C: "Indicadores (C2)",
  D: "Fatos Jurídicos (C3)", E: "Nota Final"
};
const BLOCO_ICONS: Record<string, any> = { A: Users, B: FileText, C: BarChart3, D: Gavel, E: Star };
const BLOCO_TOTALS: Record<string, number> = { A: 6, B: 14, C: 4, D: 6, E: 3 };

function getToken() { return localStorage.getItem("admin_token") || ""; }

async function authFetch(url: string, options: any = {}) {
  const token = getToken();
  if (!token) return null;
  const headers = { ...options.headers, Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) return null;
  return res;
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const colors = {
    verde: "bg-green-500/20 text-green-400 border-green-500/30",
    amarelo: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    vermelho: "bg-red-500/20 text-red-400 border-red-500/30"
  };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${colors[status] || colors.vermelho}`}>
      {label || status.toUpperCase()}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "cyan" }: any) {
  const colors: Record<string, string> = {
    cyan: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20",
    green: "text-green-400 bg-green-400/10 border-green-400/20",
    red: "text-red-400 bg-red-400/10 border-red-400/20",
    yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20"
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} flex flex-col gap-1`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = false }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-dark-card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-neon-cyan" />
          <span className="font-semibold text-white">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-4 pt-0 border-t border-white/5">{children}</div>}
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [autenticado, setAutenticado] = useState(false);
  const [dados, setDados] = useState<PoliticoQualidade[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  // Tool states
  const [auditando, setAuditando] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [seedingIndicators, setSeedingIndicators] = useState<string | null>(null);
  const [findingPromises, setFindingPromises] = useState<string | null>(null);
  const [discoveringJob, setDiscoveringJob] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<{[key: string]: any}>({});
  const [discoveryLivePromises, setDiscoveryLivePromises] = useState<{[key: string]: any[]}>({});
  const [promisesCiData, setPromisesCiData] = useState<{[key: string]: any[]}>({});
  const [loadingCi, setLoadingCi] = useState<string | null>(null);
  const [fixingExplanations, setFixingExplanations] = useState<string | null>(null);
  const [fixingCadastro, setFixingCadastro] = useState<string | null>(null);
  const [seedingLegalFacts, setSeedingLegalFacts] = useState<string | null>(null);
  const [recalculatingScores, setRecalculatingScores] = useState<string | null>(null);
  const [recalculatingAll, setRecalculatingAll] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [toolResults, setToolResults] = useState<Record<string, any>>({});

  // Search politician for tools
  const [searchPol, setSearchPol] = useState("");
  const [filteredPols, setFilteredPols] = useState<Politician[]>([]);

  // Add politician form
  const [novoNome, setNovoNome] = useState("");
  const [novoEstado, setNovoEstado] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novoPartido, setNovoPartido] = useState("");
  const [novoCargo, setNovoCargo] = useState("Prefeito");
  const [novoPdfUrl, setNovoPdfUrl] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [resultadoAdd, setResultadoAdd] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { window.history.replaceState({}, "", "/admin"); loginGithub(code); }
    else if (getToken()) { setAutenticado(true); fetchAll(); }
  }, []);

  useEffect(() => {
    if (searchPol.length > 1) {
      setFilteredPols(politicians.filter(p => p.name.toLowerCase().includes(searchPol.toLowerCase())).slice(0, 8));
    } else { setFilteredPols([]); }
  }, [searchPol, politicians]);

  async function fetchAll() {
    setCarregando(true); setErro("");
    try {
      const token = getToken();
      if (!token) { setCarregando(false); return; }
      const t = Date.now();
      const [qualRes, statusRes, polRes] = await Promise.all([
        authFetch(`/api/admin/qualidade?t=${t}`),
        authFetch(`/api/admin/system-status?t=${t}`),
        authFetch(`/api/politicians/ranking?include_all=true&t=${t}`)
      ]);
      if (!qualRes) { localStorage.removeItem("admin_token"); setAutenticado(false); setCarregando(false); return; }
      const qual = await qualRes.json();
      setDados(qual.politicos || []);
      setAutenticado(true);
      if (statusRes) { const s = await statusRes.json(); setSystemStatus(s); }
      if (polRes) { const p = await polRes.json(); setPoliticians((p.ranking || []).map((r: any) => ({ id: r.id, name: r.name, role: r.role, state: r.state, party: r.party, slug: r.slug }))); }
    } catch (e: any) { setErro(e.message); }
    setCarregando(false);
  }

  async function loginGithub(code: string) {
    setCarregando(true); setErro("");
    try {
      const res = await fetch("/api/admin/auth/github", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (res.status === 401) { setErro("Email não autorizado"); setCarregando(false); return; }
      if (!res.ok) { setErro("Erro na autenticação"); setCarregando(false); return; }
      const json = await res.json();
      localStorage.setItem("admin_token", json.token);
      fetchAll();
    } catch (e: any) { setErro(e.message); setCarregando(false); }
  }

  async function rodarAuditoria() {
    setAuditando(true); setErro("");
    try {
      const res = await authFetch("/api/admin/qualidade/run", { method: "POST" });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, auditoria: json.audit }));
      fetchAll();
    } catch (e: any) { setErro(e.message); }
    setAuditando(false);
  }

  async function upgradeEvaluations() {
    setUpgrading(true); setErro("");
    try {
      const res = await authFetch("/api/upgrade-evaluations", { method: "POST" });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, upgrade: json }));
    } catch (e: any) { setErro(e.message); }
    setUpgrading(false);
  }

  async function seedIndicators(pol: Politician) {
    setSeedingIndicators(pol.id); setErro("");
    try {
      const res = await authFetch("/api/seed-indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id, politician_name: pol.name, state: pol.state, role: pol.role })
      });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, [`indicators_${pol.id}`]: json }));
    } catch (e: any) { setErro(e.message); }
    setSeedingIndicators(null);
  }

  async function findPromises(pol: Politician, dryRun = false) {
    setFindingPromises(pol.id); setErro("");
    try {
      const res = await authFetch("/api/find-promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id, politician_name: pol.name, role: pol.role, state: pol.state, dry_run: dryRun })
      });
      if (!res) return;
      const json = await res.json();
      if (!json.job_id) {
        setDiscoveryStatus(s => ({ ...s, [pol.id]: { status: "error", erro: json.error || json.detail || "Falha ao criar job" } }));
        setDiscoveringJob(null);
        return;
      }
      setToolResults(r => ({ ...r, [`promises_${pol.id}`]: json }));
      if (!dryRun) fetchAll();
    } catch (e: any) { setErro(e.message); }
    setFindingPromises(null);
  }

  async function startDiscovery(pol: Politician) {
    setDiscoveringJob(pol.id); setErro("");
    try {
      const res = await authFetch("/api/admin/start-discovery-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id, politician_name: pol.name, role: pol.role, state: pol.state, party: pol.party })
      });
      if (!res) return;
      const json = await res.json();
      if (!json.job_id) {
        setDiscoveryStatus(s => ({ ...s, [pol.id]: { status: "error", erro: json.error || json.detail || "Falha ao criar job" } }));
        setDiscoveringJob(null);
        return;
      }
      setDiscoveryStatus(s => ({ ...s, [pol.id]: { job_id: json.job_id, status: "pending", message: "Job criado! Aguardando processamento..." } }));

      // Poll for completion — each ciclo: step (processa chunk) + status (le progresso)
      const poll = async () => {
        // 1. Avança processamento chamando discovery-run-now
        await authFetch("/api/admin/discovery-run-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: json.job_id })
        });

        // 2. Le status atualizado
        const statusRes = await authFetch(`/api/admin/discovery-status/${json.job_id}`);
        if (!statusRes) return;
        const statusJson = await statusRes.json();
        if (statusJson.status === "completed" || statusJson.status === "error") {
          setDiscoveryStatus(s => ({ ...s, [pol.id]: statusJson }));
          setDiscoveringJob(null);
          setTimeout(() => fetchAll(), 2000);
        } else {
          setDiscoveryStatus(s => ({
            ...s,
            [pol.id]: {
              job_id: json.job_id,
              status: statusJson.status,
              current_page: statusJson.current_page,
              total_pages: statusJson.total_pages,
              total_extraidas: statusJson.total_extraidas,
              total_inseridas: statusJson.total_inseridas,
              message: statusJson.current_page && statusJson.total_pages
                ? `Página ${statusJson.current_page}/${statusJson.total_pages} — ${statusJson.total_extraidas || 0} extraídas, ${statusJson.total_inseridas || 0} inseridas`
                : statusJson.stage === "criado"
                ? "Job criado, iniciando processamento..."
                : statusJson.stage === "iniciando"
                ? "Iniciando..."
                : statusJson.stage === "buscando_tse"
                ? "Buscando PDF no TSE..."
                : statusJson.stage === "baixando_tse"
                ? "Baixando PDF do TSE..."
                : statusJson.stage === "buscando_pdf_serper"
                ? "Buscando PDF via Serper..."
                : statusJson.stage === "extraindo_pdf"
                ? "Extraindo promessas do PDF..."
                : statusJson.stage === "analisando_chunk"
                ? `Analisando páginas (${statusJson.current_page || 0}/${statusJson.total_pages || "?"})...`
                : statusJson.stage === "buscando_artigos"
                ? "Buscando artigos complementares..."
                : statusJson.stage === "inserindo"
                ? "Inserindo promessas no banco..."
                : 'Iniciando...'
            }
          }));
          if (statusJson.last_promises && statusJson.last_promises.length > 0) {
            setDiscoveryLivePromises(s => ({ ...s, [pol.id]: statusJson.last_promises }));
          }
          setTimeout(poll, 5000);
        }
      };
      setTimeout(poll, 3000);
    } catch (e: any) { setErro(e.message); setDiscoveringJob(null); }
  }

  async function fixExplanations(pol: Politician) {
    setFixingExplanations(pol.id); setErro("");
    try {
      const res = await authFetch("/api/admin/fix-explanations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id })
      });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, [`fix_explanations_${pol.id}`]: json }));
      setTimeout(() => fetchAll(), 2000);
    } catch (e: any) { setErro(e.message); }
    setFixingExplanations(null);
  }

  async function fixCadastro(pol: Politician) {
    setFixingCadastro(pol.id); setErro("");
    try {
      const res = await authFetch("/api/admin/fix-cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id })
      });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, [`fix_cadastro_${pol.id}`]: json }));
      setTimeout(() => fetchAll(), 2000);
    } catch (e: any) { setErro(e.message); }
    setFixingCadastro(null);
  }

  async function seedLegalFacts(pol: Politician) {
    setSeedingLegalFacts(pol.id); setErro("");
    try {
      const res = await authFetch("/api/admin/seed-legal-facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id, politician_name: pol.name })
      });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, [`legal_facts_${pol.id}`]: json }));
      setTimeout(() => fetchAll(), 2000);
    } catch (e: any) { setErro(e.message); }
    setSeedingLegalFacts(null);
  }

  async function recalculateScores(pol: Politician) {
    setRecalculatingScores(pol.id); setErro("");
    try {
      const res = await authFetch("/api/admin/recalculate-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politician_id: pol.id })
      });
      if (!res) return;
      const json = await res.json();
      setToolResults(r => ({ ...r, [`scores_${pol.id}`]: json }));
      setTimeout(() => fetchAll(), 2000);
    } catch (e: any) { setErro(e.message); }
    setRecalculatingScores(null);
  }

  async function loadPromisesCi(pol: Politician) {
    if (promisesCiData[pol.id]) { setPromisesCiData(r => { const n = { ...r }; delete n[pol.id]; return n; }); return; }
    setLoadingCi(pol.id);
    try {
      const token = getToken();
      const res = await fetch(`/api/politician/${pol.slug || pol.name}?t=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error("Falha ao carregar");
      const json = await res.json();
      setPromisesCiData(r => ({ ...r, [pol.id]: (json.promises || []).slice(0, 50).map((p: any) => ({
        id: p.id,
        title: p.promise_title,
        status: p.status,
        complexity: p.complexity_score || 1,
        impact: p.impact_score || 1
      })) }));
    } catch (e: any) { setErro(e.message); }
    setLoadingCi(null);
  }

  async function recalculateAllLegacy() {
    setRecalculatingAll(true); setErro("");
    const results = { total: 0, ok: 0, errors: 0, details: [] as any[] };
    try {
      for (const pol of politicians) {
        try {
          const res = await authFetch("/api/admin/recalculate-scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ politician_id: pol.id })
          });
          if (!res) throw new Error("Auth failed");
          const json = await res.json();
          results.ok++;
          results.details.push({ name: pol.name, legacy: json.scores?.legacy_score });
        } catch (e: any) {
          results.errors++;
          results.details.push({ name: pol.name, error: e.message });
        }
        results.total++;
      }
      setToolResults(r => ({ ...r, recalculate_all: results }));
      setTimeout(() => fetchAll(), 2000);
    } catch (e: any) { setErro(e.message); }
    setRecalculatingAll(false);
  }

  async function adicionarPolitico() {
    if (!novoNome.trim() || !novoEstado.trim()) { setErro("Nome e estado obrigatórios"); return; }
    setAdicionando(true); setErro(""); setResultadoAdd(null);
    try {
      const res = await authFetch("/api/admin/download-plano-governo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: novoNome.trim(),
          state: novoEstado.trim(),
          city: novaCidade.trim() || undefined,
          party: novoPartido.trim() || undefined,
          role: novoCargo,
          pdf_url: novoPdfUrl.trim() || undefined
        })
      });
      if (!res) return;
      const json = await res.json();
      setResultadoAdd(json);
      setTimeout(() => fetchAll(), 2000);
    } catch (e: any) { setErro(e.message); }
    setAdicionando(false);
  }

  async function runPipeline(target: string) {
    setPipelineRunning(true); setErro("");
    try {
      const res = await authFetch("/api/admin/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      if (!res) return;
      const json = await res.json();
      if (!res.ok) {
        setErro(`Erro ${res.status}: ${json.error || JSON.stringify(json)}`);
      } else {
        setToolResults(r => ({ ...r, pipeline: json }));
        // Refresh status after pipeline
        setTimeout(() => fetchAll(), 2000);
      }
    } catch (e: any) { setErro(e.message); }
    setPipelineRunning(false);
  }

  function sair() { localStorage.removeItem("admin_token"); setAutenticado(false); setDados([]); navigate("/admin"); }

  // ─── LOGIN ───────────────────────────────────────────────────────────────────
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 bg-dark-card border border-white/10 rounded-3xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-neon-cyan/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-neon-cyan" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Painel Admin</h1>
          <p className="text-sm text-gray-500 mb-6">Promessômetro Brasil — Controle de Qualidade</p>
          <button onClick={() => {
            const redirectUri = window.location.origin + "/admin";
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_ID || ""}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email`;
          }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-medium hover:bg-white/20 transition-colors">
            <Github className="w-5 h-5" /> Entrar com GitHub
          </button>
          {erro && <p className="text-red-400 text-xs mt-3">{erro}</p>}
        </div>
      </div>
    );
  }

  const verdes = dados.filter(d => d.status === "verde").length;
  const amarelos = dados.filter(d => d.status === "amarelo").length;
  const vermelhos = dados.filter(d => d.status === "vermelho").length;
  const avgScore = dados.length > 0 ? Math.round(dados.reduce((a, b) => a + b.score_qualidade, 0) / dados.length) : 0;

  // ─── MAIN ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-card/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-neon-cyan" />
            <span className="font-bold text-white">Admin</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">v2.0</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={rodarAuditoria} disabled={auditando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
              {auditando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {auditando ? "Auditando..." : "Auditar"}
            </button>
            <button onClick={async () => {
              const res = await authFetch("/api/admin/qualidade/export?format=csv");
              if (!res) return;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "qualidade-promessometro.csv";
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
              <Download className="w-3 h-3" /> CSV
            </button>
            <button onClick={fetchAll} disabled={carregando} className="p-1.5 hover:bg-white/5 rounded-xl transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${carregando ? "animate-spin" : ""}`} />
            </button>
            <button onClick={sair} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {erro && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
          </div>
        )}

        {/* ── Métricas do Sistema */}
        {systemStatus && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard icon={Users} label="Políticos" value={systemStatus.politicians} color="cyan" />
            <MetricCard icon={FileText} label="Promessas" value={systemStatus.promises} color="purple" />
            <MetricCard icon={CheckCircle} label="Avaliadas" value={`${systemStatus.coverage}%`} sub={`${systemStatus.evaluated} total`} color="green" />
            <MetricCard icon={AlertTriangle} label="Sem avaliação" value={systemStatus.never_evaluated} color="yellow" />
            <MetricCard icon={Clock} label="Herança auto" value={systemStatus.heranca_automatica} sub="precisam de IA" color="red" />
            <MetricCard icon={Activity} label="Último cron" value={systemStatus.last_cron ? `${systemStatus.last_cron.hours_ago}h atrás` : "—"} sub={systemStatus.last_cron?.status} color={systemStatus.last_cron?.status === "completed" ? "green" : "yellow"} />
          </div>
        )}

        {/* ── Sumário de Qualidade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-green-500/30 bg-green-500/5">
            <div className="text-2xl font-bold text-green-400">{verdes}</div>
            <div className="text-xs text-green-400/70 mt-1">🟢 Verde (&ge;85%)</div>
          </div>
          <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5">
            <div className="text-2xl font-bold text-yellow-400">{amarelos}</div>
            <div className="text-xs text-yellow-400/70 mt-1">🟡 Amarelo (70-84%)</div>
          </div>
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5">
            <div className="text-2xl font-bold text-red-400">{vermelhos}</div>
            <div className="text-xs text-red-400/70 mt-1">🔴 Vermelho (&lt;70%)</div>
          </div>
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="text-2xl font-bold text-white">{avgScore}%</div>
            <div className="text-xs text-gray-400 mt-1">⭐ Média geral</div>
          </div>
        </div>

        {/* ── FERRAMENTAS ──────────────────────────────────────────────────── */}

        {/* Pipeline & Reavaliação */}
        <Section title="🤖 Pipeline de Avaliação (Metodologia v1.1)" icon={Bot}>
          <div className="pt-4 space-y-4">
            <p className="text-xs text-gray-400">Dispare manualmente o processo de avaliação de promessas via IA. O cron roda automaticamente às 6h UTC.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-4 bg-black/30 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-semibold">Reavaliação Diária</span>
                </div>
                <p className="text-xs text-gray-400">Reavalia promessas stale (&gt;23h) usando IA + Serper. Agora extrai complexidade (C) e impacto (I) 1-3.</p>
                <button onClick={() => runPipeline("daily")} disabled={pipelineRunning}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50">
                  {pipelineRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Disparar Reavaliação
                </button>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold">Upgrade de Heranças</span>
                </div>
                <p className="text-xs text-gray-400">Converte avaliações com herança automática (batch-heranca, seed_initial) para avaliação real pela IA. Processa 20 por vez.</p>
                <div className="flex flex-col gap-2">
                  <button onClick={upgradeEvaluations} disabled={upgrading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                    {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {upgrading ? "Convertendo..." : `Upgrade (${systemStatus?.heranca_automatica || "?"} pendentes)`}
                  </button>
                  {toolResults.upgrade && (
                    <div className="text-xs p-2 bg-white/5 rounded-lg text-gray-300">
                      ✅ Convertidas: {toolResults.upgrade.upgraded} | ❌ Erros: {toolResults.upgrade.errors} | Restantes: {toolResults.upgrade.remaining}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 bg-black/30 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-neon-cyan" />
                  <span className="text-sm font-semibold">Recalcular Legado (todos)</span>
                </div>
                <p className="text-xs text-gray-400">Recalcula o Legado Histórico (Σ 2^(C+I)) para TODOS os políticos de uma vez. Necessário após alterar C/I das promessas.</p>
                <button onClick={recalculateAllLegacy} disabled={recalculatingAll}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 transition-colors disabled:opacity-50">
                  {recalculatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                  {recalculatingAll ? `Recalculando (${politicians.length} políticos)...` : `Recalcular Legado (${politicians.length})`}
                </button>
                {toolResults.recalculate_all && (
                  <div className="text-xs p-2 bg-white/5 rounded-lg text-gray-300 max-h-40 overflow-y-auto">
                    <div className="font-bold text-neon-cyan mb-1">✅ {toolResults.recalculate_all.ok}/{toolResults.recalculate_all.total} recalculados ({toolResults.recalculate_all.errors} erros)</div>
                    {toolResults.recalculate_all.details.slice(0, 20).map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 py-0.5 border-b border-white/5 last:border-0">
                        <span className="text-gray-400">{d.name}</span>
                        {d.legacy != null && <span className="text-neon-cyan font-bold">Legado: {Math.round(d.legacy)}</span>}
                        {d.error && <span className="text-red-400">Erro: {d.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {toolResults.pipeline && (
              <div className={`text-xs p-3 rounded-xl border ${toolResults.pipeline.success ? "bg-green-500/5 border-green-500/20 text-green-300" : "bg-red-500/5 border-red-500/20 text-red-300"}`}>
                {toolResults.pipeline.success ? "✅" : "❌"} {toolResults.pipeline.message}
              </div>
            )}
            {toolResults.auditoria && (
              <div className="text-xs p-3 bg-white/5 rounded-xl border border-white/10 text-gray-300">
                📊 Auditoria — Políticos: {toolResults.auditoria.politicians_checked} | Issues: {toolResults.auditoria.total_issues} | Corrigidos: {toolResults.auditoria.fixed} | Pulados: {toolResults.auditoria.skipped_human_reviewed}
              </div>
            )}
          </div>
        </Section>

        {/* ── Adicionar Candidato (Cidade) ───────────────────────────────────── */}
        <Section title="➕ Adicionar Candidato (Cidade)" icon={UserCheck}>
          <div className="pt-4 space-y-3">
            <p className="text-xs text-gray-400">
              Adiciona um novo político (prefeito de cidade) ao sistema. Se não informar URL do PDF, o sistema busca automaticamente.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nome *</label>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estado (UF) *</label>
                <input value={novoEstado} onChange={e => setNovoEstado(e.target.value.toUpperCase())}
                  placeholder="Ex: SP" maxLength={2}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cidade</label>
                <input value={novaCidade} onChange={e => setNovaCidade(e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Partido</label>
                <input value={novoPartido} onChange={e => setNovoPartido(e.target.value)}
                  placeholder="Ex: PT"
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cargo</label>
                <select value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan/50">
                  <option value="Prefeito">Prefeito</option>
                  <option value="Governador">Governador</option>
                  <option value="Vereador">Vereador</option>
                  <option value="Deputado Estadual">Deputado Estadual</option>
                  <option value="Deputado Federal">Deputado Federal</option>
                  <option value="Senador">Senador</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">URL do PDF (opcional)</label>
                <input value={novoPdfUrl} onChange={e => setNovoPdfUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50" />
              </div>
            </div>
            <button onClick={adicionarPolitico} disabled={adicionando}
              className="flex items-center gap-2 px-4 py-2.5 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl text-neon-cyan hover:bg-neon-cyan/20 transition-colors disabled:opacity-50 text-sm font-medium">
              {adicionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {adicionando ? "Buscando PDF..." : "Baixar PDF + Criar Político"}
            </button>
            {resultadoAdd && (
              <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl text-xs text-green-300 space-y-1">
                <div>✅ <span className="text-white font-medium">{resultadoAdd.politician.name}</span> criado ({resultadoAdd.politician.state}{resultadoAdd.politician.city ? ` · ${resultadoAdd.politician.city}` : ''})</div>
                {resultadoAdd.pdf.source_url && <div>📄 Fonte: <a href={resultadoAdd.pdf.source_url} target="_blank" className="text-neon-cyan underline">{resultadoAdd.pdf.source_url.slice(0, 60)}…</a></div>}
                {resultadoAdd.pdf.storage_url && <div>💾 PDF salvo em: <a href={resultadoAdd.pdf.storage_url} target="_blank" className="text-neon-cyan underline">storage/{resultadoAdd.pdf.filename || 'visualizar'}</a></div>}
              </div>
            )}
          </div>
        </Section>

        {/* Busca de Promessas */}
        <Section title="🔍 Buscar Promessas de Político" icon={Search}>
          <div className="pt-4 space-y-4">
            <p className="text-xs text-gray-400">Busca promessas de um político via Serper.dev + Groq. Use "Dry Run" para pré-visualizar antes de inserir.</p>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar político..."
                value={searchPol}
                onChange={e => setSearchPol(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50"
              />
              {filteredPols.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-card border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl">
                  {filteredPols.map(pol => {
                    const result = toolResults[`promises_${pol.id}`];
                    const isLoading = findingPromises === pol.id;
                    return (
                      <div key={pol.id} className="p-3 border-b border-white/5 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-white">{pol.name}</div>
                            <div className="text-xs text-gray-500">{pol.role} · {pol.state} · {pol.party}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => findPromises(pol, true)} disabled={isLoading}
                              className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Dry run"}
                            </button>
                            <button onClick={() => findPromises(pol, false)} disabled={isLoading}
                              className="px-2 py-1 text-xs bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan/20 transition-colors disabled:opacity-50">
                              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Importar"}
                            </button>
                          </div>
                        </div>
                        {result && (
                          <div className="mt-2 p-2 bg-white/5 rounded-lg text-xs text-gray-300">
                            {result.dry_run
                              ? `🔍 Encontradas: ${result.discovered} promessas (dry run)`
                              : `✅ Inseridas: ${result.inserted} | Duplicatas: ${result.duplicates} | Snippets: ${result.total_snippets}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Indicadores */}
        <Section title="📊 Seed de Indicadores (C2)" icon={Database}>
          <div className="pt-4 space-y-3">
            <p className="text-xs text-gray-400">
              Popula os 9 indicadores (segurança, finanças, funcionalismo) para um político via Serper + Groq.
              Necessário para calcular C2 e a nota final da metodologia.
            </p>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar político para seedar indicadores..."
                value={searchPol}
                onChange={e => setSearchPol(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan/50"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {politicians
                .filter(p => p.name.toLowerCase().includes(searchPol.toLowerCase()))
                .slice(0, 12)
                .map(pol => {
                  const qualData = dados.find(d => d.nome === pol.name);
                  const hasIndicators = qualData && qualData.stats.total_indicators > 0;
                  const result = toolResults[`indicators_${pol.id}`];
                  const isLoading = seedingIndicators === pol.id;
                  return (
                    <div key={pol.id} className="flex items-center justify-between gap-3 p-3 bg-black/20 border border-white/5 rounded-xl">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{pol.name}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{pol.role} · {pol.state}</span>
                          {hasIndicators
                            ? <span className="text-green-400">✓ {qualData.stats.total_indicators} indicadores</span>
                            : <span className="text-yellow-400">⚠ Sem indicadores</span>}
                        </div>
                        {result && (
                          <div className="text-xs text-cyan-400 mt-1">✅ Inseridos: {result.inserted}/{result.total}</div>
                        )}
                      </div>
                      <button onClick={() => seedIndicators(pol)} disabled={isLoading}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors disabled:opacity-50 ${hasIndicators ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" : "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20"}`}>
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                        {isLoading ? "Seedando..." : hasIndicators ? "Re-seed" : "Seed"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </Section>

        {/* ── Lista de Qualidade ────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Qualidade por Político</h2>
          {carregando && <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-gray-500 animate-spin" /></div>}
          {!carregando && dados.length === 0 && <div className="text-center py-12 text-gray-500">Nenhum político encontrado</div>}
          {dados.map(p => {
            const isExpanded = expanded === p.id;
            const borderColor = p.status === "verde" ? "border-green-500/30 bg-green-500/5" : p.status === "amarelo" ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/20 bg-red-500/5";
            return (
              <div key={p.id} className={`rounded-2xl border ${borderColor} overflow-hidden`}>
                <div className="w-full p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${p.status === "verde" ? "bg-green-500/20" : p.status === "amarelo" ? "bg-yellow-500/20" : "bg-red-500/20"}`}>
                    {p.status === "verde" ? <CheckCircle className="w-4 h-4 text-green-400" /> : p.status === "amarelo" ? <AlertTriangle className="w-4 h-4 text-yellow-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <button onClick={() => setExpanded(isExpanded ? null : p.id)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{p.nome}</span>
                      <StatusBadge status={p.status} label={p.status.toUpperCase()} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.stats.ok}/{p.stats.total_criterios} critérios · {p.stats.falhos} falha(s) · {p.stats.total_promises} promessas · {p.stats.total_indicators} indicadores
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => navigate(`/admin/politico/${p.id}`)}
                      className="text-xs text-neon-cyan hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                      Detalhes
                    </button>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.status === "verde" ? "bg-green-400" : p.status === "amarelo" ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: p.score_qualidade + "%" }} />
                        </div>
                        <span className={`text-sm font-bold ${p.status === "verde" ? "text-green-400" : p.status === "amarelo" ? "text-yellow-400" : "text-red-400"}`}>{p.score_qualidade}%</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                    {["A", "B", "C", "D", "E"].map(bloco => {
                      const falhas = p.criterios_falhos.filter(f => f.id.startsWith(bloco));
                      const okCount = p.criterios_ok.filter(id => id.startsWith(bloco)).length;
                      const total = BLOCO_TOTALS[bloco] || 0;
                      const Icon = BLOCO_ICONS[bloco] || FileText;
                      const allOk = falhas.length === 0;
                      return (
                        <div key={bloco} className="p-3 bg-black/30 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-3.5 h-3.5 ${allOk ? "text-green-400" : "text-gray-400"}`} />
                              <span className="text-xs font-bold text-gray-300">{BLOCO_LABELS[bloco]}</span>
                            </div>
                            <span className={`text-xs font-bold ${allOk ? "text-green-400" : "text-red-400"}`}>{okCount}/{total}</span>
                          </div>
                          {falhas.map(f => (
                            <div key={f.id} className="flex items-start gap-1.5 px-2 py-1.5 bg-red-500/5 rounded-lg mb-1">
                              <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                              <div className="text-xs text-red-300"><span className="font-bold text-red-400">{f.id}</span> — {f.descricao}</div>
                            </div>
                          ))}
                          {allOk && (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-green-500/5 rounded-lg">
                              <CheckCircle className="w-3 h-3 text-green-400" />
                              <span className="text-xs text-green-300">Todos os critérios OK</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Ferramentas rápidas inline */}
                    {(() => {
                      const pol = politicians.find(p2 => p2.name === p.nome);
                      if (!pol) return null;
                      const falhasSet = new Set(p.criterios_falhos.map(f => f.id));
                      const needsIndicators = p.stats.total_indicators === 0 || falhasSet.has("C1") || falhasSet.has("C2");
                      const needsPromises = p.stats.total_promises < 10 || falhasSet.has("B1");
                      const needsDiscovery = p.stats.total_promises < 20;
                      const needsCadastro = ["A1","A2","A3","A4","A5"].some(id => falhasSet.has(id));
                      const needsExplanations = ["B4","B5","B6","B7","B8","B9","B10","B11","B12","B13"].some(id => falhasSet.has(id));
                      const needsLegalFacts = (p.stats.total_legal_facts === 0) || ["D1","D2","D3","D4","D5"].some(id => falhasSet.has(id));
                      const needsRecalculate = ["B14","C3","D1","E1","E2","E3"].some(id => falhasSet.has(id));

                      const qualquer = needsIndicators || needsPromises || needsCadastro || needsExplanations || needsLegalFacts || needsRecalculate || needsDiscovery;
                      if (!qualquer) return null;
                      return (
                        <div className="mt-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                          <div className="text-xs font-bold text-yellow-400 mb-2">⚡ Ações rápidas — IA Corretiva</div>
                          <div className="flex flex-wrap gap-2">
                            {needsCadastro && (
                              <button onClick={() => fixCadastro(pol)} disabled={fixingCadastro === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-500/10 border border-gray-500/30 rounded-lg text-gray-300 hover:bg-gray-500/20 transition-colors disabled:opacity-50">
                                {fixingCadastro === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                Corrigir Cadastro
                              </button>
                            )}
                            {needsExplanations && (
                              <button onClick={() => fixExplanations(pol)} disabled={fixingExplanations === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50">
                                {fixingExplanations === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                Corrigir Avaliações
                              </button>
                            )}
                            {needsIndicators && (
                              <button onClick={() => seedIndicators(pol)} disabled={seedingIndicators === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan/20 transition-colors disabled:opacity-50">
                                {seedingIndicators === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                                Seed Indicadores
                              </button>
                            )}
                            {needsPromises && (
                              <button onClick={() => findPromises(pol, false)} disabled={findingPromises === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
                                {findingPromises === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                Buscar Promessas
                              </button>
                            )}
                            {needsDiscovery && (
                              <button onClick={() => startDiscovery(pol)} disabled={discoveringJob === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                                {discoveringJob === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />}
                                Descobrir via Plano de Governo
                              </button>
                            )}
                            {needsLegalFacts && (
                              <button onClick={() => seedLegalFacts(pol)} disabled={seedingLegalFacts === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                                {seedingLegalFacts === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scale className="w-3 h-3" />}
                                Seed Fatos Jurídicos
                              </button>
                            )}
                            {needsRecalculate && (
                              <button onClick={() => recalculateScores(pol)} disabled={recalculatingScores === pol.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                                {recalculatingScores === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SlidersHorizontal className="w-3 h-3" />}
                                Recalcular Notas
                              </button>
                            )}
                            <button onClick={() => loadPromisesCi(pol)} disabled={loadingCi === pol.id}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                              {loadingCi === pol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
                              {promisesCiData[pol.id] ? "Fechar C/I" : "Ver C/I"}
                            </button>
                          </div>
                          {promisesCiData[pol.id] && (
                            <div className="mt-2 p-2 bg-cyan-500/5 border border-cyan-500/20 rounded-lg max-h-48 overflow-y-auto">
                              <div className="text-xs font-bold text-cyan-300 mb-1">📊 Promessas — Complexidade (C) e Impacto (I)</div>
                              <div className="space-y-0.5">
                                {promisesCiData[pol.id].map((p: any) => (
                                  <div key={p.id} className="flex items-center gap-2 text-xs py-0.5 border-b border-white/5 last:border-0">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'cumprida' ? 'bg-green-400' : p.status === 'parcial' ? 'bg-yellow-400' : p.status === 'quebrada' ? 'bg-red-400' : 'bg-gray-500'}`} />
                                    <span className="text-gray-300 flex-1 truncate">{p.title}</span>
                                    <span className="text-gray-500 shrink-0">C:{p.complexity}</span>
                                    <span className="text-gray-500 shrink-0">I:{p.impact}</span>
                                    <span className={`text-[10px] px-1 rounded shrink-0 ${p.complexity + p.impact >= 5 ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-600'}`}>
                                      2<sup>{p.complexity + p.impact}</sup>=<strong>{Math.pow(2, p.complexity + p.impact)}</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {toolResults[`fix_explanations_${pol.id}`] && (
                            <div className="text-xs text-orange-400 mt-2">
                              ✅ {toolResults[`fix_explanations_${pol.id}`].created > 0 ? `${toolResults[`fix_explanations_${pol.id}`].created} criadas, ` : ''}
                              {toolResults[`fix_explanations_${pol.id}`].fixed} corrigidas
                              {toolResults[`fix_explanations_${pol.id}`].total === 0 && toolResults[`fix_explanations_${pol.id}`].created === 0 ? ' (sem avaliações para processar)' : ''}
                              {toolResults[`fix_explanations_${pol.id}`].debug && (
                                <span className="text-gray-600"> [promessas:{toolResults[`fix_explanations_${pol.id}`].debug.promises_count} explicadas:{toolResults[`fix_explanations_${pol.id}`].debug.explained_count} groq:{toolResults[`fix_explanations_${pol.id}`].debug.has_groq ? 'sim' : 'nao'}]</span>
                              )}
                            </div>
                          )}
                          {toolResults[`fix_cadastro_${pol.id}`] && (
                            <div className="text-xs text-gray-300 mt-1">✅ Cadastro: {toolResults[`fix_cadastro_${pol.id}`].fixed} campo(s) atualizado(s)</div>
                          )}
                          {toolResults[`indicators_${pol.id}`] && (
                            <div className="text-xs text-cyan-400 mt-1">✅ Indicadores: {toolResults[`indicators_${pol.id}`].inserted} inseridos</div>
                          )}
                          {toolResults[`promises_${pol.id}`] && (
                            <div className="text-xs text-purple-400 mt-1">✅ Promessas: {toolResults[`promises_${pol.id}`].inserted} inseridas</div>
                          )}
                          {discoveryStatus[pol.id] && (
                            <div className="mt-2 space-y-1">
                              <div className="text-xs text-blue-400">
                                {discoveryStatus[pol.id].status === "completed"
                                  ? `✅ Plano de Governo: ${discoveryStatus[pol.id].total_inseridas || 0} promessas inseridas (${discoveryStatus[pol.id].total_extraidas || 0} extraídas)`
                                  : discoveryStatus[pol.id].status === "error"
                                  ? `❌ Erro: ${discoveryStatus[pol.id].erro || "falha desconhecida"}`
                                  : `⏳ ${discoveryStatus[pol.id].message || "Descobrindo..."}`
                                }
                              </div>
                              {/* Progress bar */}
                              {discoveryStatus[pol.id].status !== "completed" && discoveryStatus[pol.id].total_pages > 0 && (
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-400 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.round((discoveryStatus[pol.id].current_page / discoveryStatus[pol.id].total_pages) * 100)}%` }} />
                                </div>
                              )}
                              {/* Live feed of last extracted promises */}
                              {discoveryLivePromises[pol.id] && discoveryLivePromises[pol.id].length > 0 && (
                                <div className="mt-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                                  <div className="text-xs font-bold text-blue-300 mb-1.5">📋 Últimas promessas extraídas:</div>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {discoveryLivePromises[pol.id].map((p: any, i: number) => (
                                      <div key={i} className="text-xs text-gray-300 flex items-start gap-1.5 py-0.5 border-b border-white/5 last:border-0">
                                        <span className="text-blue-400 shrink-0">{i + 1}.</span>
                                        <div>
                                          <span className="text-white">{p.titulo}</span>
                                          {p.categoria && <span className="ml-1 text-gray-500">· {p.categoria}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {toolResults[`legal_facts_${pol.id}`] && (
                            <div className="text-xs text-red-400 mt-1">✅ Fatos Jurídicos: {toolResults[`legal_facts_${pol.id}`].inserted} inseridos{toolResults[`legal_facts_${pol.id}`].scores ? ` | C1=${toolResults[`legal_facts_${pol.id}`].scores.c1} C2=${toolResults[`legal_facts_${pol.id}`].scores.c2} C3=${toolResults[`legal_facts_${pol.id}`].scores.c3} Final=${toolResults[`legal_facts_${pol.id}`].scores.final_score} Grade=${toolResults[`legal_facts_${pol.id}`].scores.grade}` : ''}</div>
                          )}
                          {toolResults[`scores_${pol.id}`] && (
                            <div className="text-xs text-green-400 mt-1">✅ Notas recalculadas: C1={toolResults[`scores_${pol.id}`].scores?.c1} C2={toolResults[`scores_${pol.id}`].scores?.c2} C3={toolResults[`scores_${pol.id}`].scores?.c3} Final={toolResults[`scores_${pol.id}`].scores?.final_score} Grade={toolResults[`scores_${pol.id}`].scores?.grade} Legado={Math.round(toolResults[`scores_${pol.id}`].scores?.legacy_score || 0)}</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
