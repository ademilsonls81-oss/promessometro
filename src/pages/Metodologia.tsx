import React from "react";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft, Scale, FileText, Check, Brain, AlertTriangle, Shield, Users, ExternalLink, Search, Github } from "lucide-react";
import { Link } from "react-router-dom";

export default function Metodologia() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4 bg-background">
      <div className="container mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-neon-cyan/20 rounded-xl">
              <BookOpen className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Metodologia</h1>
          </div>
          <p className="text-gray-500 text-sm mb-12">Entenda como avaliamos e classificamos promessas políticas</p>

          <div className="space-y-12">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-neon-purple" />
                Como a IA Avalia uma Promessa
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Utilizamos um modelo de linguagem (llama-3.3-70b-versatile) para analisar evidências coletadas de fontes públicas. A IA não toma decisões políticas — apresenta dados de forma estruturada.
              </p>
              <div className="p-4 bg-dark-card border border-white/5 rounded-xl space-y-2">
                <p className="text-sm text-gray-300 font-medium">O processo funciona assim:</p>
                <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Coletamos evidências de fontes públicas e verificáveis</li>
                  <li>A IA analisa cada evidência e a compara com a promessa original</li>
                  <li>O sistema classifica o status com base em critérios objetivos</li>
                  <li>Um score de confiança indica a certeza da avaliação</li>
                  <li>Avaliações com baixa confiança vão para revisão humana</li>
                </ol>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-neon-cyan" />
                Critérios de Classificação
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                Cada promessa é classificada em uma das seguintes categorias, com base em evidências concretas:
              </p>
              <div className="space-y-4">
                {[
                  { status: "cumprida", label: "Cumprida", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10", desc: "A promessa apresenta evidências verificáveis de implementação (lei aprovada, programa lançado, obra entregue, decreto publicado)." },
                  { status: "parcialmente_cumprida", label: "Parcialmente Cumprida", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", desc: "A promessa apresenta evidências parciais de execução. Uma porção foi realizada, mas o compromisso completo ainda não foi atingido." },
                  { status: "em_andamento", label: "Em Andamento", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10", desc: "A promessa apresenta evidências de que ações foram iniciadas (licitação aberta, projeto de lei em tramitação, contrato assinado) sem entrega ainda." },
                  { status: "nao_iniciada", label: "Não Iniciada", color: "text-gray-400", border: "border-gray-500/30", bg: "bg-gray-500/10", desc: "Não foram encontradas evidências de ações relacionadas à promessa. O prazo pode ou não ter expirado." },
                  { status: "descumprida", label: "Descumprida", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10", desc: "A promessa apresenta evidências de ação contrária ao compromisso, ou prazo expirou com declaração pública contrária do político." },
                  { status: "nao_classificada", label: "Não Classificada", color: "text-gray-500", border: "border-gray-500/30", bg: "bg-gray-500/10", desc: "A promessa é vaga demais para verificação objetiva (ex: 'vou melhorar a educação') ou não há evidências disponíveis." }
                ].map(item => (
                  <div key={item.status} className={`border ${item.border} ${item.bg} rounded-xl p-5`}>
                    <h3 className={`font-bold mb-2 ${item.color}`}>{item.label}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-neon-cyan" />
                Como o Score é Calculado
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                O score de 0 a 100 reflete o grau de cumprimento com base na análise de evidências:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-dark-card border border-green-500/20 rounded-xl">
                  <p className="text-green-400 font-bold mb-1">80-100: Cumprida</p>
                  <p className="text-gray-400 text-sm">Evidências concretas de implementação completa</p>
                </div>
                <div className="p-4 bg-dark-card border border-yellow-500/20 rounded-xl">
                  <p className="text-yellow-400 font-bold mb-1">40-79: Parcialmente</p>
                  <p className="text-gray-400 text-sm">Progresso parcial com evidências verificáveis</p>
                </div>
                <div className="p-4 bg-dark-card border border-blue-500/20 rounded-xl">
                  <p className="text-blue-400 font-bold mb-1">20-39: Em Andamento</p>
                  <p className="text-gray-400 text-sm">Ações iniciadas sem entrega final</p>
                </div>
                <div className="p-4 bg-dark-card border border-red-500/20 rounded-xl">
                  <p className="text-red-400 font-bold mb-1">0-19: Sem Evidências</p>
                  <p className="text-gray-400 text-sm">Nenhuma evidência de execução encontrada</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-neon-cyan" />
                Fontes Confiáveis
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Validamos cada avaliação cruzando com fontes de diferentes categorias:
              </p>
              <div className="space-y-3">
                {[
                  { label: "Fontes Governamentais", desc: "Diário Oficial da União, Presidência, Câmara, Senado, TCU, Agências", examples: "GOV, IBGE, IPEA" },
                  { label: "Veículos de Comunicação", desc: "G1, Folha, UOL, CNN Brasil, Estadão, Valor, Metropoles", examples: "JORNAL" },
                  { label: "Organizações de Fact-Checking", desc: "Agência Lupa, Aos Fatos, Tru联动", examples: "FACT" },
                  { label: "Dados Abertos", desc: "Portal da Transparência, Dados governamentais abertos", examples: "DATA" }
                ].map((src, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-dark-card border border-white/5 rounded-xl">
                    <Check className="w-5 h-5 text-neon-cyan mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">{src.label}</p>
                      <p className="text-gray-400 text-sm">{src.desc}</p>
                      <p className="text-gray-600 text-xs mt-1">{src.examples}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-neon-purple" />
                Revisão Humana
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Nem tudo pode ser decidido por IA. Nosso sistema inclui revisão humana:
              </p>
              <ul className="space-y-2">
                {[
                  "Avaliações com confiança abaixo de 40% exigem revisão antes de publicação",
                  "Qualquer pessoa pode contestar uma avaliação via formulário público",
                  "Contestações são analisadas pela equipe em até 7 dias",
                  "Histórico completo de alterações fica visível publicamente"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-400 text-sm">
                    <Check className="w-4 h-4 text-neon-cyan mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Como Contestar uma Avaliação
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Se você discorda de uma avaliação, pode contestá-la:
              </p>
              <ol className="space-y-3">
                {[
                  "Clique em 'Contestar Esta Avaliação' na página da promessa",
                  "Informe seu nome e motive por que a avaliação está incorreta",
                  "Anexe links de evidências que comprovem sua contestação",
                  "Nossa equipe analisa e pode solicitar nova avaliação da IA",
                  "O resultado fica visível no histórico da promessa"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-400 text-sm">
                    <span className="w-6 h-6 rounded-full bg-neon-cyan/20 text-neon-cyan text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-neon-cyan" />
                Código Aberto
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Todo o nosso código é aberto. Você pode auditar, contribuir ou adaptar:
              </p>
              <a
                href="https://github.com/ademilsonls81-oss/promessometro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors"
              >
                <Github className="w-4 h-4" />
                Ver no GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}