# Fórmula da Nota Final — Promessômetro v1.1

## As 3 Camadas

| Camada | Componente | Peso | Descrição |
|--------|-----------|------|-----------|
| C1 | Cumprimento de Promessas | 40% | Percentual de promessas cumpridas vs prometidas |
| C2 | Indicadores | 35% | Evolução dos indicadores objetivos por categoria |
| C3 | Fatos Jurídicos | 25% | Penalidades por condenações, infrações e irregularidades |

## Fórmula

```
Nota_Final = (C1 × 0,40) + (C2 × 0,35) + (C3 × 0,25)
```

Onde:

- **C1** (0 a 100) = Percentual de promessas cumpridas, calculado como:
  ```
  C1 = (cumpridas + parcial × 0,5) / total × 100
  ```
  - cumprida = 1,0 ponto
  - parcial = 0,5 ponto
  - pendente = 0 ponto
  - descumprida = 0 ponto

- **C2** (0 a 100) = Média ponderada dos indicadores de todas as categorias, normalizada para 0-100

- **C3** (0 a 100) = Score jurídico, iniciando em 100 e decrescendo conforme fatos:
  ```
  C3 = max(0, 100 - soma_penalidades)
  ```

## Grade Final

| Nota | Conceito | Significado |
|------|----------|-------------|
| 80-100 | A | Excelente — cumpriu promessas, entregou resultados, sem condenações |
| 60-79 | B | Bom — maioria cumprida, indicadores positivos |
| 40-59 | C | Regular — metade cumprida, resultados mistos |
| 20-39 | D | Ruim — poucas promessas cumpridas, indicadores negativos |
| 0-19 | F | Péssimo — não cumpriu, condenações graves |
