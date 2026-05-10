import React from "react";
import { motion } from "framer-motion";
import { FileText, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <FileText className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Termos de Uso</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Última atualização: 9 de maio de 2026</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4">1. Aceitação dos Termos</h2>
              <p className="text-gray-400 leading-relaxed">
                Ao acessar ou usar o Promessômetro, você concorda em vinculado a estes Termos de Uso. Se você não concordar com estes termos, não use nossos serviços. Podemos modificar estes termos a qualquer momento, e o uso contínuo constitui aceitação das alterações.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">2. Descrição do Serviço</h2>
              <p className="text-gray-400 leading-relaxed">
                O Promessômetro é uma plataforma de transparência política que rastreia, verifica e acompanha promessas feitas por políticos brasileiros. Nossa missão é fornecer informação confiável e acessível sobre o cumprimento de promessas eleitorais. O serviço é fornecido como está e não garantimos precisão absoluta dos dados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">3. Uso da Plataforma</h2>
              <p className="text-gray-400 leading-relaxed">
                Você pode usar nossa plataforma para: visualizar promessas de políticos, verificar o status de cumprimentos, submeter novas promessas para acompanhamento e reportar evidências de cumprimento ou descumprimento. Pedimos que forneça informações verdadeiras e fundamentadas em fontes confiáveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">4. Conduta do Usuário</h2>
              <p className="text-gray-400 leading-relaxed">
                Você não pode: (a) usar a plataforma para difamar ou caluniar políticos; (b) submeter informações falsas ou fraudadas; (c) tentar manipular dados ou classificações; (d) usar o serviço para fins ilegais; (e) fazer coleta massiva de dados. Reservamo-nos o direito de suspender contas que violem estes termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">5. Submissão de Evidências</h2>
              <p className="text-gray-400 leading-relaxed">
                Ao submeter evidências de cumprimento ou descumprimento de promessas, você garante que as informações são verdadeiras e baseadas em fontes verificáveis. Reservamo-nos o direito de validar ou rejeitar submissões conforme nossa metodologia. Evidências submetidas devem incluir links para fontes oficiais ou notícias de veículos confiáveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">6. Limitação de Responsabilidade</h2>
              <p className="text-gray-400 leading-relaxed">
                O Promessômetro não será responsável por quaisquer danos indiretos, incidentais, especiais ou consequentes decorrentes do uso do serviço. Nossa responsabilidade total não excederá o valor que você pagou, se houver, nos 12 meses anteriores à reclamação. Não garantimos precisão absoluta das classificações de cumprimento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">7. Propriedade Intelectual</h2>
              <p className="text-gray-400 leading-relaxed">
                O software, design e marca Promessômetro são nossa propriedade intelectual. Os dados e análises fornecidos pela plataforma podem ser usados para fins pessoais e educacionais. O conteúdo original das fontes de notícias permanece propriedade dos publicadores originais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">8. Encerramento</h2>
              <p className="text-gray-400 leading-relaxed">
                Podemos encerrar ou suspender sua conta a qualquer tempo por violações destes termos. Você pode fechar sua conta a qualquer momento. Após o encerramento, seu acesso aos dados será revogado.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">9. Contato</h2>
              <p className="text-gray-400 leading-relaxed">
                Dúvidas sobre estes Termos devem ser direcionadas através de nossas redes sociais ou pelo GitHub.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}