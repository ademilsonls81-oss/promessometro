import React, { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Search, Filter, TrendingUp, TrendingDown, Clock, ChevronRight, User } from "lucide-react";
import { Badge, Button } from "../components/ui";

const MOCK_POLITICIANS = [
  {
    id: "1",
    name: "Ricardo Nunes",
    role: "Prefeito",
    city: "São Paulo",
    state: "SP",
    party: "MDB",
    percentage: 72,
    stats: { fulfilled: 12, partial: 5, broken: 2, pending: 3 }
  },
  {
    id: "2",
    name: "Tarcísio de Freitas",
    role: "Governador",
    state: "SP",
    party: "Republicanos",
    percentage: 58,
    stats: { fulfilled: 20, partial: 10, broken: 8, pending: 15 }
  },
  {
    id: "3",
    name: "Guilherme Boulos",
    role: "Deputado Federal",
    state: "SP",
    party: "PSOL",
    percentage: 38,
    stats: { fulfilled: 5, partial: 2, broken: 10, pending: 1 }
  }
];

export default function Ranking() {
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("Todos");

  const filteredPoliticians = MOCK_POLITICIANS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.city?.toLowerCase().includes(search.toLowerCase()) ||
                         p.state?.toLowerCase().includes(search.toLowerCase()) ||
                         p.party?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = selectedRole === "Todos" || p.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const roles = ["Todos", "Prefeito", "Governador", "Deputado Federal"];

  return (
    <div className="min-h-screen py-12 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <span className="text-sm font-bold text-yellow-500 tracking-wider uppercase">Ranking Nacional</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            Quem <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan text-glow-purple">cumpre</span> o que promete?
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Acompanhe em tempo real o desempenho dos políticos brasileiros. Baseado em dados reais, notícias validadas e participação popular.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: "Promessas Rastreadas", value: "2.847", icon: Clock, color: "text-blue-400" },
            { label: "Cumpridas", value: "34%", icon: TrendingUp, color: "text-green-400" },
            { label: "Quebradas", value: "41%", icon: TrendingDown, color: "text-red-400" },
            { label: "Políticos Monitorados", value: "312", icon: User, color: "text-neon-cyan" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-dark-card border border-white/5 p-6 rounded-3xl"
            >
              <div className={`p-2 w-fit rounded-lg bg-white/5 mb-4 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome, partido ou cidade..."
              className="w-full bg-dark-card border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:border-neon-purple outline-none transition-all placeholder:text-gray-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {roles.map(role => (
              <Button 
                key={role}
                variant={selectedRole === role ? "primary" : "secondary"}
                onClick={() => setSelectedRole(role)}
                className="whitespace-nowrap rounded-2xl h-14 px-6"
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        {/* Ranking List */}
        <div className="space-y-4">
          {filteredPoliticians.map((politician, idx) => (
            <motion.div
              key={politician.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group bg-dark-card border border-white/5 hover:border-white/10 p-4 md:p-6 rounded-3xl transition-all cursor-pointer"
            >
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Position */}
                <div className="text-2xl font-display font-bold text-gray-700 w-8">
                  {idx + 1}º
                </div>

                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center border border-white/5 overflow-hidden">
                  <span className="text-xl font-bold text-white/50">
                    {politician.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-bold group-hover:text-neon-cyan transition-colors">
                    {politician.name}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {politician.role} • {politician.city || politician.state} · {politician.party}
                  </p>
                </div>

                {/* Fulfillment Bar */}
                <div className="w-full md:w-64">
                   <div className="flex justify-between text-xs font-bold mb-2">
                     <span className="text-gray-500 uppercase tracking-wider">Cumprimento</span>
                     <span className="text-neon-cyan">{politician.percentage}%</span>
                   </div>
                   <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${politician.percentage}%` }}
                        className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                     />
                   </div>
                </div>

                {/* Action */}
                <div className="hidden md:block">
                  <Button variant="ghost" size="sm" className="group-hover:translate-x-1 transition-transform">
                    Ver Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
