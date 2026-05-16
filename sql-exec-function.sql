-- Criar função para executar SQL arbitrário (executar no Supabase SQL Editor)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- Permitir execução (opcional: restringir por role)
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;