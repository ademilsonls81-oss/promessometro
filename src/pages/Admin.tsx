import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, RefreshCw, ChevronRight, CheckCircle, XCircle, AlertTriangle, BarChart3, FileText, Gavel, Users, Star, Download, Play, Github } from "lucide-react";
import { Button } from "../components/ui";

interface CriterioFalha { id: string; descricao: string }
interface PoliticoQualidade {
  id: string; nome: string; status: string; score_qualidade: number;
  criterios_ok: string[]; criterios_falhos: CriterioFalha[];
  stats: { total_criterios: number; ok: number; falhos: number }
}

const BLOCO_LABELS: Record<string, string> = {
  A: "Dados Cadastrais", B: "Promessas (C1)", C: "Indicadores (C2)",
  D: "Fatos Jurídicos (C3)", E: "Nota Final"
};
const BLOCO_ICONS: Record<string, any> = { A: Users, B: FileText, C: BarChart3, D: Gavel, E: Star };
const BLOCO_COLORS: Record<string, string> = {
  A: "border-gray-500/30 text-gray-400", B: "border-green-500/30 text-green-400",
  C: "border-blue-500/30 text-blue-400", D: "border-red-500/30 text-red-400",
  E: "border-cyan-500/30 text-cyan-400"
};

function getSenha() {
  return new URLSearchParams(window.location.search).get("password") || localStorage.getItem("admin_token") || "";
}

