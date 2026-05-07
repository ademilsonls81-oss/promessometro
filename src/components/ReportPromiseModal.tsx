import React, { useState } from "react";
import { X, Send, AlertCircle, Link as LinkIcon, FileText, User } from "lucide-react";
import { Button, Input } from "./ui";
import { motion, AnimatePresence } from "framer-motion";

interface ReportPromiseModalProps {
  isOpen: boolean;
  onClose: () => void;
  politicianName?: string;
}

export default function ReportPromiseModal({ isOpen, onClose, politicianName }: ReportPromiseModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simular envio
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-dark-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            {success ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Relatório Enviado!</h2>
                <p className="text-gray-400">Nossa IA e equipe de moderadores irão analisar as informações.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                  <h2 className="text-xl font-bold">Reportar Promessa/Evidência</h2>
                  <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {politicianName && (
                    <div className="flex items-center gap-2 p-3 bg-neon-purple/5 border border-neon-purple/10 rounded-2xl text-sm">
                      <User className="w-4 h-4 text-neon-purple" />
                      <span className="text-gray-300">Destinado a: <span className="font-bold text-white">{politicianName}</span></span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400 ml-1">Título da Promessa ou Fato</label>
                    <Input 
                      required 
                      placeholder="Ex: Reforma da Praça da Sé" 
                      className="bg-black/20 border-white/5 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400 ml-1">Descrição Detalhada</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="Descreva o que foi prometido ou qual a nova evidência encontrada..."
                      className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 focus:border-neon-purple outline-none transition-all resize-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400 ml-1">Link da Evidência (Obrigatório)</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        required 
                        type="url"
                        placeholder="https://noticia-ou-diario-oficial.com.br" 
                        className="bg-black/20 border-white/5 h-12 pl-12"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" /> 
                      Relatórios sem links válidos serão descartados automaticamente.
                    </p>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" className="flex-[2] gap-2" disabled={loading}>
                      {loading ? "Enviando..." : "Enviar para Análise"}
                      {!loading && <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
