---
titulo: "Reestruturacao Metodologia v1.1 — pastas, templates, scores, indicadores"
data: "2026-06-10"
tipo: "execucao"
status: "concluido"
metodologia: "v1.1"
---

# Execucao: Reestruturacao Metodologia v1.1

## Sumario

Implementacao completa da metodologia oficial de 3 camadas (C1/C2/C3) em todo o vault Obsidian.

## O que foi criado/atualizado

### 1. Template `templates/promessa.md`
- Campos adicionados ao frontmatter: `complexidade`, `impacto`, `camada`, `fontes`, `evidencias_cumprimento`, `contestacao_prazo`, `verificavel`
- Secao `## 🧮 Metodologia` adicionada ao corpo com tabela de classificacao
- Secao `## 📎 Evidencias` atualizada com coluna `Nivel (1-5)`

### 2. Pasta `metodologia/` (6 arquivos)
| Arquivo | Conteudo |
|---------|----------|
| `FORMULA.md` | Formula (C1x0.40)+(C2x0.35)+(C3x0.25) e definicao das 3 camadas |
| `CAMADA-1-cumprimento.md` | Regras de status: cumprida/parcial/pendente/descumprida e calculo C1 |
| `CAMADA-2-indicadores.md` | Indicadores por categoria (seguranca, financas, funcionalismo, educacao, saude) com pesos |
| `CAMADA-3-juridico.md` | Tabela de penalidades FJ-01 a FJ-08 (-50 a -5) |
| `FONTES.md` | Niveis de fonte 1-5 e regra das 2 fontes independentes |
| `GRADES.md` | Tabela A(80-100), B(60-79), C(40-59), D(20-39), F(0-19) |
| `LEGADO.md` | Score_Mandato e Legado_Total com pesos decrescentes |

### 3. Politicos (35 arquivos atualizados)
- Frontmatter expandido: `mandato_inicio`, `mandato_fim`, `c3_score: "100"`, `legado_total: "0"`, `nota_final: "0"`, `conceito: "—"`
- Secao `## 🧮 Metodologia (v1.1)` adicionada em todos os 35 politicos

### 4. Pasta `indicadores/` (3 arquivos)
| Arquivo | Categoria | Indicadores |
|---------|-----------|-------------|
| `seguranca.md` | Seguranca (peso 0.30) | Taxa homicidios, efetivo policial, investimento |
| `financas.md` | Financas (peso 0.25) | Receita corrente, divida publica, investimento |
| `funcionalismo.md` | Funcionalismo (peso 0.20) | Servidores, gasto folha, concursos |

### 5. `AGENT_RULES.md`
- Regras de classificacao (complexidade 1-3, impacto 1-3, camada C1/C2/C3)
- Regra das 2 fontes independentes
- Regra de decremento de c3_score ao registrar fato juridico
- Referencia a formula oficial
- Estrutura de pastas atualizada

### 6. `CLAUDE.md`
- Referencia a metodologia v1.1 e link para `metodologia/FORMULA.md`
- Regras de classificacao, fontes, c3_score e calculo de nota
- Estrutura de pastas completa

### 7. `CONTEXTO.md`
- Cores do Graph View atualizadas (11 grupos)
- Secao `## 🧮 Metodologia (v1.1)` adicionada
- Estrutura de pastas expandida com metodologia/ e indicadores/
- Total de politicos: 35

### 8. `.obsidian/graph.json`
- Criado com 11 grupos de cores:
  - promessas: vermelho (#e05252)
  - politicos: roxo (#9b52e0)
  - metodologia: branco (#ffffff)
  - indicadores: ciano (#52d4e0)
  - categorias: rosa (#e052b8)
  - estados: laranja (#e09152)
  - execucoes: verde (#52e07a)
  - templates: azul (#5286e0)
  - CONTEXTO: amarelo (#e0c452)
  - AGENT_RULES: dourado (#c4a052)
  - CLAUDE: prata (#a0a0a0)

## Total de arquivos criados/modificados

| Tipo | Criados | Modificados |
|------|---------|-------------|
| Templates | 0 | 1 |
| Metodologia | 6 | 0 |
| Politicos | 0 | 35 |
| Indicadores | 3 | 0 |
| Regras (AGENT_RULES) | 0 | 1 |
| Regras (CLAUDE) | 0 | 1 |
| Contexto | 0 | 1 |
| Graph config | 1 | 0 |
| Log | 1 | 0 |
| **Total** | **11** | **39** |

## Proximos passos sugeridos

1. Sincronizar politicos atualizados no Supabase (c3_score, legado_total, nota_final)
2. Povoar indicadores com dados reais de cada estado
3. Registrar fatos juridicos para politicos com condenacoes conhecidas
4. Iniciar verificacao de promessas (status pendente → cumprida/descumprida com 2 fontes)
