import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, ArrowLeft, CheckCircle, XCircle, AlertTriangle, BarChart3, FileText, Gavel, Users, Star, Download, RefreshCw } from "lucide-react";

interface CriterioFalha { id: string; descricao: string }
interface PoliticoQualidade {
  id: string; nome: string; status: string; score_qualidade: number;
  criterios_ok: string[]; criterios_falhos: CriterioFalha[];
  stats: { total_criterios: number; ok: number; falhos: number }
}

function getToken() {
  return localStorage.getItem("admin_token") || "";
}

async function authFetch(url: string, options: Record<string, any> = {}) {
  const token = getToken();
  const headers = { ...options.headers, Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) { localStorage.removeItem("admin_token"); window.location.href = "/admin"; return null; }
  return res;
}

const ALL_CRITERIA_META: { id: string; bloco: string; descricao: string }[] = [
  { id: 'A1', bloco: 'A', descricao: 'Nome completo preenchido' },
  { id: 'A2', bloco: 'A', descricao: 'Cargo preenchido e válido' },
  { id: 'A3', bloco: 'A', descricao: 'Estado/região preenchido' },
  { id: 'A4', bloco: 'A', descricao: 'Partido preenchido' },
  { id: 'A5', bloco: 'A', descricao: 'Foto cadastrada e acessível' },
  { id: 'A6', bloco: 'A', descricao: 'Tem classificação de verificado' },
  { id: 'B1', bloco: 'B', descricao: 'Mínimo 5 promessas cadastradas' },
  { id: 'B2', bloco: 'B', descricao: 'Nenhuma promessa com status nulo' },
  { id: 'B3', bloco: 'B', descricao: 'Nenhuma promessa com score nulo' },
  { id: 'B4', bloco: 'B', descricao: 'Score compatível com status' },
  { id: 'B5', bloco: 'B', descricao: 'Motivo do Score preenchido (sem placeholder)' },
  { id: 'B6', bloco: 'B', descricao: 'O que foi concluído preenchido' },
  { id: 'B7', bloco: 'B', descricao: 'O que ainda falta preenchido' },
  { id: 'B8', bloco: 'B', descricao: 'Mínimo 2 evidências por promessa Cumprida' },
  { id: 'B9', bloco: 'B', descricao: 'Mínimo 2 evidências por promessa Parcial' },
  { id: 'B10', bloco: 'B', descricao: 'Mínimo 1 evidência por promessa Pendente' },
  { id: 'B11', bloco: 'B', descricao: 'Nenhuma evidência pode ser de rede social' },
  { id: 'B12', bloco: 'B', descricao: 'Domínios únicos por promessa' },
  { id: 'B13', bloco: 'B', descricao: 'Critério não é herança automática' },
  { id: 'B14', bloco: 'B', descricao: 'C1 calculado corretamente' },
  { id: 'C1', bloco: 'C', descricao: 'Todas as 3 categorias de indicadores populadas' },
  { id: 'C2', bloco: 'C', descricao: 'Todos os 9 indicadores com score' },
  { id: 'C3', bloco: 'C', descricao: 'C2 calculado corretamente' },
  { id: 'C4', bloco: 'C', descricao: 'Nenhum indicador com score suspeito (todos 50)' },
  { id: 'D1', bloco: 'D', descricao: 'C3 calculado corretamente' },
  { id: 'D2', bloco: 'D', descricao: 'Cada fato jurídico tem tipo válido' },
  { id: 'D3', bloco: 'D', descricao: 'Cada fato tem descrição' },
  { id: 'D4', bloco: 'D', descricao: 'Cada fato tem fonte' },
  { id: 'D5', bloco: 'D', descricao: 'Cada fato tem data' },
  { id: 'D6', bloco: 'D', descricao: 'C3 não é negativo' },
  { id: 'E1', bloco: 'E', descricao: 'Nota final calculada corretamente' },
  { id: 'E2', bloco: 'E', descricao: 'Grade correta para o score' },
  { id: 'E3', bloco: 'E', descricao: 'Se C3 < 20, nota máxima é C' },
];

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

