import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  MapPin, 
  Briefcase, 
  Users, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock,
  Share2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Badge, Button } from "../components/ui";
import ReportPromiseModal from "../components/ReportPromiseModal";
import { supabase } from "../lib/supabaseClient";

interface PromiseData {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  evidence: string | null;
  source_link: string | null;
  fulfillment_score: number;
  created_at: string;
  updated_at: string;
}

interface PoliticianData {
  name: string;
  position: string | null;
  party: string | null;
  state: string | null;
  photo_url: string | null;
  stats: {
    fulfilled: number;
    partial: number;
    broken: number;
    pending: number;
    total: number;
    percentage: number;
  };
  promises: PromiseData[];
}

const statusConfig: Record<string, { label: string; icon: React.ComponentType<any>; color: string; bg: string; border: string }> = {
  fulfilled: { label: "Cumprida", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  partial: { label: "Parcial", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  partial_fulfilled: { label: "Parcial", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  broken: { label: "Quebrada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  not_fulfilled: { label: "Quebrada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  pending: { label: "Pendente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  pending_analysis: { label: "Em Análise", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  verified: { label: "Verificada", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  rejected: { label: "Rejeitada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" }
};

export default function PoliticianProfile() {
  const { id } = useParams<{ id: string }>();
  const [politician, setPolitician] = useState<PoliticianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPolitician(id);
    }
  }, [id]);

  async function fetchPolitician(nameOrId: string) {
    try {
      setLoading(true);
      
      const decoded = decodeURIComponent(nameOrId);
      
      // Primeiro tenta buscar por politician_id (UUID)
      const { data: promisesById, error: errorById } = await supabase
        .from('promises')
        .select('*, politicians(name, party, state)')
        .eq('politician_id', decoded)
        .order('created_at', { ascending: false });

      let promises = promisesById;
      
      // Se não encontrou por ID, busca pelo nome
      if (!promises || promises.length === 0) {
        const { data: promisesByName, error: errorByName } = await supabase
          .from('promises')
          .select('*, politicians(name, party, state)')
          .ilike('politician_name', `%${decoded}%`)
          .order('created_at', { ascending: false });
          
        promises = promisesByName;
      }

      if (errorById || !promises || promises.length === 0) {
        setError("Político não encontrado");
        return;
      }

      // Pegar dados do político (do primeiro registro)
      const politicianData = promises[0].politicians || {};
      const fullName = politicianData.name || promises[0].politician_name;
      
      const stats = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: promises.length, percentage: 50 };
      
      promises.forEach((p: any) => {
        const s = p.status?.toLowerCase() || '';
        if (s === 'fulfilled' || s === 'realizada' || s === 'cumprida') stats.fulfilled++;
        else if (s === 'partial' || s === 'partial_fulfilled' || s === 'em_andamento' || s === 'parcial') stats.partial++;
        else if (s === 'broken' || s === 'not_fulfilled' || s === 'quebrada' || s === 'não cumprida') stats.broken++;
        else stats.pending++;
      });
      
      stats.percentage = stats.total > 0 ? Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100) : 50;

      setPolitician({
        name: fullName,
        position: null,
        party: politicianData.party || null,
        state: politicianData.state || null,
        photo_url: null,
        stats,
        promises: promises.map((p: any) => ({
          id: p.id,
          title: p.promise_title,
          description: p.promise_description,
          category: p.category,
          status: p.status,
          evidence: p.evidence,
          source_link: p.source_link,
          fulfillment_score: p.fulfillment_score,
          created_at: p.created_at,
          updated_at: p.updated_at
        }))
      });
      setError(null);
    } catch (err: any) {
      console.error("[PoliticianProfile] Error fetching:", err);
      setError("Político não encontrado: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (error || !politician) {
    return (
      <div className="min-h-screen py-12 px-4 bg-background">
        <div className="container max-w-5xl">
          <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8">
            <ChevronLeft className="w-4 h-4" />
            Voltar para o Ranking
          </Link>
          <div className="text-center py-20">
            <p className="text-red-400 text-xl mb-4">{error || "Político não encontrado"}</p>
            <Button onClick={() => window.history.back()}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  const filteredPromises = politician.promises.filter(p => 
    filter === "all" || p.status === filter || (filter === "fulfilled" && p.status === "fulfilled") || (filter === "broken" && (p.status === "broken" || p.status === "not_fulfilled"))
  );

  const initials = politician.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen py-12 px-4 bg-background">
      <div className="container max-w-5xl">
        <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Voltar para o Ranking
        </Link>

        <div className="bg-dark-card border border-white/5 rounded-3xl p-8 mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 blur-[80px] -z-10" />
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center border border-white/10 overflow-hidden shrink-0 shadow-2xl">
               {politician.photo_url ? (
                 <img src={politician.photo_url} alt={politician.name} className="w-full h-full object-cover" />
               ) : (
                 <span className="text-4xl font-bold text-white/50">{initials}</span>
               )}
            </div>
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-3xl md:text-4xl font-display font-bold">{politician.name}</h1>
                {politician.promises.length > 0 && <Badge variant="pro">Verificado</Badge>}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6 mb-6">
                {politician.position && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Briefcase className="w-4 h-4" />
                    <span>{politician.position}</span>
                  </div>
                )}
                {politician.state && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>{politician.state}</span>
                  </div>
                )}
                {politician.party && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>Partido: {politician.party}</span>
                  </div>
                )}
              </div>
              
              <p className="text-gray-400 mb-8 leading-relaxed max-w-2xl">
                {politician.promises.length > 0 
                  ? `Político monitorado com ${politician.stats.total} promessas rastreadas.`
                  : "Nenhuma promessa registrada ainda."}
              </p>

              <div className="flex flex-wrap gap-4">
                <Button variant="primary" className="gap-2">
                  <Share2 className="w-4 h-4" /> Compartilhar Perfil
                </Button>
                <Button variant="secondary" className="gap-2">
                  <AlertTriangle className="w-4 h-4" /> Reportar Erro
                </Button>
              </div>
            </div>

            <div className="w-full md:w-auto p-6 bg-black/40 border border-white/5 rounded-2xl text-center">
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Índice de Confiança</div>
              <div className="text-5xl font-display font-bold text-neon-cyan mb-2">{politician.stats.percentage}%</div>
              <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden mx-auto">
                 <div className="h-full bg-neon-cyan" style={{ width: `${politician.stats.percentage}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <button 
            onClick={() => setFilter(filter === "fulfilled" ? "all" : "fulfilled")}
            className={`p-4 border rounded-2xl transition-all text-left ${
              filter === "fulfilled" ? "border-green-500/20 bg-green-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
            }`}
          >
            <CheckCircle2 className="w-5 h-5 mb-2 text-green-400" />
            <div className="text-2xl font-bold">{politician.stats.fulfilled}</div>
            <div className="text-gray-500 text-xs uppercase font-bold">Cumpridas</div>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "partial" ? "all" : "partial")}
            className={`p-4 border rounded-2xl transition-all text-left ${
              filter === "partial" ? "border-yellow-500/20 bg-yellow-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
            }`}
          >
            <AlertCircle className="w-5 h-5 mb-2 text-yellow-400" />
            <div className="text-2xl font-bold">{politician.stats.partial}</div>
            <div className="text-gray-500 text-xs uppercase font-bold">Parciais</div>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "broken" ? "all" : "broken")}
            className={`p-4 border rounded-2xl transition-all text-left ${
              filter === "broken" ? "border-red-500/20 bg-red-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
            }`}
          >
            <XCircle className="w-5 h-5 mb-2 text-red-400" />
            <div className="text-2xl font-bold">{politician.stats.broken}</div>
            <div className="text-gray-500 text-xs uppercase font-bold">Quebradas</div>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "pending" ? "all" : "pending")}
            className={`p-4 border rounded-2xl transition-all text-left ${
              filter === "pending" ? "border-gray-500/20 bg-gray-500/10" : "border-white/5 bg-dark-card hover:bg-white/5"
            }`}
          >
            <Clock className="w-5 h-5 mb-2 text-gray-400" />
            <div className="text-2xl font-bold">{politician.stats.pending}</div>
            <div className="text-gray-500 text-xs uppercase font-bold">Pendentes</div>
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Promessas de Campanha ({politician.promises.length})</h2>
            <Button variant="primary" size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
              <AlertCircle className="w-4 h-4" /> Sugerir Atualização
            </Button>
          </div>

          {politician.promises.length === 0 ? (
            <div className="text-center py-12 bg-dark-card border border-white/5 rounded-3xl">
              <p className="text-gray-500 text-lg mb-4">Nenhuma promessa encontrada para este político.</p>
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                Reportar Primeira Promessa
              </Button>
            </div>
          ) : filteredPromises.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhuma promessa com este filtro.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredPromises.map(promise => {
                const config = statusConfig[promise.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                
                return (
                  <motion.div
                    key={promise.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-dark-card border border-white/5 rounded-3xl p-6 md:p-8 hover:border-white/10 transition-all"
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                           {promise.category && <Badge variant="category">{promise.category}</Badge>}
                           <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.color}`}>
                             <StatusIcon className="w-3.5 h-3.5" />
                             {config.label}
                           </div>
                        </div>
                        <h3 className="text-xl font-bold mb-3">{promise.title}</h3>
                        {promise.description && (
                          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            {promise.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 
                            {new Date(promise.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          {(promise.evidence || promise.source_link) && (
                            <a 
                              href={promise.evidence || promise.source_link || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-neon-cyan hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> Ver Evidência
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <ReportPromiseModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          politicianName={politician.name}
        />
      </div>
    </div>
  );
}