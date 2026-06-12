# Camada 2 — Indicadores (C2)

Peso na nota final: **35%**

## Indicadores por Categoria

### Segurança (peso 0,30 dentro de C2)
| Indicador | Peso | Descrição |
|-----------|------|-----------|
| Taxa de homicídios por 100k hab | 0,40 | Quanto menor, melhor |
| Efetivo policial por 100k hab | 0,30 | Quanto maior, melhor |
| Investimento em segurança (R$/hab) | 0,30 | Quanto maior, melhor |

### Finanças (peso 0,25 dentro de C2)
| Indicador | Peso | Descrição |
|-----------|------|-----------|
| Receita corrente real (crescimento %) | 0,35 | Variação anual |
| Dívida pública / RCL | 0,35 | Quanto menor, melhor |
| Investimento / RCL | 0,30 | Quanto maior, melhor |

### Funcionalismo (peso 0,20 dentro de C2)
| Indicador | Peso | Descrição |
|-----------|------|-----------|
| Servidores ativos por 100k hab | 0,35 | Ideal: próximo da mediana nacional |
| Gasto com folha / RCL | 0,40 | Limite LRF: 49% (estados) / 54% (municípios) |
| Concursos realizados no mandato | 0,25 | Quanto maior, melhor |

### Educação (peso 0,15 dentro de C2)
| Indicador | Peso | Descrição |
|-----------|------|-----------|
| IDEB (anos finais) | 0,50 | Evolução no mandato |
| Taxa de abandono escolar | 0,50 | Quanto menor, melhor |

### Saúde (peso 0,10 dentro de C2)
| Indicador | Peso | Descrição |
|-----------|------|-----------|
| Taxa de mortalidade infantil | 0,50 | Quanto menor, melhor |
| Cobertura ESF (%) | 0,50 | Quanto maior, melhor |

## Cálculo do C2

Para cada categoria, normalizar cada indicador para 0-100:
- Indicador "quanto maior, melhor": `nota = (valor - mínimo) / (máximo - mínimo) × 100`
- Indicador "quanto menor, melhor": `nota = (máximo - valor) / (máximo - mínimo) × 100`

```
C2 = Σ (peso_categoria × nota_categoria)
```
