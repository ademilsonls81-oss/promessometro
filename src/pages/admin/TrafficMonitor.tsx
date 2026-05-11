import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Globe, 
  Ban,
  Clock,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Eye,
  Filter
} from "lucide-react";

interface TrafficStats {
  activeConnections: number;
  blockedIPs: number;
  totalRequestsToday: number;
  suspiciousActivities: number;
  memoryUsage: number;
}

interface SuspiciousLog {
  ip: string;
  type: string;
  details: Record<string, any>;
  timestamp: string;
}

export default function TrafficMonitor() {
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [logs, setLogs] = useState<SuspiciousLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  async function fetchData() {
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch("/api/admin/traffic-stats"),
        fetch("/api/admin/suspicious-logs")
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(filter === "all" ? logsData.logs : logsData.logs.filter((l: SuspiciousLog) => l.type === filter));
      }

      setLastUpdate(new Date().toISOString());
    } catch (err) {
      console.error("[TrafficMonitor] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString("pt-BR");
  }

  function getTypeColor(type: string): string {
    if (type.includes("rate_limit")) return "text-red-400 bg-red-500/10";
    if (type.includes("scraping")) return "text-orange-400 bg-orange-500/10";
    if (type.includes("bot")) return "text-yellow-400 bg-yellow-500/10";
    return "text-gray-400 bg-gray-500/10";
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Globe className="w-6 h-6 text-neon-cyan" />
            Monitor de Tráfego
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Última atualização: {formatTimestamp(lastUpdate)}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Conexões Ativas</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.activeConnections}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-card border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Ban className="w-5 h-5 text-red-400" />
              <span className="text-gray-400 text-sm">IPs Bloqueados</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.blockedIPs}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-dark-card border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Total Requests</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {stats.totalRequestsToday.toLocaleString("pt-BR")}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-card border border-white/10 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">Atividades Suspeitas</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.suspiciousActivities}</div>
          </motion.div>
        </div>
      )}

      <div className="bg-dark-card border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Logs de Atividade Suspeita
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1 text-sm"
            >
              <option value="all">Todos</option>
              <option value="rate_limit_exceeded">Rate Limit</option>
              <option value="scraping_blocked">Scraping</option>
              <option value="bot_detected">Bot</option>
            </select>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma atividade suspeita registrada.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border ${getTypeColor(log.type)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono">{log.ip}</code>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10">
                        {log.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {JSON.stringify(log.details)}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatTimestamp(log.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-dark-card border border-white/10 rounded-xl p-6">
        <h3 className="font-bold flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5" />
          Configurações de Proteção
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-black/30 rounded-lg">
            <p className="text-gray-400 mb-1">Leitura Pública</p>
            <p className="font-bold text-green-400">300 req/min por IP</p>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <p className="text-gray-400 mb-1">Ações Sensíveis</p>
            <p className="font-bold text-yellow-400">10 req/min por IP</p>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <p className="text-gray-400 mb-1">API Interna</p>
            <p className="font-bold text-blue-400">60 req/min por IP</p>
          </div>
        </div>
      </div>
    </div>
  );
}