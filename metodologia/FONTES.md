# Fontes — Níveis e Regras

## Níveis de Fonte (1 a 5)

| Nível | Tipo | Exemplos | Confiabilidade |
|-------|------|----------|----------------|
| 5 | Fonte oficial primária | Diário Oficial, lei publicada, decreto assinado, decisão judicial | Máxima |
| 4 | Fonte oficial secundária | Relatório de tribunal de contas, dados do IBGE/INEP/IPEA, portal da transparência | Alta |
| 3 | Imprensa de referência | Matéria jornalística em veículo de grande circulação (Folha, Estadão, Globo, UOL) | Média-Alta |
| 2 | Imprensa local/especializada | Jornal regional, blog especializado, newsletter setorial | Média |
| 1 | Fonte não verificada | Rede social do político, release de assessoria, blog não identificado | Baixa |

## Regra das 2 Fontes Independentes

Para que uma promessa seja marcada como **cumprida**, é **obrigatório**:

1. No mínimo **2 fontes** diferentes
2. As fontes devem ser de **níveis diferentes**
   - Válido: nível 5 + nível 3 (Diário Oficial + matéria jornalística)
   - Válido: nível 4 + nível 2 (relatório TCU + imprensa local)
   - Inválido: nível 1 + nível 1 (duas redes sociais)
   - Inválido: nível 3 + nível 3 (duas matérias do mesmo jornal)
3. Fontes do mesmo veículo não contam como independentes
4. A fonte de nível mais alto define o **teto de confiança** da verificação

## Registro no Template

Cada promessa deve registrar no campo `fontes` o par de fontes utilizado:

```
fontes: "Fonte A (nível 5) + Fonte B (nível 3)"
```
