import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Send,
  Trash2,
  Copy,
  Info
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { supabase } from "../../lib/supabaseClient";

interface SyncResult {
  success: boolean;
  promise_id?: string;
  politician_id?: string;
  evidences_created?: number;
  parsed_data?: {
    titulo: string;
    status: string;
    score: number;
    acoes_count: number;
    o_que_falta_count: number;
    fontes_count: number;
  };
  message?: string;
  error?: string;
}

const EXAMPLE_PAINEL = `Painel de Acompanhamento: Implantação do Sistema de Videomonitoramento Integrado
CampoDados de Preenchimento / Status Atual
Gestor ResponsávelFábio Cruz Mitidieri (Governador de Sergipe)
PartidoPSD
Status da MetaEm Andamento / Parcialmente Concluída
Score Atualizado75 / 100 (Proposta de alteração com base nas novas evidências)
Última Atualização29/05/2026
Ações Concluídas• Expansão das câmeras do Ciosp para bairros periféricos e interior (ex: Lagarto).
• Modernização do Centro de Controle de Operações (CCO) do DER/SE com videowall e inteligência artificial.
• Instalação de monitoramento inteligente com reconhecimento facial via Fundação Renascer.
O que ainda falta• Conclusão da integração de 100% das câmeras municipais e privadas ao sistema central do Estado.
• Ampliação do cerco digital nas rodovias estaduais secundárias.
Fontes & Evidências• Portal de Notícias do Governo de Sergipe
• Departamento de Infraestrutura Rodoviária (DER/SE)
• Secretaria de Segurança Pública de Sergipe (SSP)
Grau de ConfiançaAlta (95%) com base em decrees, entregas físicas e vistorias publicadas.`;

const statusLabels: Record<string, { label: string; color: string }> = {
  cumprida: { label: "Cumprida", color: "text-green-400" },
  parcialmente_cumprida: { label: "Parcialmente Cumprida", color: "text-yellow-400" },
  em_andamento: { label: "Em Andamento", color: "text-blue-400" },
  nao_iniciada: { label: "Não Iniciada", color: "text-gray-400" },
  descumprida: { label: "Descumprida", color: "text-red-400" },
  nao_classificada: { label: "Não Classificada", color: "text-gray-500" }
};

export default function PromessaSync() {
  const [painel, setPainel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSync() {
    if (!painel.trim()) {
      setError("Cole os dados do Painel de Acompanhamento primeiro.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "promessasync",
        {
          body: { painel }
        }
      );

      if (fetchError) {
        throw new Error(fetchError.message || "Erro na requisição");
      }

      const response = typeof data === "string" ? JSON.parse(data) : data;

      if (!response.success) {
        throw new Error(response.error || "Falha na sincronização");
      }

      setResult(response);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setPainel("");
    setResult(null);
    setError(null);
  }

  function handleLoadExample() {
    setPainel(EXAMPLE_PAINEL);
    setResult(null);
    setError(null);
  }

  function handleCopy() {
    navigator.clipboard.writeText(painel);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-background">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">PromessaSync</h1>
              <p className="text-gray-500 text-sm">
                Sincronize avaliações manuais diretamente no banco de dados
              </p>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-white/5 rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Painel de Acompanhamento
            </label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadExample}
                className="text-xs"
              >
                <Info className="w-3 h-3 mr-1" />
                Carregar Exemplo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                {copied ? "Copiado!" : "Copiar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            </div>
          </div>

          <textarea
            value={painel}
            onChange={(e) => setPainel(e.target.value)}
            placeholder="Cole aqui o conteúdo do 'Painel de Acompanhamento' no formato padrão..."
            className="w-full h-80 bg-dark-lighter border border-white/10 rounded-2xl p-4 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-neon-purple/50 font-mono"
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {painel.length} caracteres
            </div>
            <Button
              variant="primary"
              onClick={handleSync}
              disabled={loading || !painel.trim()}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Sincronizar
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6"
          >
            <div className="flex items-center gap-3 text-red-400">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Erro na sincronização</span>
            </div>
            <p className="text-red-300/80 text-sm mt-2">{error}</p>
          </motion.div>
        )}

        {result?.success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 mb-6"
          >
            <div className="flex items-center gap-3 text-green-400 mb-4">
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold text-lg">Sincronização concluída!</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-dark-lighter rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Promise ID</div>
                <div className="text-xs font-mono text-gray-300 truncate">
                  {result.promise_id?.substring(0, 8)}...
                </div>
              </div>
              <div className="bg-dark-lighter rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Score</div>
                <div className="text-lg font-bold text-neon-purple">
                  {result.parsed_data?.score}
                </div>
              </div>
              <div className="bg-dark-lighter rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <div className={`text-sm font-medium ${statusLabels[result.parsed_data?.status || ""]?.color || "text-gray-400"}`}>
                  {statusLabels[result.parsed_data?.status || ""]?.label || result.parsed_data?.status}
                </div>
              </div>
              <div className="bg-dark-lighter rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Evidências</div>
                <div className="text-lg font-bold text-green-400">
                  {result.evidences_created}
                </div>
              </div>
            </div>

            {result.parsed_data && (
              <div className="bg-dark-lighter rounded-xl p-4">
                <div className="text-sm font-medium text-gray-300 mb-2">
                  {result.parsed_data.titulo}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>{result.parsed_data.acoes_count} ações concluídas</span>
                  <span>•</span>
                  <span>{result.parsed_data.o_que_falta_count} pendências</span>
                  <span>•</span>
                  <span>{result.parsed_data.fontes_count} fontes</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-green-400/80 text-sm">
              <CheckCircle className="w-4 h-4" />
              Banco atualizado e sincronizado com sucesso
            </div>
          </motion.div>
        )}

        <div className="bg-dark-card border border-white/5 rounded-3xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-neon-purple" />
            Como usar
          </h3>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple text-xs font-bold flex-shrink-0">
                1
              </div>
              <p>
                Pesquise manualmente no Google as informações sobre a promessa
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple text-xs font-bold flex-shrink-0">
                2
              </div>
              <p>
                Cole o texto do "Painel de Acompanhamento" no campo acima (formato padrão)
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple text-xs font-bold flex-shrink-0">
                3
              </div>
              <p>
                Clique em <strong className="text-gray-200">Sincronizar</strong> para gravar no banco
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple text-xs font-bold flex-shrink-0">
                4
              </div>
              <p>
                O sistema atualiza <strong className="text-gray-200">promises</strong>,{" "}
                <strong className="text-gray-200">promise_explanations</strong> e{" "}
                <strong className="text-gray-200">promise_evidences</strong> automaticamente
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <AlertCircle className="w-4 h-4" />
              Formato esperado
            </div>
            <pre className="text-xs text-gray-600 bg-dark-lighter rounded-xl p-3 overflow-x-auto">
{`Painel de Acompanhamento: [Título da Promessa]
CampoDados de Preenchimento / Status Atual
Gestor Responsável[Nome] ([Cargo])
Partido[Partido]
Status da Meta[Status]
Score Atualizado[Score] / 100
Última Atualização[Data]
Ações Concluídas• [Ação 1]\n• [Ação 2]
O que ainda falta• [Pendencia 1]\n• [Pendencia 2]
Fontes & Evidências• [Fonte 1]\n• [Fonte 2]
Grau de Confiança[Confiança]`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}