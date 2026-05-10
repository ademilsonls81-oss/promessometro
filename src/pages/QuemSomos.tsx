import React from "react";
import { motion } from "framer-motion";
import { Users, ArrowLeft, Target, Eye, Heart } from "lucide-react";
import { Link } from "react-router-dom";

export default function QuemSomos() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <Users className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Quem Somos</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Conheça a missão e história do Promessômetro</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-neon-cyan" />
                Nossa Missão
              </h2>
              <p className="text-gray-400 leading-relaxed">
                O Promessômetro existe para promover a transparência política no Brasil. Acreditamos que o cidadão brasileiro merece acesso fácil e confiável às informações sobre as promessas feitas por seus representantes eleitos. Nossa missão é acompanhar, verificar e tornar público o cumprimento das promessas eleitorais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-neon-cyan" />
                Nossa Visão
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Buscamos ser a principal fonte de referência para verificação de promessas políticas no Brasil. Imaginamos um país onde os cidadãos podem facilmente acompanhar e cobrar o cumprimento das promessas feitas por seus representantes eleitos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-neon-cyan" />
                Nossos Valores
              </h2>
              <ul className="text-gray-400 leading-relaxed space-y-2">
                <li><strong className="text-white">Transparência:</strong> Acreditamos que a informação pública capacita o cidadão.</li>
                <li><strong className="text-white">Imparcialidade:</strong> Não nos alinhamos a nenhum partido ou político.</li>
                <li><strong className="text-white">Verificabilidade:</strong> Todas as nossas afirmações são baseadas em fontes verificadas.</li>
                <li><strong className="text-white">Acessibilidade:</strong> Buscamos tornar a informação acessível a todos os brasileiros.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Nossa História</h2>
              <p className="text-gray-400 leading-relaxed">
                O Promessômetro foi criado em 2024 com o objetivo de preencher uma lacuna importante na democracia brasileira: a falta de acompanhamento sistemático das promessas eleitorais. O projeto começou como uma iniciativa de código aberto e cresceu organicamente através da participação da comunidade.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Equipe</h2>
              <p className="text-gray-400 leading-relaxed">
                O Promessômetro é mantido por uma equipe pequena, mas dedicada de colaboradores. O projeto é de código aberto e aceita contribuições da comunidade. Se você quiser contribuir, visite nosso GitHub.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Apoie o Projeto</h2>
              <p className="text-gray-400 leading-relaxed">
                O Promessômetro é um projeto independente e não recebe financiamento de partidos ou políticos. Se você gosta do nosso trabalho, considere fazer uma doação através do GitHub Sponsors ou contribuir com código.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}