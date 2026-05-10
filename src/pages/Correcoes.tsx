import React from "react";
import { motion } from "framer-motion";
import { Edit3, ArrowLeft, AlertCircle, GitPullRequest, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function Correcoes() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <Edit3 className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Correções</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Reportar erros e solicitar correções</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-neon-cyan" />
                Reportar Erros
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Se você encontrou um erro em nosso banco de dados, por favor, nos avise. Os erros podem incluir:
              </p>
              <ul className="text-gray-400 space-y-2 mt-4">
                <li>- Promessa classificada incorretamente</li>
                <li>- Evidência ou link quebrado ou inválido</li>
                <li>- Informações incorretas sobre o político</li>
                <li>- Promessa faltando ou duplicada</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-neon-cyan" />
                Como Reportar
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Você pode reportar erros de duas formas:
              </p>
              <ol className="text-gray-400 space-y-2 mt-4 list-decimal list-inside">
                <li>Através da página de cada promessa, usando o botão "Reportar erro"</li>
                <li>Criando uma issue no nosso GitHub com detalhes do erro</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-neon-cyan" />
                Processo de Correção
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Ao reportar um erro, nossa equipe segue este processo:
              </p>
              <ol className="text-gray-400 space-y-2 mt-4 list-decimal list-inside">
                <li>Recebimento e registro do report</li>
                <li>Análise e verificação do erro reportado</li>
                <li>Correção ou justificativa</li>
                <li>Publicação da correção (quando aplicável)</li>
                <li>Notificação ao reportante</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Compromisso com a Verdade</h2>
              <p className="text-gray-400 leading-relaxed">
                Levamos a sério qualquer correção. Nosso objetivo é fornecer informação precisa e verificável. Agradecemos a todos que nos ajudam a melhorar a qualidade dos dados. Toda correção é bem-vinda e creditada quando possível.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Contato Direto</h2>
              <p className="text-gray-400 leading-relaxed">
                Para questões urgentes ou sensíveis, você pode nos contatar diretamente pelo GitHub ou redes sociais. Respondemos o mais rápido possível.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}