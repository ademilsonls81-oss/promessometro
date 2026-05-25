import { Users, FileText, CheckCircle, AlertTriangle, Clock, Activity } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, PieLabelRenderProps } from "recharts";

interface LastCron {
  execution_id: string;
  status: string;
  started_at: string;
  promises_evaluated: number;
  hours_ago: number;
}

export interface SystemStatus {
  politicians: number;
  promises: number;
  evaluated: number;
  never_evaluated: number;
  heranca_automatica: number;
  coverage: number;
  last_cron: LastCron | null;
  cron_history: unknown[];
}

function MetricCard({ icon: Icon, label, value, sub, color = "cyan" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    cyan: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20",
    green: "text-green-400 bg-green-400/10 border-green-400/20",
    red: "text-red-400 bg-red-400/10 border-red-400/20",
    yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
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

const PIE_COLORS = ["#22d3ee", "#ef4444"];

export default function AdminStats({ systemStatus }: { systemStatus: SystemStatus }) {
  const pieData = [
    { name: "Avaliadas", value: systemStatus.evaluated },
    { name: "Sem avaliação", value: systemStatus.never_evaluated },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Users} label="Políticos" value={systemStatus.politicians} color="cyan" />
        <MetricCard icon={FileText} label="Promessas" value={systemStatus.promises} color="purple" />
        <MetricCard icon={CheckCircle} label="Avaliadas" value={`${systemStatus.coverage}%`} sub={`${systemStatus.evaluated} total`} color="green" />
        <MetricCard icon={AlertTriangle} label="Sem avaliação" value={systemStatus.never_evaluated} color="yellow" />
        <MetricCard icon={Clock} label="Herança auto" value={systemStatus.heranca_automatica} sub="precisam de IA" color="red" />
        <MetricCard icon={Activity} label="Último cron" value={systemStatus.last_cron ? `${systemStatus.last_cron.hours_ago}h atrás` : "—"} sub={systemStatus.last_cron?.status} color={systemStatus.last_cron?.status === "completed" ? "green" : "yellow"} />
      </div>

      <div className="mt-4 p-4 rounded-2xl border border-white/10 bg-dark-card">
        <h3 className="text-sm font-semibold text-white mb-3">Cobertura de Avaliação</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }: PieLabelRenderProps) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