export default function AdminDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [dado, setDado] = useState<PoliticoQualidade | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetchDado();
  }, [slug]);

  async function fetchDado() {
    setCarregando(true); setErro("");
    try {
      const res = await authFetch(`/api/admin/qualidade/${slug}`);
      if (!res) return;
      if (res.status === 404) { setErro("Político não encontrado"); setCarregando(false); return; }
      const json = await res.json();
      setDado(json.politico);
    } catch (e) { setErro(e.message); }  // any-ok
    setCarregando(false);
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (erro || !dado) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{erro || "Dados não encontrados"}</p>
          <button onClick={() => navigate("/admin")} className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-colors text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  const falhasSet = new Set(dado.criterios_falhos.map(f => f.id));
  const criteriosDetalhados = ALL_CRITERIA_META.map(c => ({
    ...c,
    passou: dado.criterios_ok.includes(c.id) || !falhasSet.has(c.id)
  }));

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="sticky top-0 z-50 bg-dark-card/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin")} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <ShieldCheck className="w-6 h-6 text-neon-cyan" />
            <h1 className="text-lg font-bold truncate max-w-[200px]">{dado.nome}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchDado} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl ${
            dado.status === "verde" ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
          }`}>
            {dado.status === "verde" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
            <span className={`text-sm font-bold ${dado.status === "verde" ? "text-green-400" : "text-red-400"}`}>
              {dado.status === "verde" ? "VERDE" : "VERMELHO"}
            </span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-sm text-gray-400">Score:</span>
            <span className={`text-sm font-bold ${dado.score_qualidade >= 80 ? "text-green-400" : dado.score_qualidade >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {dado.score_qualidade}%
            </span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-sm text-gray-400">{dado.stats.ok}/{dado.stats.total_criterios} critérios</span>
          </div>

          <button onClick={async () => {
            const res = await authFetch("/api/admin/qualidade/export?format=csv");
            if (!res) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "qualidade-promessometro.csv";
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }} className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>

        {["A", "B", "C", "D", "E"].map(bloco => {
          const blocoCriterios = criteriosDetalhados.filter(c => c.bloco === bloco);
          const falhas = dado.criterios_falhos.filter(f => f.id.startsWith(bloco));
          const Icon = BLOCO_ICONS[bloco] || FileText;
          const okCount = blocoCriterios.filter(c => c.passou).length;
          const totalCount = blocoCriterios.length;

          return (
            <div key={bloco} className="mb-6 p-5 bg-dark-card border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${(BLOCO_COLORS[bloco] || "").split(" ")[1] || "text-gray-400"}`} />
                  <div>
                    <span className="text-base font-bold text-white">{BLOCO_LABELS[bloco] || "Bloco " + bloco}</span>
                    <span className="text-xs text-gray-500 ml-3">{okCount}/{totalCount} critérios</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${falhas.length === 0 ? "bg-green-400" : okCount > totalCount / 2 ? "bg-yellow-400" : "bg-red-400"}`}
                      style={{ width: `${(okCount / totalCount) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${falhas.length === 0 ? "text-green-400" : "text-red-400"}`}>
                    {falhas.length === 0 ? "OK" : `${falhas.length} falha(s)`}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {blocoCriterios.map(c => {
                  const falha = dado.criterios_falhos.find(f => f.id === c.id);
                  return (
                    <div key={c.id} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg ${
                      c.passou ? "bg-green-500/5" : "bg-red-500/5"
                    }`}>
                      {c.passou
                        ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-xs font-bold ${c.passou ? "text-green-400" : "text-red-400"}`}>{c.id}</span>
                          <span className={`text-xs ${c.passou ? "text-gray-400" : "text-red-300"}`}>{c.descricao}</span>
                        </div>
                        {falha && (
                          <div className="text-[11px] text-red-400/70 mt-1">{falha.descricao}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
