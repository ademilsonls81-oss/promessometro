import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, ArrowLeft, Scale, FileText, Check, Brain,
  AlertTriangle, Shield, Users, Search, Loader2,
  Layers, Target, Gavel, BarChart3
} from "lucide-react";
import { Link } from "react-router-dom";

const GRADE_CONFIG = {
  A: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  B: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  C: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  D: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  F: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" }
};

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
            Versão {methodology?.version || '1.0'} · Publicada em {methodology?.published_at ? new Date(methodology.published_at).toLocaleDateString('pt-BR') : '17/05/2026'}
          </p>
          <p className="text-gray-400 mb-12 leading-relaxed">
            O Promessômetro avalia políticos com base em três camadas independentes que compõem a nota final.
          </p>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-8 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!content ? (
            <div className="text-center py-12 text-gray-500">
              Documento de metodologia não disponível.
            </div>
          ) : (
            <div className="space-y-12">

              {/* Formula Summary */}
              <section className="p-6 bg-gradient-to-br from-neon-purple/10 to-neon-cyan/5 border border-white/10 rounded-2xl">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-neon-cyan" />
                  Fórmula da Nota Final
                </h2>
                <div className="text-center py-4">
                  <div className="text-2xl font-display font-bold text-neon-cyan mb-2">
                    {formula?.nota_final || "C1 × 0.40 + C2 × 0.35 + C3 × 0.25"}
                  </div>
                  <div className="flex flex-wrap justify-center gap-6 mt-4 text-sm">
                    {formula?.grade_scale?.map((g: any) => {
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
                    <p className="text-gray-500 text-sm">Peso: {(camada1?.weight || 0.40) * 100}% da nota final</p>
                  </div>
                </div>
                <p className="text-gray-400 leading-relaxed mb-4">{camada1?.description}</p>
                <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl mb-4">
                  <code className="text-sm text-green-300">{camada1?.calculation}</code>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {camada1?.status && Object.entries(camada1.status).map(([key, val]: any) => (
                    <div key={key} className="p-3 bg-dark-card border border-white/5 rounded-xl text-center">
                      <div className="text-lg font-bold font-display">{val.score}</div>
                      <div className="text-xs text-gray-400">{val.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-dark-card border border-white/5 rounded-xl text-xs text-gray-500">
                  <strong className="text-gray-400">Fontes primárias:</strong> {camada1?.sources?.primary}
                  <br />
                  <strong className="text-gray-400">Secundárias:</strong> {camada1?.sources?.secondary}
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
                    <p className="text-gray-500 text-sm">Peso: {(camada2?.weight || 0.35) * 100}% da nota final</p>
                  </div>
                </div>
                <p className="text-gray-400 leading-relaxed mb-4">{camada2?.description}</p>
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl mb-4">
                  <code className="text-sm text-blue-300">{camada2?.calculation}</code>
                </div>
                <div className="space-y-3">
                  {camada2?.categories?.map((cat: any, i: number) => (
                    <div key={i} className="p-4 bg-dark-card border border-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold capitalize text-sm">{cat.name}</span>
                        <span className="text-xs text-gray-500">Peso: {(cat.weight * 100)}%</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cat.indicators?.map((ind: string, j: number) => (
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
                    <p className="text-gray-500 text-sm">Peso: {(camada3?.weight || 0.25) * 100}% da nota final</p>
                  </div>
                </div>
                <p className="text-gray-400 leading-relaxed mb-4">{camada3?.description}</p>
                <div className="p-4 bg-dark-card border border-white/5 rounded-xl mb-4">
                  <p className="text-sm text-gray-300">
                    <strong>Score inicial:</strong> {camada3?.initial_score || 100} pontos.
                  </p>
                  <p className="text-sm text-yellow-400 mt-1">
                    ⚠ {camada3?.rule}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {camada3?.penalties?.map((pen: any, i: number) => (
                    <div key={i} className="p-3 bg-dark-card border border-red-500/20 rounded-xl">
                      <div className="text-lg font-bold font-display text-red-400">-{pen.points}</div>
                      <div className="text-xs text-gray-400">{pen.label}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Verification */}
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-neon-cyan" />
                  Verificação de Evidências
                </h2>
                <p className="text-gray-400 leading-relaxed mb-4">{verification?.description}</p>
                <div className="space-y-2">
                  {verification?.source_hierarchy?.map((src: any, i: number) => (
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
                <p className="text-gray-400 leading-relaxed mb-4">{contestation?.description}</p>
                <div className="p-4 bg-dark-card border border-yellow-500/20 rounded-xl">
                  <p className="text-sm text-gray-300">
                    Prazo para contestação: <strong>{contestation?.deadline_days || 15} dias</strong> antes da publicação.
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
                  {content?.transparency?.reproducibility || 'Qualquer cidadão pode reproduzir a nota final de qualquer político usando apenas os dados publicados no site.'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Metodologia v{methodology?.version || '1.0'} — publicada em {methodology?.published_at ? new Date(methodology.published_at).toLocaleDateString('pt-BR') : '17/05/2026'}
                </p>
              </section>

            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
