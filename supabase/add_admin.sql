-- =============================================
-- Adicionar usuário como admin
-- Executar no Editor SQL do Supabase
-- =============================================

-- 1. Primeiro, identificar o usuário pelo email
-- procura na tabela auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'ademilsonls81@gmail.com';

-- 2. Se existir, inserir/atualizar na tabela users com role admin
-- Assumindo que a tabela users existe
INSERT INTO users (id, email, role, created_at, updated_at)
SELECT 
  id, 
  email, 
  'admin', 
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'ademilsonls81@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Verificar se foi adicionado
SELECT * FROM users WHERE email = 'ademilsonls81@gmail.com';