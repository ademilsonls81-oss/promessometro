import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, ArrowLeft, Scale, FileText, Brain,
  AlertTriangle, Shield, Users, Search, Loader2,
  Layers, Target, Gavel, Award, BarChart3
} from "lucide-react";
import { Link } from "react-router-dom";

const GRADE_CONFIG = {
  A: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  B: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  C: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  D: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  F: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" }
};

const GRADE_SCALE = [
  { grade: 'A', range: '80 – 100' },
  { grade: 'B', range: '60 – 79' },
  { grade: 'C', range: '40 – 59' },
  { grade: 'D', range: '20 – 39' },
  { grade: 'F', range: '0 – 19' }
];

export default function Metodologia() {
  const [methodology, setMethodology] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMethodology();
  }, []);

  async function fetchMethodology() {
    try {
      setLoading(true);
      const res = await fetch('/api/metodologia');
      if (!res.ok) throw new Error('Erro ao carregar metodologia');
      const data = await res.json();
      setMethodology(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const content = methodology?.content;
  const formula = content?.formula;
  const camada1 = content?.camada_1;
  const camada2 = content?.camada_2;
  const camada3 = content?.camada_3;
  const verification = content?.verification;
  const contestation = content?.contestation;

  if (loading) {
    return (
      <div className="min-h-screen pt-12 pb-24 px-4 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12 pb-24 px-4 bg-background">
      <div className="container mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <BookOpen className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Metodologia</h1>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Versão 1.1 · Publicada em 22/05/2026
          </p>
          <p className="text-gray-400 mb-12 leading-relaxed">
            O Promessômetro avalia políticos com base em três camadas independentes que compõem a nota do mandato,
            complementadas por um sistema de Legado Histórico que reconhece o volume e a consistência de entregas
            ao longo de múltiplos mandatos.
          </p>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-8 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-12">

            {/* Formula Summary */}
            <section className="p-6 bg-gradient-to-br from-neon-purple/10 to-neon-cyan/5 border border-white/10 rounded-2xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-neon-cyan" />
                Fórmula da Nota Final
              </h2>
              <p className="text-gray-500 text-sm mb-3">
                A nota final de cada mandato é calculada pela fórmula:
              </p>
              <div className="text-center py-4">
                <div className="text-2xl font-display font-bold text-neon-cyan mb-2">
                  {formula?.nota_final || "Nota_Final = (C1 × 0.40) + (C2 × 0.35) + (C3 × 0.25)"}
                </div>
                <div className="flex flex-wrap justify-center gap-6 mt-4 text-sm">
                  {GRADE_SCALE.map((g) => {
                    const cfg = GRADE_CONFIG[g.grade as keyof typeof GRADE_CONFIG] || GRADE_CONFIG.C;
                    return (
                      <div key={g.grade} className={`px-3 py-1.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                        <span className={`font-bold ${cfg.color}`}>{g.grade}</span>
                        <span className="text-gray-500 ml-1">{g.range}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Camada 1 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-green-500/20 rounded-xl">
                  <Target className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Camada 1 — {camada1?.name || 'Cumprimento de Promessas'}</h2>
                  <p className="text-gray-500 text-sm">Peso: 40% da nota final</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed mb-4">
                {camada1?.description || 'Avalia o percentual de promessas cumpridas e parcialmente cumpridas sobre o total de promessas verificáveis do mandato.'}
              </p>
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl mb-4">
                <code className="text-sm text-green-300">
                  {camada1?.calculation || 'C1 = (Cumpridas × 1.0 + Parciais × 0.5) / Total × 100'}
                </code>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { score: '1.0', label: 'Cumprida' },
                  { score: '0.5', label: 'Parcialmente' },
                  { score: '0.0', label: 'Pendente' },
                  { score: '0.0', label: 'Descumprida' }
                ].map((s, i) => (
                  <div key={i} className="p-3 bg-dark-card border border-white/5 rounded-xl text-center">
                    <div className="text-lg font-bold font-display">{s.score}</div>
                    <div className="text-xs text-gray-400">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Fontes de Promessas */}
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <h3 className="text-sm font-bold text-green-300 mb-2">Fontes de Promessas</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">P</span>
                    <div>
                      <strong className="text-gray-300">Primárias:</strong> Plano de Governo registrado no TSE (fonte legal obrigatória)
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">S</span>
                    <div>
                      <strong className="text-gray-300">Secundárias:</strong> Entrevistas, debates, lives — exigem registro em vídeo, áudio ou texto
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Camada 2 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-500/20 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Camada 2 — {camada2?.name || 'Indicadores Objetivos'}</h2>
                  <p className="text-gray-500 text-sm">Peso: 35% da nota final</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed mb-4">
                {camada2?.description || 'Avalia indicadores objetivos por categoria, definidos antes do início do mandato, com metas públicas e verificáveis.'}
              </p>
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl mb-4">
                <code className="text-sm text-blue-300">
                  {camada2?.calculation || 'C2 = Σ(indicador_score × peso) / Σ(pesos)'}
                </code>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Segurança', weight: 30, indicators: ['Taxa de homicídios', 'Policiamento', 'Investimento em segurança'] },
                  { name: 'Finanças', weight: 40, indicators: ['Receita corrente', 'Dívida pública', 'Investimento'] },
                  { name: 'Funcionalismo', weight: 30, indicators: ['Número de servidores', 'Gasto com folha', 'Concursos realizados'] }
                ].map((cat, i) => (
                  <div key={i} className="p-4 bg-dark-card border border-white/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold capitalize text-sm">{cat.name}</span>
                      <span className="text-xs text-gray-500">Peso: {cat.weight}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cat.indicators.map((ind, j) => (
                        <span key={j} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">{ind}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Camada 3 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-500/20 rounded-xl">
                  <Gavel className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Camada 3 — {camada3?.name || 'Fatos Jurídicos'}</h2>
                  <p className="text-gray-500 text-sm">Peso: 25% da nota final</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed mb-4">
                {camada3?.description || 'Avalia a integridade do político com base em condenações, investigações e ocorrências jurídicas.'}
              </p>
              <div className="p-4 bg-dark-card border border-white/5 rounded-xl mb-4">
                <p className="text-sm text-gray-300">
                  <strong>Score inicial:</strong> {camada3?.initial_score || 100} pontos.
                </p>
                <p className="text-sm text-yellow-400 mt-1">
                  ⚠ Se C3 &lt; 20, a nota máxima possível do mandato é C.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { points: 50, label: 'Condenação Transitada em Julgado' },
                  { points: 20, label: 'Investigação Formal' },
                  { points: 10, label: 'Alerta (irregularidade relevante)' },
                  { points: 5, label: 'Irregularidade Administrativa' }
                ].map((pen, i) => (
                  <div key={i} className="p-3 bg-dark-card border border-red-500/20 rounded-xl">
                    <div className="text-lg font-bold font-display text-red-400">-{pen.points}</div>
                    <div className="text-xs text-gray-400">{pen.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Score de Legado Histórico */}
            <section className="p-8 border-2 border-neon-cyan/30 rounded-3xl bg-gradient-to-br from-neon-cyan/5 to-transparent">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-neon-cyan/20 rounded-xl">
                  <Award className="w-5 h-5 text-neon-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Score de Legado Histórico</h2>
                  <p className="text-gray-500 text-sm">Reconhecimento de trajetória — não influencia a grade A-F do mandato</p>
                </div>
              </div>

              <p className="text-gray-400 leading-relaxed mb-4">
                O Score de Legado Histórico é uma dimensão separada da nota do mandato. Ele não influencia a grade A/B/C/D/F
                e não coloca políticos de múltiplos mandatos em vantagem competitiva sobre estreantes — seu propósito é
                registrar e reconhecer a trajetória histórica de cada político.
              </p>

              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl mb-4">
                <p className="text-sm text-gray-300 mb-2">
                  <strong className="text-neon-cyan">Cálculo por mandato:</strong>
                </p>
                <code className="text-sm text-neon-cyan">
                  Score_Mandato = (Cumpridas × 2<sup>(C+I)</sup>) + (Parciais × 0.5 × 2<sup>(C+I)</sup>)
                </code>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-dark-card border border-white/5 rounded-xl">
                  <h3 className="text-sm font-bold text-gray-300 mb-2">Complexidade (C) — 1 a 3</h3>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p><strong className="text-gray-400">1 — Simples:</strong> Declaração genérica, sem métrica ou prazo</p>
                    <p><strong className="text-gray-400">2 — Médio:</strong> Meta definida, com indicador mensurável</p>
                    <p><strong className="text-gray-400">3 — Complexo:</strong> Meta com métricas, prazos e impacto estruturante</p>
                  </div>
                </div>
                <div className="p-4 bg-dark-card border border-white/5 rounded-xl">
                  <h3 className="text-sm font-bold text-gray-300 mb-2">Impacto (I) — 1 a 3</h3>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p><strong className="text-gray-400">1 — Baixo:</strong> Localizado, afeta grupo restrito</p>
                    <p><strong className="text-gray-400">2 — Médio:</strong> Abrangente, afeta setor ou região</p>
                    <p><strong className="text-gray-400">3 — Alto:</strong> Estruturante, afeta toda a população</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl mb-4">
                <p className="text-sm text-gray-300 mb-2">
                  <strong className="text-neon-cyan">Legado Total:</strong>
                </p>
                <code className="text-sm text-neon-cyan">
                  Legado_Total = Σ Score_Mandato (todos os mandatos)
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  O Legado Total é cumulativo e nunca decresce — cada mandato adiciona pontos à história do político.
                </p>
              </div>

              <h3 className="font-bold text-white mb-3 text-sm">Exemplo Prático</h3>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Mandato</th>
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Cumpridas</th>
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Parciais</th>
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Total</th>
                      <th className="text-left py-2 text-neon-cyan font-medium">Score Mandato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { mandato: '2013–2016', cumpridas: 60, parciais: 20, total: 90, score: 79.0 },
                      { mandato: '2017–2020', cumpridas: 45, parciais: 10, total: 70, score: 57.0 },
                      { mandato: '2021–2024', cumpridas: 80, parciais: 15, total: 100, score: 97.5 }
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-gray-300">{row.mandato}</td>
                        <td className="py-2 pr-4 text-gray-400">{row.cumpridas}</td>
                        <td className="py-2 pr-4 text-gray-400">{row.parciais}</td>
                        <td className="py-2 pr-4 text-gray-400">{row.total}</td>
                        <td className="py-2 text-neon-cyan font-bold">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-neon-cyan/30">
                      <td className="py-2 pr-4 font-bold text-gray-300">Legado Total</td>
                      <td colSpan={3}></td>
                      <td className="py-2 text-neon-cyan font-bold text-lg">233.5 pts</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <h3 className="font-bold text-white mb-3 text-sm">Como aparece na interface</h3>
              <div className="p-4 bg-dark-card border border-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 flex items-center justify-center text-neon-cyan font-bold text-sm">JS</div>
                  <div>
                    <p className="text-sm text-gray-300 font-medium">João da Silva</p>
                    <p className="text-xs text-gray-500">Nota do Mandato: <span className="text-green-400 font-bold">A (87)</span> · Prefeito 2021–2024</p>
                    <div className="w-full h-px bg-white/5 my-1.5" />
                    <p className="text-xs text-neon-cyan flex items-center gap-1">
                      <Award className="w-3 h-3" /> Legado Histórico: <strong>233.5 pts</strong> · 3 mandatos · desde 2013
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Verification */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-neon-cyan" />
                Verificação de Evidências
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                {verification?.description || 'Toda promessa requer no mínimo 2 fontes independentes para ser classificada.'}
              </p>
              <div className="space-y-2">
                {[
                  { level: 1, type: 'Documentos oficiais (DOU, Diários Oficiais, TSE, TCE)' },
                  { level: 2, type: 'Dados abertos governamentais (IBGE, IPEA)' },
                  { level: 3, type: 'Reportagens jornalísticas com registro' },
                  { level: 4, type: 'Declarações públicas do político em vídeo/áudio' },
                  { level: 5, type: 'Relatos de terceiros (exigem corroboração)' }
                ].map((src, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-dark-card border border-white/5 rounded-xl">
                    <span className="w-6 h-6 rounded-full bg-neon-cyan/20 text-neon-cyan text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{src.level}</span>
                    <div>
                      <p className="text-sm text-gray-300 font-medium">Nível {src.level}</p>
                      <p className="text-xs text-gray-500">{src.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Contestation */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Contestação
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                {contestation?.description || 'Prazo de 15 dias para contestação antes da publicação de qualquer avaliação.'}
              </p>
              <div className="p-4 bg-dark-card border border-yellow-500/20 rounded-xl">
                <p className="text-sm text-gray-300">
                  Prazo para contestação: <strong>{contestation?.deadline_days || 15} dias</strong> antes da publicação.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  O processo de contestação deve ser conduzido por comitê independente da equipe de avaliação,
                  garantindo imparcialidade e credibilidade ao projeto.
                </p>
              </div>
            </section>

            {/* Transparency */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-neon-cyan" />
                Transparência e Reprodutibilidade
              </h2>
              <p className="text-gray-400 leading-relaxed">
                {content?.transparency?.reproducibility || 'Qualquer cidadão pode reproduzir a nota final de qualquer político usando apenas os dados publicados no site. Todos os cálculos, fontes e evidências utilizadas são disponibilizados publicamente.'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Promessômetro · Metodologia v1.1 · 22/05/2026
              </p>
            </section>

          </div>
        </motion.div>
      </div>
    </div>
  );
}
