---
titulo: "Reorganizacao promessas/ em subpastas por status + atualizacao de wikilinks"
data: "2026-06-10"
tipo: "execucao"
status: "concluido"
---

# Execucao: Reorganizacao promessas/ por status

## Sumario

Migracao de ~6144 arquivos de promessa de `promessas/{politico}/` para `promessas/{status}/{politico}/`, com atualizacao de ~17.280 wikilinks em politicos/, estados/, categorias/ e CONTEXTO.md.

## O que foi feito

### 1. Criacao das subpastas de status

| Pasta | Descricao |
|-------|-----------|
| `promessas/pendentes/` | Status `pendente` (🟡) — 5166 arquivos |
| `promessas/parciais/` | Status `parcial` (🔵) — 594 arquivos |
| `promessas/cumpridas/` | Status `cumprida` (🟢) — 212 arquivos |
| `promessas/descumpridas/` | Status `quebrada`/`descumprida` (🔴) — 170 arquivos |
| `promessas/em-andamento/` | Status `em andamento` (🔵) — 2 + 1 (EXEMPLO) = 3 arquivos |

### 2. Movimentacao de arquivos

- 6144 arquivos .md movidos via Node.js (renameSync)
- Estrutura preservada: `promessas/{status}/{politico}/{arquivo}.md`
- Diretorios antigos vazios removidos (34 diretorios)

### 3. Atualizacao de wikilinks

- 17.280 wikilinks atualizados em:
  - 35 arquivos `politicos/*.md`
  - 27 arquivos `estados/*.md`
  - 11 arquivos `categorias/*.md`
  - `CONTEXTO.md`
- Links antigos: `[[promessas/{politico}/{arquivo}|titulo]]`
- Links novos: `[[promessas/{status}/{politico}/{arquivo}|titulo]]`

### 4. Atualizacao de .obsidian/graph.json

- 15 grupos de cores no grafo do Obsidian
- Cores especificas por status:
  - cumpridas: verde (#52e07a)
  - parciais: amarelo (#e0c452)
  - pendentes: cinza (#cccccc)
  - descumpridas: vermelho (#e05252)
  - em-andamento: azul (#5286e0)

### 5. Atualizacao de AGENT_RULES.md

- Regra de mover arquivo ao mudar status
- Regra de criar novas promessas em `promessas/pendentes/`

### 6. Atualizacao de CONTEXTO.md

- Contagens por status na tabela de inventario
- Cores do Graph View atualizadas com 15 grupos
- Estrutura de pastas atualizada com subpastas por status

## Estatisticas finais

| Metrica | Valor |
|---------|-------|
| Arquivos movidos | 6144 |
| Wikilinks atualizados | 17280 |
| Diretorios antigos removidos | 34 |
| Grupos de cor no graph.json | 15 |
| Politicos com promessas | 34 |

## Proximos passos sugeridos

1. Verificar se algum wikilink ficou quebrado (grep por `promessas/[a-z]` sem status prefixo)
2. Atualizar 00-INDEX.md com novos caminhos
3. Executar sync_supabase.mjs para sincronizar promessas movidas no Supabase
