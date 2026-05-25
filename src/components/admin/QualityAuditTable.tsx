import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, ChevronRight, FileText, Users, BarChart3, Gavel, Star, UserCheck, Search, Database, BookOpen, Scale, SlidersHorizontal, Award, Loader2 } from "lucide-react";

interface CriterioFalha { id: string; descricao: string }

interface PoliticoQualidadeStats {
  total_criterios: number;
  ok: number;
  falhos: number;
  total_promises: number;
  total_explanations: number;
  total_indicators: number;
  total_legal_facts: number;
}

export interface PoliticoQualidade {
  id: string;
  nome: string;
  status: string;
  score_qualidade: number;
  criterios_ok: string[];
  criterios_falhos: CriterioFalha[];
  stats: PoliticoQualidadeStats;
}

interface ToolState {
  fixingCadastro?: string | null;
  fixingExplanations?: string | null;
  seedingIndicators?: string | null;
  findingPromises?: string | null;
  discoveringJob?: string | null;
  seedingLegalFacts?: string | null;
  recalculatingScores?: string | null;
  loadingCi?: string | null;
}

interface MinimalPolitician {
  id: string;
  name: string;
  role: string;
  state: string;
  party: string;
  slug: string;
}

interface QualityAuditTableProps {
  dados: PoliticoQualidade[];
  carregando?: boolean;
  blocoLabels: Record<string, string>;
  blocoIcons: Record<string, React.ComponentType<{ className?: string }>>;
  blocoTotals: Record<string, number>;
  politicians: MinimalPolitician[];
  promisesCiData: Record<string, unknown[]>;
  toolState?: ToolState;
  toolResults?: Record<string, unknown>;
  discoveryStatus?: Record<string, { status: string; message?: string; current_page?: number; total_pages?: number; total_extraidas?: number; total_inseridas?: number; erro?: string }>;
  discoveryLivePromises?: Record<string, { titulo: string; categoria?: string }[]>;
  onDetalhes: (id: string) => void;
  onFixCadastro?: (pol: { id: string; name: string }) => void;
  onFixExplanations?: (pol: { id: string; name: string }) => void;
  onSeedIndicators?: (pol: { id: string; name: string; state: string; role: string }) => void;
  onFindPromises?: (pol: { id: string; name: string; role: string; state: string }) => void;
  onStartDiscovery?: (pol: { id: string; name: string; role: string; state: string; party: string }) => void;
  onSeedLegalFacts?: (pol: { id: string; name: string }) => void;
  onRecalculateScores?: (pol: { id: string; name: string }) => void;
  onLoadPromisesCi?: (pol: { id: string; slug: string }) => void;
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const colors: Record<string, string> = {
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

function ToolButton({ label, icon: Icon, loading, onClick, color = "gray" }: { label: string; icon: React.ComponentType<{ className?: string }>; loading?: boolean; onClick?: () => void; color?: string }) {
  const colorMap: Record<string, string> = {
    gray: "bg-gray-500/10 border-gray-500/30 text-gray-300 hover:bg-gray-500/20",
    orange: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20",
    cyan: "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20",
    red: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20",
    green: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
    cyan2: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20",
  };
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1 px-2.5 py-1 text-xs border rounded-lg transition-colors disabled:opacity-50 ${colorMap[color]}`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {loading ? `${label}...` : label}
    </button>
  );
}

export default function QualityAuditTable({
  dados, carregando, blocoLabels, blocoIcons, blocoTotals, politicians,
  promisesCiData, toolState = {}, toolResults = {},
  discoveryStatus = {}, discoveryLivePromises = {},
  onDetalhes,
  onFixCadastro, onFixExplanations, onSeedIndicators, onFindPromises,
  onStartDiscovery, onSeedLegalFacts, onRecalculateScores, onLoadPromisesCi
}: QualityAuditTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
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
                <button onClick={() => onDetalhes(p.id)}
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
                  const total = blocoTotals[bloco] || 0;
                  const Icon = blocoIcons[bloco] || FileText;
                  const allOk = falhas.length === 0;
                  return (
                    <div key={bloco} className="p-3 bg-black/30 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${allOk ? "text-green-400" : "text-gray-400"}`} />
                          <span className="text-xs font-bold text-gray-300">{blocoLabels[bloco]}</span>
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
                {(() => {
                  const pol = politicians.find(p2 => p2.name === p.nome);
                  if (!pol) return null;
                  const falhasSet = new Set(p.criterios_falhos.map(f => f.id));
                  const needsIndicators = p.stats.total_indicators === 0 || falhasSet.has("C1") || falhasSet.has("C2");
                  const needsPromises = p.stats.total_promises < 10 || falhasSet.has("B1");
                  const needsDiscovery = p.stats.total_promises < 20;
                  const needsCadastro = ["A1","A2","A3","A4","A5"].some(id => falhasSet.has(id));
                  const needsExplanations = ["B4","B5","B6","B7","B8","B9","B10","B11","B12","B13","B16"].some(id => falhasSet.has(id));
                  const needsLegalFacts = (p.stats.total_legal_facts === 0) || ["D1","D2","D3","D4","D5"].some(id => falhasSet.has(id));
                  const needsRecalculate = ["B14","B15","C3","D1","E1","E2","E3","E4","E5"].some(id => falhasSet.has(id));

                  const qualquer = needsIndicators || needsPromises || needsCadastro || needsExplanations || needsLegalFacts || needsRecalculate || needsDiscovery;
                  if (!qualquer) return null;
                  return (
                    <div className="mt-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                      <div className="text-xs font-bold text-yellow-400 mb-2">⚡ Ações rápidas — IA Corretiva</div>
                      <div className="flex flex-wrap gap-2">
                        {needsCadastro && (
                          <ToolButton label="Corrigir Cadastro" icon={UserCheck} loading={toolState.fixingCadastro === pol.id} onClick={() => onFixCadastro?.({ id: pol.id, name: pol.name })} color="gray" />
                        )}
                        {needsExplanations && (
                          <ToolButton label="Corrigir Avaliações" icon={FileText} loading={toolState.fixingExplanations === pol.id} onClick={() => onFixExplanations?.({ id: pol.id, name: pol.name })} color="orange" />
                        )}
                        {needsIndicators && (
                          <ToolButton label="Seed Indicadores" icon={Database} loading={toolState.seedingIndicators === pol.id} onClick={() => onSeedIndicators?.({ id: pol.id, name: pol.name, state: pol.state, role: pol.role })} color="cyan" />
                        )}
                        {needsPromises && (
                          <ToolButton label="Buscar Promessas" icon={Search} loading={toolState.findingPromises === pol.id} onClick={() => onFindPromises?.({ id: pol.id, name: pol.name, role: pol.role, state: pol.state })} color="purple" />
                        )}
                        {needsDiscovery && (
                          <ToolButton label="Descobrir via Plano de Governo" icon={BookOpen} loading={toolState.discoveringJob === pol.id} onClick={() => onStartDiscovery?.({ id: pol.id, name: pol.name, role: pol.role, state: pol.state, party: pol.party })} color="blue" />
                        )}
                        {needsLegalFacts && (
                          <ToolButton label="Seed Fatos Jurídicos" icon={Scale} loading={toolState.seedingLegalFacts === pol.id} onClick={() => onSeedLegalFacts?.({ id: pol.id, name: pol.name })} color="red" />
                        )}
                        {needsRecalculate && (
                          <ToolButton label="Recalcular Notas" icon={SlidersHorizontal} loading={toolState.recalculatingScores === pol.id} onClick={() => onRecalculateScores?.({ id: pol.id, name: pol.name })} color="green" />
                        )}
                        <ToolButton label={promisesCiData[pol.id] ? "Fechar C/I" : "Ver C/I"} icon={Award} loading={toolState.loadingCi === pol.id} onClick={() => onLoadPromisesCi?.({ id: pol.id, slug: pol.slug })} color="cyan2" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
