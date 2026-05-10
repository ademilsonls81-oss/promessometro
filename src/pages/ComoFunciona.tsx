import React from "react";
import { motion } from "framer-motion";
import { HelpCircle, ArrowLeft, Search, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function ComoFunciona() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <HelpCircle className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Como Funciona</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Entenda como acompanhamos e verificamos promessas políticas</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-neon-cyan" />
                1. Coleta de Promessas
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Identificamos promessas feitas por políticos brasileiros através de diversas fontes: planos de governo, debates eleitorais, entrevistas, redes sociais e veículos de notícias. Nossa equipe e a comunidade contribuem para catalogar novas promessas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-neon-cyan" />
                2. Acompanhamento Contínuo
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Após uma promessa ser catalogada, ela entra em acompanhamento contínuo. Monitoramos notícias, projetos de lei, ações do governo e outras fontes para identificar avanços ou retrocessos no cumprimento da promessa.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-neon-cyan" />
                3. Verificação
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Quando surgem evidências de cumprimento ou descumprimento, nossa equipe analisa a evidência e classifica a promessa conforme nossa metodologia. A classificação é baseada em critérios objetivos e fontes verificáveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-neon-cyan" />
                4. Classificações
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Cada promessa pode receber uma das seguintes classificações:
              </p>
              <ul className="text-gray-400 leading-relaxed space-y-2 mt-4">
                <li><span className="text-green-400 font-bold">Cumprida:</span> A promessa foi concretizada.</li>
                <li><span className="text-yellow-400 font-bold">Parcialmente Cumprida:</span> A promessa foi cumprida em parte.</li>
                <li><span className="text-orange-400 font-bold">Em Progresso:</span> Há avanços, mas ainda não foi completada.</li>
                <li><span className="text-blue-400 font-bold">Não Iniciada:</span> A promessa não foi iniciada, mas o prazo ainda não expirou.</li>
                <li><span className="text-red-400 font-bold">Descumprida:</span> A promessa foi abandonada ou contrariada.</li>
                <li><span className="text-gray-400 font-bold">Não Classificada:</span> Precisa de mais informações ou evidências.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Como Participar</h2>
              <p className="text-gray-400 leading-relaxed">
                Você pode participar de várias formas: submetendo novas promessas que encontrar, reportando evidências de cumprimento ou descumprimento, ou contribuindo com código no nosso GitHub. Toda ajuda é bem-vinda!
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}