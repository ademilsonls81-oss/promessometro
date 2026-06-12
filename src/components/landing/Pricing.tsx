import { motion } from 'framer-motion';
import { Button } from "@/components/ui/Button";
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import api from '../../lib/api';
import { getAuthHeaders } from '../../lib/authHeaders';
import { useAuth } from '../../contexts/AuthContext';

const plans = [
  {
    name: 'Cidadão',
    price: 'R$0',
    period: '/mês',
    description: 'Comece a fiscalizar agora',
    features: [
      'Acesso ao Ranking Nacional',
      'Filtros por Estado/Cidade',
      'Reportar novas promessas',
      'Sugestão de evidências',
      'Newsletter semanal'
    ],
    cta: 'Começar Grátis',
    popular: false,
    stripe: false,
  },
  {
    name: 'Apoiador',
    price: 'R$15',
    period: '/mês',
    description: 'Sua voz com mais poder',
    features: [
      'Poder de voto duplo',
      'Selo exclusivo no perfil',
      'Prioridade na fila de IA',
      'Acesso ao Mapa de Calor',
      'Exportar dados básicos'
    ],
    cta: 'Seja um Apoiador',
    popular: true,
    stripe: true,
  },
  {
    name: 'Investigador',
    price: 'R$49',
    period: '/mês',
    description: 'Para quem quer ir fundo',
    features: [
      'Verificação manual prioritária',
      'Acesso à API de dados',
      'Relatórios PDF detalhados',
      'Alertas personalizados',
      'Suporte via WhatsApp'
    ],
    cta: 'Assinar Plano VIP',
    popular: false,
    stripe: true,
  }
];

export default function Pricing() {
  const { user } = useAuth();
  const [stripeLoading, setStripeLoading] = useState(false);

  const handleStripeCheckout = async () => {
    if (!user) {
      window.location.href = '/';
      return;
    }
    setStripeLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await api.post(
        '/api/create-checkout-session',
        { userId: user.id, email: user.email },
        { headers }
      );
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        alert('Unable to start checkout. Please try again.');
      }
    } catch (err) {  // any-ok
      alert(err?.response?.data?.error ?? 'Checkout unavailable. Please try again later.');
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-50"
          style={{ background: 'hsl(262 83% 65% / 0.1)' }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold mb-4"
          >
            Escolha seu plano de{' '}
            <span className="gradient-text">impacto</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            Apoie a transparência política no Brasil
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl border p-6 lg:p-8 ${
                plan.popular
                  ? 'border-primary/50 bg-card/60 glow'
                  : 'border-border/50 bg-card/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-xs font-medium text-white">
                    <Sparkles className="w-3 h-3" />
                    Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.stripe ? (
                <Button
                  onClick={handleStripeCheckout}
                  disabled={stripeLoading}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0 gap-2"
                >
                  {stripeLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                  ) : plan.cta}
                </Button>
              ) : plan.name === 'Enterprise' ? (
                <a href="mailto:contato@promessometro.com.br">
                  <Button variant="outline" className="w-full">{plan.cta}</Button>
                </a>
              ) : (
                <a href="/">
                  <Button variant="outline" className="w-full">{plan.cta}</Button>
                </a>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