export default function Admin() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState(getSenha());
  const [autenticado, setAutenticado] = useState(false);
  const [dados, setDados] = useState<PoliticoQualidade[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [auditando, setAuditando] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", "/admin");
      loginGithub(code);
    } else if (senha) {
      localStorage.setItem("admin_token", senha);
      fetchDados();
    }
  }, [senha]);

  async function fetchDados() {
    setCarregando(true); setErro("");
    try {
      const res = await fetch("/api/admin/qualidade?password=" + encodeURIComponent(senha));
      if (res.status === 401) { setAutenticado(false); localStorage.removeItem("admin_token"); setErro("Senha inválida"); return; }
      const json = await res.json();
      setDados(json.politicos || []);
      setAutenticado(true);
    } catch (e: any) { setErro(e.message); }
    setCarregando(false);
  }

  async function loginGithub(code: string) {
    setCarregando(true); setErro("");
    try {
      const res = await fetch("/api/admin/auth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (res.status === 401) { setErro("Email não autorizado"); setCarregando(false); return; }
      if (!res.ok) { setErro("Erro na autenticação"); setCarregando(false); return; }
      const json = await res.json();
      setSenha(json.token);
      localStorage.setItem("admin_token", json.token);
      fetchDados();
    } catch (e: any) { setErro(e.message); setCarregando(false); }
  }

  async function rodarAuditoria() {
    setAuditando(true); setErro("");
    try {
      const res = await fetch("/api/admin/qualidade/run?password=" + encodeURIComponent(senha), { method: "POST" });
      if (res.status === 401) { setErro("Não autorizado"); return; }
      const json = await res.json();
      alert(`Auditoria concluída!\n\nVerificados: ${json.audit?.politicians_checked || 0} políticos\nIssues encontradas: ${json.audit?.total_issues || 0}\nCorrigidos automaticamente: ${json.audit?.fixed || 0}\nPulados (revisão humana): ${json.audit?.skipped_human_reviewed || 0}`);
      fetchDados();
    } catch (e: any) { setErro(e.message); }
    setAuditando(false);
  }

  function sair() { localStorage.removeItem("admin_token"); setAutenticado(false); setSenha(""); setDados([]); navigate("/"); }

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 bg-dark-card border border-white/10 rounded-3xl text-center">
          <ShieldCheck className="w-12 h-12 text-neon-cyan mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin</h1>
          <p className="text-sm text-gray-500 mb-6">Promessômetro — Painel de Qualidade</p>
          <button onClick={() => {
            const redirectUri = window.location.origin + "/admin";
            const githubUrl = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_ID || ''}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email`;
            window.location.href = githubUrl;
          }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-medium hover:bg-white/20 transition-colors mb-6">
            <Github className="w-5 h-5" /> Entrar com GitHub
          </button>
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center"><span className="px-3 bg-dark-card text-xs text-gray-500">ou senha</span></div>
          </div>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
            placeholder="Senha de administrador" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white text-center mb-4 focus:outline-none focus:border-neon-cyan" />
          <Button variant="primary" onClick={fetchDados} disabled={!senha} className="w-full">Acessar</Button>
          {erro && <p className="text-red-400 text-xs mt-3">{erro}</p>}
        </div>
      </div>
    );
  }

  const verdes = dados.filter(d => d.status === "verde").length;
  const vermelhos = dados.filter(d => d.status === "vermelho").length;

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="sticky top-0 z-50 bg-dark-card/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-neon-cyan" />
            <h1 className="text-lg font-bold">Admin</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={rodarAuditoria} disabled={auditando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
              <Play className={`w-3.5 h-3.5 ${auditando ? "animate-pulse" : ""}`} />
              {auditando ? "Auditando..." : "Auditar"}
            </button>
            <a href={`/api/admin/qualidade/export?password=${encodeURIComponent(senha)}&format=csv`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              target="_blank" rel="noreferrer">
              <Download className="w-3.5 h-3.5" /> CSV
            </a>
            <button onClick={fetchDados} disabled={carregando} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${carregando ? "animate-spin" : ""}`} />
            </button>
            <button onClick={sair} className="flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm font-bold text-green-400">{verdes} político(s) verde</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400">{vermelhos} político(s) vermelho</span>
          </div>
          <div className="text-xs text-gray-500">Referência: Cláudio Castro (100%)</div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>
        {carregando && <div className="text-center py-12"><RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto" /></div>}
        {!carregando && dados.length === 0 && (<div className="text-center py-12 text-gray-500">Nenhum político encontrado</div>)}
        <div className="space-y-3">
          {dados.map(p => {
            const isExpanded = expanded === p.id;
            return (
              <div key={p.id} className={`rounded-2xl border ${p.status === "verde" ? "border-green-500/30 bg-green-500/5" : "border-red-500/20 bg-red-500/5"} overflow-hidden transition-all`}>
                <div className="w-full p-4 md:p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.status === "verde" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    {p.status === "verde" ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                  </div>
                  <button onClick={() => setExpanded(isExpanded ? null : p.id)} className="flex-1 min-w-0 text-left hover:bg-white/5 rounded-lg -mx-2 px-2 py-1 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{p.nome}</span>
                      {p.nome === "Cláudio Castro" && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">REFERÊNCIA</span>}
                    </div>
                    <div className="text-xs text-gray-500">{p.stats.ok}/{p.stats.total_criterios} critérios · {p.stats.falhos} falha(s)</div>
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => navigate(`/admin/politico/${p.id}`)}
                      className="text-xs text-neon-cyan hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                      Detalhes
                    </button>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.status === "verde" ? "bg-green-400" : "bg-red-400"}`} style={{ width: p.score_qualidade + "%" }} />
                        </div>
                        <span className={`text-sm font-bold ${p.status === "verde" ? "text-green-400" : "text-red-400"}`}>{p.score_qualidade}%</span>
                      </div>
                      <span className={`text-xs font-bold ${p.status === "verde" ? "text-green-400" : "text-red-400"}`}>{p.status === "verde" ? "VERDE" : "VERMELHO"}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 md:px-5 pb-5 space-y-4">
                    {["A", "B", "C", "D", "E"].map(bloco => {
                      const falhas = p.criterios_falhos.filter(f => f.id.startsWith(bloco));
                      const Icon = BLOCO_ICONS[bloco] || FileText;
                      return (
                        <div key={bloco} className="p-4 bg-black/30 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${(BLOCO_COLORS[bloco] || "").split(" ")[1] || "text-gray-400"}`} />
                              <span className="text-sm font-bold text-gray-300">{BLOCO_LABELS[bloco] || "Bloco " + bloco}</span>
                            </div>
                            <span className={`text-xs font-bold ${falhas.length === 0 ? "text-green-400" : "text-red-400"}`}>
                              {falhas.length === 0 ? "OK" : falhas.length + " falha(s)"}
                            </span>
                          </div>
                          {falhas.map(f => (
                            <div key={f.id} className="flex items-start gap-2 px-3 py-2 bg-red-500/5 rounded-lg mb-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                              <div className="text-xs text-red-300"><span className="font-bold text-red-400">{f.id}</span> — {f.descricao}</div>
                            </div>
                          ))}
                          {falhas.length === 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 rounded-lg">
                              <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                              <span className="text-xs text-green-300">Todos os critérios OK</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
