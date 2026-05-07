# 🗳️ Promessômetro

O **Promessômetro** é uma plataforma de transparência política voltada para o povo brasileiro. Nosso objetivo é rastrear, validar e expor o cumprimento (ou descumprimento) das promessas feitas por políticos durante suas campanhas e mandatos.

## 🚀 Funcionalidades

- **Ranking de Fidelidade:** Veja quais políticos realmente cumprem o que prometem.
- **Detalhamento por Político:** Histórico completo de promessas com evidências reais.
- **Validação por IA:** Monitoramento automatizado de notícias e diários oficiais.
- **Participação Popular:** Sugira novas promessas ou envie evidências de atualizações.
- **Design Moderno:** Interface de alta performance com estética premium para facilitar a consulta.

## 🛠️ Tecnologias

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Banco de Dados:** Supabase (PostgreSQL)
- **IA:** OpenAI / Groq (Llama-3.1) para análise de fatos.

## 💻 Como Rodar Localmente

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Configure o Banco de Dados:**
   - Execute o script em `supabase/promessometro_schema.sql` no seu console do Supabase.
3. **Variáveis de Ambiente:**
   - Configure seu `.env` com as chaves do Supabase e sua API Key da Groq/OpenAI.
4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

---
*Construído com o objetivo de trazer mais transparência para a democracia brasileira.*
