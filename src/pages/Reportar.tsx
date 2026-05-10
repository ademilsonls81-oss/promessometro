import React, { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function Reportar() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    politician_name: "",
    promise_title: "",
    promise_description: "",
    category: "Outros",
    source_link: "",
    reporter_name: "",
    reporter_email: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from("promises").insert({
        politician_name: form.politician_name,
        promise_title: form.promise_title,
        promise_description: form.promise_description || null,
        category: form.category,
        source_link: form.source_link || null,
        status: "pending",
        is_automated: false,
      });

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Error submitting:", err);
      setError(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="container mx-auto max-w-lg text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-green-500" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
          <p className="text-gray-400 mb-6">
            Sua promessa foi enviada para análise. Você pode acompanhar em /promessas.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setForm({
                politician_name: "",
                promise_title: "",
                promise_description: "",
                category: "Outros",
                source_link: "",
                reporter_name: "",
                reporter_email: "",
              });
            }}
            className="text-neon-cyan hover:underline"
          >
            Enviar outra promessa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <Send className="w-12 h-12 text-neon-purple" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            Reportar <span className="text-neon-purple">Promessa</span>
          </h1>
          <p className="text-gray-400">
            Encontrou uma promessa política? Nos ajude a rastrear!
          </p>
        </motion.div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-dark-card border border-white/5 rounded-3xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Político</label>
            <input
              type="text"
              required
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none"
              value={form.politician_name}
              onChange={(e) => setForm({ ...form, politician_name: e.target.value })}
              placeholder="Ex: Lula, Bolsonaro..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Título da Promessa</label>
            <input
              type="text"
              required
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none"
              value={form.promise_title}
              onChange={(e) => setForm({ ...form, promise_title: e.target.value })}
              placeholder="Ex: Criar 20 milhões de empregos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none resize-none"
              rows={3}
              value={form.promise_description}
              onChange={(e) => setForm({ ...form, promise_description: e.target.value })}
              placeholder="Detalhes adicionais sobre a promessa..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Categoria</label>
            <select
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="Saúde">Saúde</option>
              <option value="Educação">Educação</option>
              <option value="Segurança">Segurança</option>
              <option value="Economia">Economia</option>
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Meio Ambiente">Meio Ambiente</option>
              <option value="Trabalho">Trabalho</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Fonte (URL)</label>
            <input
              type="url"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none"
              value={form.source_link}
              onChange={(e) => setForm({ ...form, source_link: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-neon-purple to-neon-cyan py-3 rounded-xl font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Enviando..." : "Enviar Promessa"}
          </button>
        </form>
      </div>
    </div>
  );
}