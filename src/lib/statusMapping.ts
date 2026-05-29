import { CheckCircle, AlertCircle, XCircle, Clock, AlertTriangle, TrendingUp, Minus, TrendingDown } from 'lucide-react';

export type StatusCanonical = 'cumprida' | 'parcial' | 'pendente' | 'quebrada';

export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const BASE: Record<StatusCanonical, StatusConfig> = {
  cumprida: { label: 'Cumprida', color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle, description: 'A promessa foi concretizada com evidências verificáveis' },
  parcial: { label: 'Parcial', color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: AlertCircle, description: 'Houve progresso, mas a promessa não foi completamente atendida' },
  pendente: { label: 'Pendente', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Clock, description: 'Sem evidências de ações concretas' },
  quebrada: { label: 'Quebrada', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, description: 'A promessa foi descumprida ou houve ação contrária' },
};

const ALIASES: Record<string, StatusCanonical> = {
  cumprida: 'cumprida', fulfilled: 'cumprida', realizada: 'cumprida', verified: 'cumprida',
  parcial: 'parcial', parcialmente_cumprida: 'parcial', partial: 'parcial', partial_fulfilled: 'parcial',
  em_andamento: 'parcial', in_progress: 'parcial',
  pendente: 'pendente', pending: 'pendente', pending_analysis: 'pendente', nao_iniciada: 'pendente', nao_classificada: 'pendente',
  quebrada: 'quebrada', broken: 'quebrada', not_fulfilled: 'quebrada', descumprida: 'quebrada', rejected: 'quebrada', nao_cumprida: 'quebrada',
};

export function normalizeStatus(s: string): StatusCanonical {
  return ALIASES[s?.toLowerCase()] || 'pendente';
}

export function getStatusConfig(s: string): StatusConfig {
  return BASE[normalizeStatus(s)] || BASE.pendente;
}

export function getTimelineLabel(s: string): string {
  const labels: Record<string, string> = {
    cumprida: 'Cumprida', fulfilled: 'Cumprida', realizada: 'Cumprida',
    parcial: 'Parcial', parcialmente_cumprida: 'Parcial', partial: 'Parcial',
    em_andamento: 'Em Andamento', in_progress: 'Em Andamento',
    pendente: 'Pendente', pending: 'Pendente', pending_analysis: 'Em Análise', nao_iniciada: 'Pendente', nao_classificada: 'Pendente',
    quebrada: 'Quebrada', broken: 'Quebrada', not_fulfilled: 'Quebrada', descumprida: 'Descumprida', rejected: 'Rejeitada',
    aceita: 'Aceita', em_analise: 'Em Análise',
  };
  return labels[s?.toLowerCase()] || 'Pendente';
}

export function getTimelineIcon(from: string, to: string) {
  const c = normalizeStatus(to);
  if (c === 'cumprida') return TrendingUp;
  if (c === 'quebrada') return TrendingDown;
  return Minus;
}

export function toServiceStatus(s: string): string {
  const n = normalizeStatus(s);
  if (n === 'cumprida') return 'fulfilled';
  if (n === 'parcial') return 'partial';
  if (n === 'quebrada') return 'broken';
  return 'pending';
}

export { BASE as STATUS_CONFIG, ALIASES };
