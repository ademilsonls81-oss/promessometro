-- =============================================
-- Promessômetro - Trigger para Criar Político Automático
-- Executar no Editor SQL do Supabase
-- =============================================

-- Função que cria político automaticamente quando uma promessa é inserida
CREATE OR REPLACE FUNCTION create_politician_if_not_exists()
RETURNS TRIGGER AS $$
DECLARE
  existing_politician RECORD;
BEGIN
  -- Verificar se o político já existe
  SELECT * INTO existing_politician 
  FROM politicians 
  WHERE nome ILIKE NEW.politician_name;

  -- Se não existir, criar automaticamente
  IF existing_politician IS NULL THEN
    INSERT INTO politicians (nome, partido, cargo, estado)
    VALUES (
      NEW.politician_name,
      NEW.party,
      COALESCE(NEW.cargo, 'Político'),
      NEW.state
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger
DROP TRIGGER IF EXISTS trigger_create_politician ON promises;
CREATE TRIGGER trigger_create_politician
AFTER INSERT ON promises
FOR EACH ROW
EXECUTE FUNCTION create_politician_if_not_exists();

-- Verificar se foi criado
SELECT 'Trigger criado com sucesso!' as status;