-- =============================================
-- Promessômetro - Script de Migração
-- Adiciona campos necessários à tabela promises existente
-- =============================================

-- 1. Adicionar colunas que não existem (IF NOT EXISTS não funciona para colunas, então usar блок)
DO $$
BEGIN
  -- Verificar e adicionar cada coluna apenas se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'nome_politico') THEN
    ALTER TABLE promises ADD COLUMN nome_politico VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'cargo') THEN
    ALTER TABLE promises ADD COLUMN cargo VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'partido') THEN
    ALTER TABLE promises ADD COLUMN partido VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'estado') THEN
    ALTER TABLE promises ADD COLUMN estado VARCHAR(2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'titulo') THEN
    ALTER TABLE promises ADD COLUMN titulo VARCHAR(500);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'texto_original') THEN
    ALTER TABLE promises ADD COLUMN texto_original TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'link_fonte') THEN
    ALTER TABLE promises ADD COLUMN link_fonte TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'categoria') THEN
    ALTER TABLE promises ADD COLUMN categoria VARCHAR(100) DEFAULT 'Outros';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'ano_eleitoral') THEN
    ALTER TABLE promises ADD COLUMN ano_eleitoral INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'data_promessa') THEN
    ALTER TABLE promises ADD COLUMN data_promessa DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'prazo_estimado') THEN
    ALTER TABLE promises ADD COLUMN prazo_estimado VARCHAR(255);
  END IF;
END $$;

-- 2. Copiar dados de politician_name para nome_politico se estiver vazio
UPDATE promises SET nome_politico = politician_name WHERE nome_politico IS NULL AND politician_name IS NOT NULL;
UPDATE promises SET titulo = promise_title WHERE titulo IS NULL AND promise_title IS NOT NULL;
UPDATE promises SET texto_original = promise_description WHERE texto_original IS NULL AND promise_description IS NOT NULL;
UPDATE promises SET link_fonte = source_link WHERE link_fonte IS NULL AND source_link IS NOT NULL;

-- 3. Copiar dados de politicians para promises
UPDATE promises p
SET partido = pol.partido,
    cargo = COALESCE(p.cargo, 'Presidente'),
    estado = pol.state
FROM politicians pol
WHERE p.nome_politico = pol.name
AND p.partido IS NULL;

-- 4. Seed de promessas de exemplo (apenas se não houver dados)
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM promises;
  IF cnt = 0 THEN
    INSERT INTO promises (nome_politico, cargo, partido, estado, titulo, texto_original, categoria, status, fulfillment_score, ano_eleitoral, link_fonte) VALUES
      ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', 'Zerar a fome no Brasil', 'Erradicar a fome e a pobreza extrema no país', 'Saúde', 'em_andamento', 65, 2022, 'https://plano2022.lula.com.br'),
      ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', '6 milhões de empregos', 'Criar 6 milhões de novos empregos formais', 'Trabalho', 'cumprida', 100, 2022, 'https://plano2022.lula.com.br'),
      ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', 'Reconhecer Venezuela', 'Reconhecer o governo venezuelano de Maduro', 'Relações Exteriores', 'descumprida', 0, 2022, NULL),
      ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', '100 anos de petróleo', 'Explorar petróleo do pré-sal pelos próximos 100 anos', 'Economia', 'nao_iniciada', 10, 2022, 'https://plano2022.bolsonaro.com.br'),
      ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', 'Armas para cidadãos', 'Liberar porte de armas para cidadãos de bem', 'Segurança', 'descumprida', 15, 2022, 'https://plano2022.bolsonaro.com.br'),
      ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', 'Imposto único', 'Implementar imposto único', 'Economia', 'nao_classificada', 0, 2022, NULL),
      ('Tarcísio Gomes de Freitas', 'Governador', 'PL', 'SP', 'Metrô linha 2', 'Completar a linha 2 do metrô de São Paulo', 'Transporte', 'em_andamento', 50, 2022, 'https://tarcisio.com.br'),
      ('Romeu Zema', 'Governador', 'NOVO', 'MG', 'Mil novas escolas', 'Construir mil novas escolas em Minas Gerais', 'Educação', 'nao_iniciada', 5, 2022, 'https://romeuzema.com.br'),
      ('Cláudia Lei', 'Governador', 'MDB', 'RJ', 'Segurança pública', 'Reduzir a criminalidade no Rio de Janeiro em 50%', 'Segurança', 'parcialmente_cumprida', 45, 2022, NULL);
  END IF;
END $$;

-- 5. Inserir políticos de exemplo
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM politicians;
  IF cnt = 0 THEN
    INSERT INTO politicians (nome, partido, cargo, estado) VALUES
      ('Luiz Inácio Lula da Silva', 'PT', 'Presidente', 'BR'),
      ('Jair Bolsonaro', 'PL', 'Presidente', 'BR'),
      ('Tarcísio Gomes de Freitas', 'PL', 'Governador', 'SP'),
      ('Romeu Zema', 'NOVO', 'Governador', 'MG');
  END IF;
END $$;