import React, { useState, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Send, CheckCircle, Loader2, Shield, User, Clock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { checkCooldown, recordAction, checkHoneypot, formatCooldown } from "../services/abuseProtection";
import { executeRecaptchaV3 } from "../services/recaptchaService";

interface ContestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  promiseId: string;
  promiseTitle: string;
  politicianName: string;
}

const FORM_ID = "contestation";

export default function ContestationModal({ 
  isOpen, 
  onClose, 
  promiseId, 
  promiseTitle, 
  politicianName 
}: ContestationModalProps) {
  const formId = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [evidenciaUrl, setEvidenciaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (isOpen) {
      const cooldown = checkCooldown("contest", promiseId, 24 * 60 * 60 * 1000);
      setCooldownRemaining(cooldown.remainingTime);
      
      if (!cooldown.allowed) {
        const interval = setInterval(() => {
          const c = checkCooldown("contest", promiseId, 24 * 60 * 60 * 1000);
          setCooldownRemaining(c.remainingTime);
          if (c.allowed) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, promiseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const honeypotResult = checkHoneypot(FORM_ID);
    if (honeypotResult.isBot || honeypotResult.honeypotFilled || honeypot.trim() !== "") {
      console.warn("[Contestation] Honeypot triggered");
      setError("Envio bloqueado. Verifique seu navegador.");
      return;
    }

    const recaptchaToken = await executeRecaptchaV3("contest_promise");
    if (!recaptchaToken) {
      setError("Verificação de segurança falhou. Recarregue a página e tente novamente.");
      return;
    }

    const cooldown = checkCooldown("contest", promiseId, 24 * 60 * 60 * 1000);
    if (!cooldown.allowed) {
      setError(`Você já contestou esta promessa recentemente. Aguarde ${formatCooldown(cooldown.remainingTime)}.`);
      return;
    }

    setLoading(true);
    setError("");

    if (!nome.trim() || !motivo.trim()) {
      setError("Nome e motivo são obrigatórios");
      setLoading(false);
      return;
    }

    if (motivo.trim().length < 20) {
      setError("O motivo deve ter pelo menos 20 caracteres para ser válido.");
      setLoading(false);
      return;
    }

    try {
      const fingerprint = `anon_${promiseId}_${Date.now()}`;

      const { error: insertError } = await supabase
        .from("contests")
        .insert({
          promise_id: promiseId,
          contestant_name: nome.trim(),
          contestant_email: email.trim() || null,
          reasoning: motivo.trim(),
          evidence_url: evidenciaUrl.trim() || null,
          suggested_status: "pendente",
          fingerprint: fingerprint,
          recaptcha_token: recaptchaToken
        });

      if (insertError) throw insertError;

      recordAction("contest", promiseId);
      setSuccess(true);
      
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNome("");
        setEmail("");
        setMotivo("");
        setEvidenciaUrl("");
        setHoneypot("");
      }, 3000);
    } catch (err) {  // any-ok
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
            <div className="bg-dark-card border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
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
              ) : cooldownRemaining > 0 ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-orange-500/20 rounded-full w-fit mx-auto mb-4">
                    <Clock className="w-8 h-8 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-bold text-orange-400 mb-2">
                    Aguarde para Contestatar
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Você já enviou uma contestação para esta promessa. 
                    Aguarde para evitar spam.
                  </p>
                  <p className="text-2xl font-mono text-orange-400">
                    {formatCooldown(cooldownRemaining)}
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

                  <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                    <p className="text-xs text-green-400 flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      <strong>Proteção anti-abuso ativa</strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Você pode contestar sem login. Se criar uma conta, poderá acompanhar suas contestações.
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
                      Motivo da Contestação * <span className="text-gray-600">(mín. 20 caracteres)</span>
                    </label>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-neon-cyan focus:outline-none resize-none"
                      rows={4}
                      placeholder="Explique por que esta avaliação está incorreta. Forneça fontes e evidências..."
                      required
                      minLength={20}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      {motivo.length}/20 caracteres mínimo
                    </p>
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

                  <input
                    type="text"
                    name="website"
                    id={`hp_${FORM_ID}_${promiseId}`}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0 }}
                    aria-hidden="true"
                  />

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500 p-2 bg-gray-500/5 rounded-lg">
                    <User className="w-4 h-4" />
                    <span>Você pode enviar sem login. <strong className="text-gray-400">Criar conta</strong> é opcional.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || motivo.length < 20}
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