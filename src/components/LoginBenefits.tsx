import React from "react";
import { motion } from "framer-motion";
import { User, Bell, History, Shield, ChevronRight, Lock, Star } from "lucide-react";

interface LoginBenefitsProps {
  variant?: "inline" | "card" | "banner";
  onLogin?: () => void;
}

const benefits = [
  { icon: Bell, title: "Notificações", description: "Receba alertas quando suas contestações forem respondidas" },
  { icon: History, title: "Histórico pessoal", description: "Acompanhe todas as suas submissões em um só lugar" },
  { icon: Shield, title: "Maior limite", description: "Faça mais ações sem Limits de uso" },
  { icon: Star, title: "Prioridade", description: "Suas submissions são analisadas primeiro" },
];

export default function LoginBenefits({ variant = "inline", onLogin }: LoginBenefitsProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-6 text-xs text-gray-500">
        {benefits.slice(0, 2).map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <b.icon className="w-3 h-3 text-neon-cyan" />
            <span>{b.title}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-neon-purple/10 to-neon-cyan/10 border border-white/10 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-purple/20 rounded-lg">
              <User className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Crie uma conta</p>
              <p className="text-xs text-gray-400">É rápido e gratuito</p>
            </div>
          </div>
          <button
            onClick={onLogin}
            className="flex items-center gap-1 px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg text-sm font-bold hover:bg-neon-purple/30 transition-colors"
          >
            Login <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-white/5">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
              <b.icon className="w-3 h-3 text-neon-cyan" />
              <span>{b.title}</span>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-dark-card border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-neon-purple/20 rounded-lg">
          <Lock className="w-5 h-5 text-neon-purple" />
        </div>
        <div>
          <h4 className="font-bold text-white">Benefícios de criar uma conta</h4>
          <p className="text-xs text-gray-500">É opcional, mas melhora sua experiência</p>
        </div>
      </div>

      <div className="space-y-3">
        {benefits.map((b, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-black/30 rounded-lg">
            <div className="p-1.5 bg-neon-cyan/10 rounded-lg">
              <b.icon className="w-4 h-4 text-neon-cyan" />
            </div>
            <div>
              <p className="font-medium text-white text-sm">{b.title}</p>
              <p className="text-xs text-gray-500">{b.description}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onLogin}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-neon-purple to-neon-cyan text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
      >
        <User className="w-4 h-4" />
        Criar Conta ou Fazer Login
      </button>

      <p className="text-center text-xs text-gray-600 mt-3">
        Você pode continuar sem login. Não bloqueamos nenhuma funcionalidade.
      </p>
    </div>
  );
}