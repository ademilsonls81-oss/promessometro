# Legado e Score de Mandato — Promessômetro v1.1

## Score de Mandato

O **Score_Mandato** é a nota final de um político em UM mandato específico:

```
Score_Mandato = (C1 × 0,40) + (C2 × 0,35) + (C3 × 0,25)
```

Onde:
- **C1** = Cumprimento de promessas (0-100)
- **C2** = Indicadores (0-100)
- **C3** = Score jurídico (0-100)

## Legado Total

O **Legado_Total** é a média ponderada dos Scores de Mandato ao longo da carreira:

```
Legado_Total = Σ (Score_Mandato_n × peso_n) / Σ peso_n
```

Onde o peso de cada mandato é:
- Mandato atual: peso 1,0
- Mandato anterior: peso 0,7
- 2 mandatos atrás: peso 0,5
- 3+ mandatos atrás: peso 0,3

### Rationale

Mandatos mais recentes têm maior peso porque:
1. Refletem o comportamento político atual
2. Dados são mais precisos e verificáveis
3. Penalidades prescrevem com o tempo

## Atualização

- O `c3_score` e `nota_final` no arquivo do político são **recalculados** sempre que:
  1. Uma promessa muda de status
  2. Um novo fato jurídico é registrado
  3. Um novo dado de indicador é publicado
  4. Ao final de cada mandato (transição)
