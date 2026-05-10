import React from "react";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft, Scale, FileText, Check } from "lucide-react";
import { Link } from "react-router-dom";

export default function Metodologia() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <BookOpen className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Metodologia</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Entenda como avaliamos e classificamos promessas</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-neon-cyan" />
                Critérios de Classificação
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Utilizamos critérios objetivos e transparentes para classificar cada promessa. Nossa metodologia foi desenvolvida para minimizar viés e maximizar a objetividade da avaliação.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Classificações Utilizadas</h2>
              <div className="space-y-4">
                <div className="border border-green-500/30 bg-green-500/10 rounded-lg p-4">
                  <h3 className="text-green-400 font-bold mb-2">Cumprida</h3>
                  <p className="text-gray-400 text-sm">A promessa foi concretizada. Requer evidência clara de implementação (lei aprovada, programa lançado, meta atingida, entre outros).</p>
                </div>
                <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-4">
                  <h3 className="text-yellow-400 font-bold mb-2">Parcialmente Cumprida</h3>
                  <p className="text-gray-400 text-sm">A promessa foi cumprida apenas em parte. Requer evidência de que apenas uma porção do que foi prometido foi realizado.</p>
                </div>
                <div className="border border-orange-500/30 bg-orange-500/10 rounded-lg p-4">
                  <h3 className="text-orange-400 font-bold mb-2">Em Progresso</h3>
                  <p className="text-gray-400 text-sm">Há ações concretas em andamento, mas a promessa ainda não foi completada. O político demonstrou intenção e iniciou ações.</p>
                </div>
                <div className="border border-blue-500/30 bg-blue-500/10 rounded-lg p-4">
                  <h3 className="text-blue-400 font-bold mb-2">Não Iniciada</h3>
                  <p className="text-gray-400 text-sm">Não houve ação concreta, mas o prazo ainda não expirou. Não é possível classificar como descumprida.</p>
                </div>
                <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4">
                  <h3 className="text-red-400 font-bold mb-2">Descumprida</h3>
                  <p className="text-gray-400 text-sm">A promessa foi abandonada explicitamente, contrariada por ações do político, ou o prazo expirou sem cumprimento.</p>
                </div>
                <div className="border border-gray-500/30 bg-gray-500/10 rounded-lg p-4">
                  <h3 className="text-gray-400 font-bold mb-2">Não Classificada</h3>
                  <p className="text-gray-400 text-sm">Insuficiente informação ou evidências para classificar. Pode estar em análise ou aguardando evidências.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-neon-cyan" />
                Fontes Utilizadas
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Para cada classificação, exigimos evidências de fontes confiáveis:
              </p>
              <ul className="text-gray-400 space-y-2 mt-4">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-neon-cyan mt-1" />Diários Oficiais (União, Estados, Municípios)</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-neon-cyan mt-1" />Portal da Transparência</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-neon-cyan mt-1" />Veículos de notícias reconhecidos (G1, Folha, Estadão, entre outros)</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-neon-cyan mt-1" />Sites oficiais de órgãos governamentais</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-neon-cyan mt-1" />Projetos de lei e resoluções</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-neon-cyan mt-1" />Dados estatísticos oficiais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Processo de Validação</h2>
              <p className="text-gray-400 leading-relaxed">
                Todas as submissões de evidências passam por nosso processo de validação:
              </p>
              <ol className="text-gray-400 space-y-2 mt-4 list-decimal list-inside">
                <li>Verificação da fonte (é confiável e verificável?)</li>
                <li>Análise do conteúdo (prova o cumprimento ou descumprimento?)</li>
                <li>Verificação temporal (a evidência é posterior à promessa?)</li>
                <li>Consenso da equipe ou comunidade</li>
                <li>Publicação da classificação</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Transparência</h2>
              <p className="text-gray-400 leading-relaxed">
                Todas as classificações são acompanhadas de link para as evidências utilizadas. Nossa metodologia é de código aberto e qualquer pessoa pode auditar nosso processo. Contribuições e correções são bem-vindas.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}