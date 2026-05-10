import React from "react";
import { motion } from "framer-motion";
import { BookMarked, ArrowLeft, Globe, Newspaper, Building, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function Fontes() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <BookMarked className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Fontes</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Referências e fontes utilizadas</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-neon-cyan" />
                Fontes Oficiais
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Utilizamos as seguintes fontes oficiais para verificar promessas:
              </p>
              <div className="space-y-2">
                <a href="https://www.in.gov.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-neon-cyan" />
                  <span className="text-gray-300">Diário Oficial da União</span>
                </a>
                <a href="https://portaldatransparencia.gov.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-neon-cyan" />
                  <span className="text-gray-300">Portal da Transparência</span>
                </a>
                <a href="https://www.camara.leg.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-neon-cyan" />
                  <span className="text-gray-300">Câmara dos Deputados</span>
                </a>
                <a href="https://www.senado.leg.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-neon-cyan" />
                  <span className="text-gray-300">Senado Federal</span>
                </a>
                <a href="https://www.planalto.gov.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-neon-cyan" />
                  <span className="text-gray-300">Presidência da República</span>
                </a>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-neon-cyan" />
                Veículos de Notícias
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Utilizamos notícias dos seguintes veículos como fonte secundária:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">G1 / Globo</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">UOL</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">Folha de S.Paulo</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">Estadão</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">CNN Brasil</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">Terra</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">Valor Econômico</div>
                <div className="p-3 bg-white/5 rounded-lg text-center text-gray-300">R7</div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-neon-cyan" />
                Outras Fontes
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Também utilizamos:
              </p>
              <ul className="text-gray-400 space-y-2">
                <li>- Sites de partidos políticos</li>
                <li>- Redes sociais dos políticos (X, Instagram, Bluesky)</li>
                <li>- Wikidata para informações sobre políticos</li>
                <li>- Tribunal Superior Eleitoral (TSE)</li>
                <li>- Assembleias Legislativas estaduais</li>
                <li>- Câmaras de Vereadores municipais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Contribua com Fontes</h2>
              <p className="text-gray-400 leading-relaxed">
                Se você conhece uma fonte confiável que não estamos utilizando, por favor, sugira através do nosso GitHub. Sempre estamos buscando melhorar nossa cobertura e precisão.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}