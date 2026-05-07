import React, { useState } from "react";
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
  AlertTriangle
} from "lucide-react";
import { Badge, Button } from "../components/ui";
import ReportPromiseModal from "../components/ReportPromiseModal";

const MOCK_POLITICIAN = {
  id: "1",
  name: "Ricardo Nunes",
  role: "Prefeito",
  city: "São Paulo",
  state: "SP",
  party: "MDB",
  bio: "Empresário e político brasileiro, atual prefeito da cidade de São Paulo.",
  percentage: 72,
  stats: { fulfilled: 12, partial: 5, broken: 2, pending: 3 },
  promises: [
    {
      id: "p1",
      title: "Reduzir tempo de espera em UBSs para menos de 1h",
      status: "fulfilled",
      category: "Saúde",
      description: "Implementação do sistema Corujão da Saúde e telemedicina nas UBSs.",
      evidence: "https://prefeitura.sp.gov.br/relatorio-saude",
      date: "2024-03-15"
    },
    {
      id: "p2",
      title: "Construir 50km de ciclovias novas até 2025",
      status: "fulfilled",
      category: "Mobilidade",
      description: "Expansão da malha cicloviária nas zonas leste e sul.",
      evidence: "https://cetsp.com.br/ciclovias",
      date: "2024-01-20"
    },
    {
      id: "p3",
      title: "Zerar déficit habitacional em áreas de risco",
      status: "broken",
      category: "Habitação",
      description: "Remoção de famílias e entrega de 5.000 unidades em Ermelino Matarazzo.",
      evidence: "https://g1.globo.com/sp/noticia/habitacao-atraso",
      date: "2024-04-10"
    },
    {
      id: "p4",
      title: "Implantar wi-fi gratuito em 200 praças",
      status: "partial",
      category: "Tecnologia",
      description: "Programa Praça Digital em fase de expansão.",
      evidence: "https://spweb.com.br/wifi-livre",
      date: "2023-12-05"
    },
    {
      id: "p5",
      title: "Contratar 2.000 professores para a rede municipal",
      status: "pending",
      category: "Educação",
      description: "Concurso público anunciado em edital.",
      evidence: "https://diariooficial.sp.gov.br",
      date: "2024-05-01"
    }
  ]
};

const statusConfig = {
  fulfilled: { label: "Cumprida", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  partial: { label: "Parcial", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  broken: { label: "Quebrada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  pending: { label: "Pendente", icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" }
};

export default function PoliticianProfile() {
  const { id } = useParams();
  const [filter, setFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredPromises = MOCK_POLITICIAN.promises.filter(p => filter === "all" || p.status === filter);

  return (
    <div className="min-h-screen py-12 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        {/* Breadcrumb */}
        <Link to="/ranking" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Voltar para o Ranking
        </Link>

        {/* Profile Card */}
        <div className="bg-dark-card border border-white/5 rounded-3xl p-8 mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 blur-[80px] -z-10" />
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center border border-white/10 overflow-hidden shrink-0 shadow-2xl">
               <span className="text-4xl font-bold text-white/50">RN</span>
            </div>
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-3xl md:text-4xl font-display font-bold">{MOCK_POLITICIAN.name}</h1>
                <Badge variant="pro">Verificado</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6 mb-6">
                <div className="flex items-center gap-2 text-gray-400">
                  <Briefcase className="w-4 h-4" />
                  <span>{MOCK_POLITICIAN.role}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{MOCK_POLITICIAN.city}, {MOCK_POLITICIAN.state}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>Partido: {MOCK_POLITICIAN.party}</span>
                </div>
              </div>
              
              <p className="text-gray-400 mb-8 leading-relaxed max-w-2xl">
                {MOCK_POLITICIAN.bio}
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

            {/* Overall Score */}
            <div className="w-full md:w-auto p-6 bg-black/40 border border-white/5 rounded-2xl text-center">
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Índice de Confiança</div>
              <div className="text-5xl font-display font-bold text-neon-cyan mb-2">{MOCK_POLITICIAN.percentage}%</div>
              <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden mx-auto">
                 <div className="h-full bg-neon-cyan" style={{ width: `${MOCK_POLITICIAN.percentage}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {Object.entries(statusConfig).map(([key, config]) => (
            <button 
              key={key}
              onClick={() => setFilter(key === filter ? "all" : key)}
              className={`p-4 border rounded-2x transition-all text-left ${
                filter === key ? `${config.border} ${config.bg}` : "border-white/5 bg-dark-card hover:bg-white/5"
              }`}
            >
              <config.icon className={`w-5 h-5 mb-2 ${config.color}`} />
              <div className="text-2xl font-bold">{MOCK_POLITICIAN.stats[key as keyof typeof MOCK_POLITICIAN.stats]}</div>
              <div className="text-gray-500 text-xs uppercase font-bold">{config.label}</div>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Promessas de Campanha</h2>
            <Button variant="primary" size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
              <AlertCircle className="w-4 h-4" /> Sugerir Atualização
            </Button>
          </div>

          <div className="grid gap-6">
            {filteredPromises.map(promise => {
              const config = statusConfig[promise.status as keyof typeof statusConfig];
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
                         <Badge variant="category">{promise.category}</Badge>
                         <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.color}`}>
                           <config.icon className="w-3.5 h-3.5" />
                           {config.label}
                         </div>
                      </div>
                      <h3 className="text-xl font-bold mb-3">{promise.title}</h3>
                      <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        {promise.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Atualizado em 14/04/2026
                        </span>
                        <a 
                          href={promise.evidence}
                          target="_blank"
                          className="flex items-center gap-1 text-neon-cyan hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Ver Evidência
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <ReportPromiseModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          politicianName={MOCK_POLITICIAN.name}
        />
      </div>
    </div>
  );
}
