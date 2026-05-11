import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Send, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface ContestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  promiseId: string;
  promiseTitle: string;
  politicianName: string;
}

export default function ContestationModal({ 
  isOpen, 
  onClose, 
  promiseId, 
  promiseTitle, 
  politicianName 
}: ContestationModalProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [evidenciaUrl, setEvidenciaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!nome.trim() || !motivo.trim()) {
      setError("Nome e motivo são obrigatórios");
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from("promise_contestations")
        .insert({
          promise_id: promiseId,
          nome_contestante: nome.trim(),
          email_contestante: email.trim() || null,
          motivo: motivo.trim(),
          evidencia_url: evidenciaUrl.trim() || null,
          status: "pendente"
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNome("");
        setEmail("");
        setMotivo("");
        setEvidenciaUrl("");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar contestação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
          >
            <div className="bg-dark-card border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h2 className="text-xl font-bold">Contestar Esta Avaliação</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {success ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-green-500/20 rounded-full w-fit mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold text-green-400 mb-2">
                    Contestação Enviada!
                  </h3>
                  <p className="text-gray-400">
                    Nossa equipe vai analisar e responder em breve.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <p className="text-sm text-blue-300">
                      <strong>Promessa:</strong> {promiseTitle}
                    </p>
                    <p className="text-sm text-blue-300">
                      <strong>Politico:</strong> {politicianName}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Seu Nome *
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-neon-cyan focus:outline-none"
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Email (opcional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-neon-cyan focus:outline-none"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Motivo da Contestação *
                    </label>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-neon-cyan focus:outline-none resize-none"
                      rows={4}
                      placeholder="Explique por que esta avaliação está incorreta..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Link de Evidência (opcional)
                    </label>
                    <input
                      type="url"
                      value={evidenciaUrl}
                      onChange={(e) => setEvidenciaUrl(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-neon-cyan focus:outline-none"
                      placeholder="https://..."
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-neon-cyan text-black font-bold py-3 rounded-xl hover:bg-neon-cyan/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {loading ? "Enviando..." : "Enviar Contestação"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}