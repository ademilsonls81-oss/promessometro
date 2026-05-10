import React from "react";
import { motion } from "framer-motion";
import { MapPin, Globe } from "lucide-react";

export default function Mapa() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <MapPin className="w-12 h-12 text-neon-purple" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            Mapa <span className="text-neon-purple">Político</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Visualize a distribuição geográfica dos políticos monitorados
          </p>
        </motion.div>

        <div className="bg-dark-card border border-white/5 rounded-3xl p-8 text-center">
          <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Em breve</h2>
          <p className="text-gray-500">
            O mapa interativo estará disponível em breve. Enquanto isso, 
            acompanhe os políticos no <a href="/ranking" className="text-neon-cyan hover:underline">Ranking</a>.
          </p>
        </div>
      </div>
    </div>
  );
}