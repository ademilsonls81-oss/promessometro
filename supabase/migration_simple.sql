-- =============================================
-- Promessômetro - Script de Migração Simples
-- Executar no Editor SQL do Supabase
-- =============================================

-- 1. Migrar dados existentes (copiar colunas antigas para novas)
UPDATE promises SET nome_politico = politician_name WHERE nome_politico IS NULL OR nome_politico = '';
UPDATE promises SET titulo = promise_title WHERE titulo IS NULL OR titulo = '';

-- Se não tem dados, inserir exemplos
INSERT INTO promises (nome_politico, cargo, partido, estado, titulo, texto_original, categoria, status, fulfillment_score, ano_eleitoral)
SELECT 
  'Luiz Inácio Lula da Silva',
  'Presidente', 
  'PT', 
  'BR', 
  'Zerar a fome no Brasil', 
  'Erradicar a fome e a pobreza extrema no país',
  'Saúde',
  'em_andamento',
  65,
  2022
WHERE NOT EXISTS (SELECT 1 FROM promises WHERE nome_politico = 'Luiz Inácio Lula da Silva');

INSERT INTO promises (nome_politico, cargo, partido, estado, titulo, texto_original, categoria, status, fulfillment_score, ano_eleitoral)
SELECT 
  'Jair Bolsonaro',
  'Presidente', 
  'PL', 
  'BR', 
  'Armas para cidadãos', 
  'Liberar porte de armas para cidadãos de bem',
  'Segurança',
  'descumprida',
  15,
  2022
WHERE NOT EXISTS (SELECT 1 FROM promises WHERE nome_politico = 'Jair Bolsonaro');