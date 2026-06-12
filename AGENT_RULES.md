# AGENT_RULES.md — Regras do Agente Promessômetro

> Este arquivo define o protocolo obrigatório que o agente deve seguir em TODA execução.
> Leia este arquivo ANTES de qualquer ação.
> Metodologia: v1.1 — consulte `metodologia/` para detalhes.

---

## 🔁 Protocolo de Inicialização (OBRIGATÓRIO)

Antes de qualquer ação, o agente DEVE:

1. **Ler `CONTEXTO.md`** na raiz do projeto para entender o estado atual do sistema.
2. **Ler o log mais recente em `execucoes/`** (arquivo com data mais recente no nome `YYYY-MM-DD_HH-MM.md`) para entender o que foi feito na última execução.
3. **Ler `metodologia/FORMULA.md`** para conhecer a fórmula de nota final.
4. Só então iniciar a execução atual.

---

## 📝 Regras de Atualização de Promessas

- A cada análise de uma promessa política, o agente **DEVE atualizar** o arquivo correspondente em `promessas/`.
- Campos obrigatórios a atualizar: `status`, `ultima_atualizacao`, e uma nova entrada na tabela `historico`.
- **Classificar sempre complexidade (1-3) e impacto (1-3)** ao analisar uma promessa.
- **Nunca marcar como cumprida sem pelo menos 2 fontes de níveis diferentes** (ver `metodologia/FONTES.md`).
- **Ao mudar o status de uma promessa, mover o arquivo para a subpasta correta:**
  - `promessas/cumpridas/{politico}/` para ✅ cumprida
  - `promessas/parciais/{politico}/` para 🔵 parcial
  - `promessas/pendentes/{politico}/` para 🟡 pendente (default)
  - `promessas/descumpridas/{politico}/` para ❌ descumprida/quebrada
  - `promessas/em-andamento/{politico}/` para 🔵 em andamento
- **Ao criar uma nova promessa**, sempre criar em `promessas/pendentes/{politico}/`.
- **Registrar decisões importantes** — qualquer decisão não-trivial (mudança de status, nova evidência, divergência de fontes) deve ser documentada na seção `## Decisões` do arquivo da promessa.

---

## 📋 Regras de Log de Execução

Ao finalizar cada execução, o agente DEVE:

1. **Criar um novo arquivo** em `execucoes/` com o nome `YYYY-MM-DD_HH-MM.md` (use a data/hora de finalização).
2. Usar o template `templates/execucao.md` como base.
3. Preencher todos os campos: promessas verificadas, promessas atualizadas, decisões tomadas, problemas encontrados, próximos passos.

---

## 🔄 Regras de Atualização do CONTEXTO

Ao finalizar cada execução, o agente DEVE:

1. **Atualizar `CONTEXTO.md`**:
   - Campo `Última Execução`: data e resumo da execução atual.
   - Tabela de inventário: atualizar status e `ultima_atualizacao` de cada promessa verificada.
   - Campo `Pendências`: listar o que ficou incompleto ou precisa de atenção na próxima execução.

---

## ⚖️ Regras da Metodologia (v1.1)

- **Ao avaliar uma promessa**, classificar sempre:
  - `complexidade` (1-Simples / 2-Médio / 3-Complexo)
  - `impacto` (1-Baixo / 2-Médio / 3-Alto)
  - `camada` (C1-Cumprimento / C2-Indicadores / C3-Fatos Jurídicos)
- **Nunca marcar como cumprida** sem pelo menos **2 fontes independentes de níveis diferentes**
- **Ao registrar fato jurídico**, decrementar `c3_score` do político correspondente conforme `metodologia/CAMADA-3-juridico.md`
- **Ao calcular nota final**, usar sempre a fórmula oficial: `(C1 × 0,40) + (C2 × 0,35) + (C3 × 0,25)`
- **Prazo de contestação**: 15 dias antes da publicação oficial — ignorar contestações fora do prazo

---

## 🏷️ Status Possíveis de Promessas

| Emoji | Status | Descrição |
|-------|--------|-----------|
| 🟡 | **pendente** | Promessa identificada, verificação não iniciada |
| 🔵 | **em andamento** | Verificação em curso, evidências sendo coletadas |
| ✅ | **cumprida** | Promessa cumprida com evidências suficientes (2+ fontes) |
| ❌ | **descumprida** | Promessa não cumprida ou claramente violada |
| ⏸️ | **pausada** | Verificação pausada (aguardando prazo, informação, etc.) |

---

## 📁 Estrutura de Arquivos

```
Promessometro/
├── AGENT_RULES.md       ← este arquivo (leia PRIMEIRO)
├── CLAUDE.md            ← regras globais do agente
├── CONTEXTO.md          ← estado atual do sistema
├── metodologia/         ← documentação da metodologia v1.1
├── indicadores/         ← fichas de indicadores por categoria
├── promessas/           ← um arquivo .md por promessa
├── politicos/           ← um arquivo .md por político com scores
├── estados/             ← índices por estado
├── categorias/          ← índices por categoria
├── execucoes/           ← logs de cada execução do agente
└── templates/
    ├── promessa.md      ← template para novas promessas
    └── execucao.md      ← template para logs de execução
```

---

## ⚠️ Regras de Ouro

- **Nunca sobrescreva histórico** — apenas adicione novas linhas na tabela `historico`.
- **Nunca altere o campo `data_promessa`** após a criação do arquivo.
- **Sempre cite a fonte** ao registrar evidências (com nível 1-5).
- **Em caso de dúvida sobre status**, use 🟡 pendente e registre a dúvida em `Decisões`.
