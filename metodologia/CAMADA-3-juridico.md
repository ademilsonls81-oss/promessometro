# Camada 3 — Fatos Jurídicos (C3)

Peso na nota final: **25%**

## Tabela de Penalidades

Cada fato jurídico registrado decrementa o `c3_score` do político conforme a gravidade:

| Código | Fato | Penalidade | Descrição |
|--------|------|------------|-----------|
| FJ-01 | Condenação criminal em 1ª instância | −50 | Sentença condenatória por crime (Lei 8.429/92) |
| FJ-02 | Condenação por improbidade administrativa | −30 | Ato de improbidade com dano ao erário |
| FJ-03 | Multa do TCU/TCE | −20 | Sanção financeira aplicada por tribunal de contas |
| FJ-04 | Reprimenda do MP (recomendação pública) | −10 | Recomendação formal do Ministério Público |
| FJ-05 | Decisão liminar desfavorável | −10 | Liminar concedida contra o político ou seu governo |
| FJ-06 | Indisponibilidade de bens decretada | −20 | Bloqueio judicial de bens |
| FJ-07 | Inelegibilidade (Lei Ficha Limpa) | −50 | Condenação colegiada que gera inelegibilidade |
| FJ-08 | Termo de Ajustamento de Conduta (TAC) | −5 | Acordo extrajudicial com o MP |

## Regras

1. **c3_score** começa em 100 para cada político no início do mandato
2. Cada fato jurídico **decrementa** o score: `c3_score = c3_score - penalidade`
3. O score mínimo é 0 (não negativo)
4. Fatos jurídicos são cumulativos dentro do mandato
5. Ao mudar de mandato, o c3_score é **resetado para 100**, mas o `legado_total` preserva o histórico
6. Fatos registrados em mandatos anteriores entram no `legado_total` mas não afetam o c3_score atual

## Cálculo do C3

```
C3 = max(0, 100 - Σ penalidades)
```

Exemplo: político com condenação por improbidade (−30) e multa do TCE (−20)
```
C3 = max(0, 100 - 30 - 20) = 50
```
