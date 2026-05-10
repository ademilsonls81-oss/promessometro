import React from "react";
import { motion } from "framer-motion";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-purple/20 rounded-xl">
              <Shield className="w-6 h-6 text-neon-purple" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Política de Privacidade</h1>
          </div>

          <p className="text-gray-500 text-sm mb-12">Última atualização: 9 de maio de 2026</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4">1. Informações que Coletamos</h2>
              <p className="text-gray-400 leading-relaxed">
                Quando você usa o Promessômetro, coletamos informações que você fornece diretamente, incluindo seu endereço de e-mail via autenticação OAuth e dados de uso como contagens de requisições API. Não coletamos informações pessoais além das necessárias para a operação do serviço.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">2. Como Usamos suas Informações</h2>
              <p className="text-gray-400 leading-relaxed">
                Usamos as informações coletadas para fornecer, manter e melhorar nossos serviços, processar suas transações e comunicar atualizações e recursos. Seus dados nunca são vendidos a terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">3. Armazenamento e Segurança</h2>
              <p className="text-gray-400 leading-relaxed">
                Seus dados são armazenados de forma segura usando Supabase, um provedor de banco de dados em nuvem confiável. Implementamos medidas de segurança padrão da indústria, incluindo criptografia, controles de acesso e auditorias regulares de segurança para proteger suas informações.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">4. Processamento de Dados</h2>
              <p className="text-gray-400 leading-relaxed">
                Quando você usa nossa plataforma para submeter promessas ou evidências, processamos essas informações para análise e classificação. O conteúdo que processamos é informação disponível publicamente de fontes oficiais e veículos de notícias. Não armazenamos dados pessoais além do que é necessário para o serviço.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">5. Serviços de Terceiros</h2>
              <p className="text-gray-400 leading-relaxed">
                Usamos serviços de terceiros incluindo Google autenticação, Supabase banco de dados e Vercel hospedagem. Cada serviço tem sua própria política de privacidade. Compartilhamos apenas o mínimo de dados necessários para cada serviço funcionar.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">6. Seus Direitos</h2>
              <p className="text-gray-400 leading-relaxed">
                Você tem o direito de acessar, modificar ou excluir seus dados pessoais a qualquer momento através do Dashboard ou entrando em contato conosco. Você também pode desativar ou excluir sua conta inteiramente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">7. Cookies e Tecnologias Semelhantes</h2>
              <p className="text-gray-400 leading-relaxed">
                Usamos cookies e tecnologias semelhantes para melhorar sua experiência na plataforma. Você pode desativar cookies através das configurações do seu navegador, mas algumas funcionalidades podem não funcionar corretamente sem eles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">8. Contato</h2>
              <p className="text-gray-400 leading-relaxed">
                Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato através de nossas redes sociais ou pelo GitHub.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}