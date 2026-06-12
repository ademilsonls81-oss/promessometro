# Regras Globais do Agente — Promessômetro

## OBSIDIAN É SUA MEMÓRIA — LEIA ISSO PRIMEIRO

Esta pasta está conectada ao Obsidian em tempo real. Tudo que você escrever aqui aparece instantaneamente no Obsidian. Tudo que você deixar de escrever será esquecido na próxima sessão.

---

## OBRIGAÇÕES AO INICIAR QUALQUER SESSÃO

1. Leia `CONTEXTO.md` — é o estado atual do projeto
2. Leia o arquivo mais recente dentro de `execucoes/` — é o que aconteceu na última sessão
3. Leia `metodologia/FORMULA.md` — metodologia oficial v1.1
4. Liste os arquivos em `promessas/` — é o inventário atual

Sem fazer isso, você não tem contexto. Não pule esta etapa.

---

## OBRIGAÇÕES DURANTE A EXECUÇÃO

- Ao analisar ou atualizar qualquer promessa → abra e edite o arquivo correspondente em `promessas/`
- Ao tomar qualquer decisão importante → registre em `promessas/[nome].md` no bloco de Decisões
- Ao criar uma nova promessa → use `templates/promessa.md` como base (template v1.1)
- Ao classificar uma promessa → defina sempre complexidade (1-3), impacto (1-3) e camada (C1/C2/C3)
- Nunca marque como cumprida sem 2 fontes independentes de níveis diferentes (ver `metodologia/FONTES.md`)
- Ao registrar fato jurídico → decremente o c3_score do político (ver `metodologia/CAMADA-3-juridico.md`)
- Ao calcular nota final → use (C1×0.40)+(C2×0.35)+(C3×0.25) (ver `metodologia/FORMULA.md`)
- Nunca guarde informação só na memória da sessão — escreva no arquivo

---

## OBRIGAÇÕES AO FINALIZAR QUALQUER SESSÃO

1. Crie um novo arquivo em `execucoes/` com o nome `YYYY-MM-DD_HH-MM.md`
2. Preencha o log com: resumo do que foi feito, promessas verificadas, decisões tomadas, problemas encontrados e próximos passos
3. Atualize `CONTEXTO.md` com o novo estado geral do projeto

---

## ESTRUTURA DE PASTAS

```text
Promessometro/
├── CLAUDE.md                ← você está aqui (regras globais)
├── AGENT_RULES.md           ← regras detalhadas de operação
├── CONTEXTO.md              ← estado atual do projeto
├── metodologia/             ← documentação da metodologia v1.1
│   ├── FORMULA.md           ← fórmula C1×0.40 + C2×0.35 + C3×0.25
│   ├── CAMADA-1-cumprimento.md
│   ├── CAMADA-2-indicadores.md
│   ├── CAMADA-3-juridico.md
│   ├── FONTES.md            ← níveis 1-5 e regra das 2 fontes
│   ├── GRADES.md            ← A(80-100) a F(0-19)
│   └── LEGADO.md            ← Score_Mandato e Legado_Total
├── indicadores/             ← fichas de indicadores por categoria
│   ├── seguranca.md
│   ├── financas.md
│   └── funcionalismo.md
├── promessas/               ← um .md por promessa política
├── politicos/               ← um .md por político (com scores)
├── estados/                 ← índices por estado
├── categorias/              ← índices por categoria
├── execucoes/               ← log de cada sessão do agente
└── templates/               ← modelos para novos arquivos
```

---

## STATUS VÁLIDOS PARA PROMESSAS

Use exatamente estes valores:
- 🟡 pendente
- 🔵 em andamento  
- ✅ cumprida
- ❌ descumprida
- ⏸️ pausada

---

## METODOLOGIA v1.1 — Referência Rápida

- **C1** (40%): % de promessas cumpridas (cumprida=1, parcial=0.5)
- **C2** (35%): média ponderada de indicadores (segurança, finanças, funcionalismo)
- **C3** (25%): score jurídico (100 - penalidades)
- **Nota Final** = (C1 × 0.40) + (C2 × 0.35) + (C3 × 0.25)
- **Grade**: A(80-100), B(60-79), C(40-59), D(20-39), F(0-19)

---

## REGRA DE OURO

> O Obsidian é sua única memória entre sessões. Se não está escrito em um arquivo .md dentro desta pasta, não existe.
