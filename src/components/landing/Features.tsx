import { motion } from 'framer-motion';
import { Shield, Zap, RefreshCw, GitBranch, Search, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Monitoramento por IA',
    description: 'Nossa IA analisa diariamente notícias e diários oficiais para detectar novas promessas e atualizações de status.',
    hoverBg: 'from-emerald-500/20 to-emerald-500/5',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400'
  },
  {
    icon: Search,
    title: 'Busca Inteligente',
    description: 'Encontre promessas por categoria, partido, político ou região com filtros avançados de busca.',
    hoverBg: 'from-violet-500/20 to-violet-500/5',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400'
  },
  {
    icon: RefreshCw,
    title: 'Atualização Contínua',
    description: 'Histórico completo de cada promessa, desde o anúncio na campanha até a conclusão ou abandono.',
    hoverBg: 'from-sky-500/20 to-sky-500/5',
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400'
  },
  {
    icon: GitBranch,
    title: 'Rede de Evidências',
    description: 'Cada status é acompanhado de links, fotos e documentos que comprovam a situação real da obra ou projeto.',
    hoverBg: 'from-orange-500/20 to-orange-500/5',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400'
  },
  {
    icon: Zap,
    title: 'Ranking de Eficiência',
    description: 'Veja em tempo real o % de cumprimento de cada eleito e compare com outros candidatos.',
    hoverBg: 'from-purple-500/20 to-purple-500/5',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-400'
  },
  {
    icon: BarChart3,
    title: 'Relatórios de Impacto',
    description: 'Entenda como as promessas cumpridas ou quebradas afetam diretamente a economia e a sociedade.',
    hoverBg: 'from-cyan-500/20 to-cyan-500/5',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400'
  }
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Features() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold mb-4"
          >
            Tudo o que você precisa para{' '}
            <span className="gradient-text">cobrar resultados</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Transparência total sobre a gestão pública e o cumprimento das promessas de campanha.
          </motion.p>
        </div>

        {/* Grid — cada card com hover em cor neon diferente */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="group relative rounded-2xl border border-border/50 bg-card/30 p-6 hover:bg-card/60 transition-all duration-300 cursor-default"
            >
              {/* Overlay neon no hover — cor única por card */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.hoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />
              <div className="relative">
                {/* Ícone com bg colorido */}
                <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
