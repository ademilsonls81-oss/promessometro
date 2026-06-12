# Log de Execucao — Extracao Final de Promessas

**Data:** 2026-06-08
**Ferramenta:** pdfplumber + analise estrutural
**Total de estados processados:** 25
**Total de promessas:** 5713

---

## Resumo por Estado

| # | Estado | UF | Governador | Partido | Chars | Promessas |
|---|--------|----|------------|---------|-------|-----------|
| 1 | Acre | AC | Gladson de Lima Cameli | PP |  | 241 |
| 2 | Alagoas | AL | Paulo Dantas | MDB |  | 689 |
| 3 | Amapa | AP | Clecio Luis Vilhena Vieira | SD |  | 81 |
| 4 | Bahia | BA | Jeronimo Rodrigues | PT |  | 713 |
| 5 | Ceara | CE | Elmano de Freitas da Costa | PT |  | 208 |
| 6 | Distrito Federal | DF | Ibaneis Rocha Barros Junior | MDB |  | 492 |
| 7 | Espirito Santo | ES | Jose Renato Casagrande | PSB |  | 353 |
| 8 | Goias | GO | Ronaldo Ramos Caiado | UNIAO |  | 127 |
| 9 | Maranhao | MA | Carlos Orleans Brandao Junior | PSB |  | 264 |
| 10 | Minas Gerais | MG | Romeu Zema | Novo |  | 45 |
| 11 | Mato Grosso do Sul | MS | Eduardo Correa Riedel | PSDB |  | 301 |
| 12 | Para | PA | Helder Zahluth Barbalho | MDB |  | 58 |
| 13 | Paraiba | PB | Joao Azevedo Lins Filho | PSB |  | 199 |
| 14 | Pernambuco | PE | Raquel Teixeira Lyra Lucena | PSDB |  | 163 |
| 15 | Piaui | PI | Rafael Tajra Fonteles | PT |  | 213 |
| 16 | Parana | PR | Carlos Massa Ratinho Junior | PSD |  | 142 |
| 17 | Rio de Janeiro | RJ | Claudio Castro | PL |  | 74 |
| 18 | Rio Grande do Norte | RN | Fatima Bezerra | PT |  | 290 |
| 19 | Rondonia | RO | Marcos Jose Rocha dos Santos | UNIAO |  | 138 |
| 20 | Roraima | RR | Antonio Denarium | PP |  | 231 |
| 21 | Rio Grande do Sul | RS | Eduardo Leite | PSDB |  | 154 |
| 22 | Santa Catarina | SC | Jorginho Mello | PL |  | 41 |
| 23 | Sergipe | SE | Fabio Mitidieri | PSD |  | 64 |
| 24 | Sao Paulo | SP | Tarcisio de Freitas | Republicanos |  | 298 |
| 25 | Tocantins | TO | Wanderlei Barbosa | Republicanos |  | 134 |

---

## Como Continuar

Para reprocessar estados ou processar novos PDFs:

1. **Extrair texto dos PDFs:** `python tmp/harness/extract_pdfs_better.py`
2. **Extrair promessas:** `python tmp/harness/extracao_final.py`
3. **Forcar reprocessamento:** deletar entrada do checkpoint em `tmp/harness/checkpoint_final.json`
4. **Para extracao via IA (melhor qualidade):** configurar GROQ_API_KEY valida e executar:
   ```
   node processar_planos.mjs
   ```
   (Este script insere no Supabase em vez de criar arquivos locais)

### Estados com PDF escaneado (sem texto extraivel):

| Estado | UF | Problema |
|--------|----|----------|

### Arquivos Gerados:

| Caminho | Descricao |
|---------|-----------|
| `promessas/[governador]/*.md` | Promessas individuais de cada governador |
| `promessas/_planos-governo/UF_nome.md` | Texto completo extraido de cada PDF |
| `tmp/harness/checkpoint_final.json` | Checkpoint para continuar extracao |
| `execucoes/2026-06-08-extracao-final.md` | Este log |
| `CONTEXTO.md` | Inventario completo atualizado |

---

*Log gerado automaticamente em 2026-06-08*
