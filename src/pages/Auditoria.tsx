import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, History, FileText, Download, Loader2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

interface AuditEntry {
  id: string;
  promise_id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  previous_score: number | null;
  new_score: number | null;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
  promise_title?: string;
  politician_name?: string;
}

const statusLabels: Record<string, string> = {
  cumprida: "Cumprida",
  parcialmente_cumprida: "Parcialmente Cumprida",
  em_andamento: "Em Andamento",
  nao_iniciada: "Não Iniciada",
  descumprida: "Descumprida",
  nao_classificada: "Não Classificada"
};

const statusColors: Record<string, string> = {
  cumprida: "text-green-400",
  parcialmente_cumprida: "text-yellow-400",
  em_andamento: "text-blue-400",
  nao_iniciada: "text-gray-400",
  descumprida: "text-red-400",
  nao_classificada: "text-gray-500"
};

export default function Auditoria() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    fetchAudit();
  }, [filter]);

  async function fetchAudit() {
    setLoading(true);
    try {
      let query = supabase
        .from("promise_audit_log")
        .select("*, promises(promise_title, politician_name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter !== "all") {
        query = query.eq("action", filter);
      }

      const { data } = await query;
      setEntries((data || []) as AuditEntry[]);
    } catch (err) {
      console.error("[Auditoria] Error:", err);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = ["Data", "Promessa", "Político", "Ação", "Status Anterior", "Novo Status", "Score Anterior", "Novo Score", "Motivo"];
    const rows = entries.map(e => [
      new Date(e.created_at).toLocaleString("pt-BR"),
      e.promise_title || e.promise_id,
      e.politician_name || "",
      e.action,
      e.previous_status || "",
      e.new_status || "",
      e.previous_score || "",
      e.new_score || "",
      e.change_reason || ""
    ]);

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visible = entries.slice(0, visibleCount);

  return (
    <div className="min-h-screen pt-12 pb-24 px-4 bg-background">
      <div className="container mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-neon-purple/20 rounded-xl">
                  <History className="w-6 h-6 text-neon-purple" />
                </div>
                <h1 className="text-3xl md:text-4xl font-display font-bold">Auditoria</h1>
              </div>
              <p className="text-gray-500 text-sm">Histórico completo de alterações em promessas</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-colors min-h-[48px]"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={exportJSON}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-colors min-h-[48px]"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500" />
            {["all", "status_change", "score_change", "ai_evaluation", "human_review"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                  filter === f
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                    : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                {f === "all" ? "Todas" : f.replace("_", " ")}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <History className="w-16 h-16 mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500 text-lg">Nenhuma alteração registrada</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visible.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-dark-card border border-white/5 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                      className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {entry.previous_status && (
                            <span className={`text-xs font-medium ${statusColors[entry.previous_status] || "text-gray-400"}`}>
                              {statusLabels[entry.previous_status] || entry.previous_status}
                            </span>
                          )}
                          <span className="text-gray-600 text-xs">→</span>
                          {entry.new_status && (
                            <span className={`text-xs font-bold ${statusColors[entry.new_status] || "text-gray-400"}`}>
                              {statusLabels[entry.new_status] || entry.new_status}
                            </span>
                          )}
                          {entry.new_score !== null && (
                            <span className="text-xs font-mono text-gray-500">
                              {entry.previous_score !== null ? `${entry.previous_score}→` : ""}{entry.new_score}/100
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 truncate">
                          {entry.promise_title || entry.promise_id}
                        </p>
                        <p className="text-xs text-gray-600">
                          {entry.politician_name || ""} — {new Date(entry.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-600 px-2 py-1 bg-white/5 rounded">
                          {entry.action}
                        </span>
                        {expanded[entry.id] ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </button>

                    {expanded[entry.id] && (
                      <div className="px-4 pb-4 border-t border-white/5">
                        <div className="pt-4 space-y-2 text-sm">
                          {entry.change_reason && (
                            <div className="p-3 bg-white/5 rounded-lg">
                              <p className="text-gray-500 text-xs mb-1">Motivo</p>
                              <p className="text-gray-300">{entry.change_reason}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/5 rounded-lg">
                              <p className="text-gray-500 text-xs">Quem alterou</p>
                              <p className="text-gray-300">{entry.changed_by || "Sistema"}</p>
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg">
                              <p className="text-gray-500 text-xs">Data</p>
                              <p className="text-gray-300">{new Date(entry.created_at).toLocaleString("pt-BR")}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {entry.promise_id && (
                              <Link
                                to={`/promessa/${entry.promise_id}`}
                                className="flex items-center gap-1 text-xs text-neon-cyan hover:text-white transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                Ver promessa
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {visibleCount < entries.length && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setVisibleCount(v => v + 30)}
                    className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all min-h-[48px]"
                  >
                    Ver mais ({entries.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}