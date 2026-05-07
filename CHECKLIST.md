### Checklist para AI-Feast-Engine (como OpenCode)

*   **1. Avaliação Inicial e Configuração do Ambiente:**
    *   [ ] Entender o estado atual do projeto `AI-Feast-Engine`.
    *   [ ] Identificar arquivos e componentes relevantes para UI, roteamento e integração de API.
    *   [ ] Confirmar ambiente de desenvolvimento local funcional.
    *   [ ] Rodar o aplicativo para ver o estado atual e identificar pontos de melhoria.
*   **2. Implementar Funcionalidade do Comando `/connect`:**
    *   [ ] Projetar/Implementar um componente de UI para listar provedores de IA e campos de entrada para chaves de API.
    *   [ ] Integrar este componente ao layout principal (provavelmente em `Layout.tsx`).
    *   [ ] Implementar lógica para exibir provedores existentes e status de conexão.
    *   [ ] Implementar armazenamento seguro para chaves de API.
    *   [ ] Lidar com o caso especial do Llama (sem chave de API).
    *   [ ] Adicionar o comando `/connect` para acionar esta UI.
*   **3. Implementar Paleta de Comandos (`/`):**
    *   [ ] Projetar/Implementar um componente de UI para a paleta de comandos.
    *   [ ] Integrar este componente ao layout principal.
    *   [ ] Implementar lógica para abrir a paleta quando `/` for digitado.
    *   [ ] Popular a paleta com comandos relevantes (ex: `/connect`, seleção de modelo, outras ações).
*   **4. Implementar Navegação em Carrossel de Modelos/Provedores:**
    *   [ ] Identificar onde a seleção de modelo/provedor ocorre.
    *   [ ] Projetar/Implementar um componente de UI de carrossel para modelos/provedores.
    *   [ ] Integrar o carrossel na parte apropriada da UI.
    *   [ ] Implementar lógica de navegação para o carrossel.
*   **5. Verificação e Correção Geral de Funcionalidade:**
    *   [ ] Revisar o código existente em busca de padrões e melhores práticas (Tailwind CSS, chamadas de API do Supabase).
    *   [ ] Corrigir quaisquer bugs ou desvios do "padrão OpenCode" identificados.
    *   [ ] Garantir que as chamadas de API estejam consistentes com o esquema do Supabase.
    *   [ ] Priorizar componentes leves e modernos para animações/UI.
*   **6. Testes:**
    *   [ ] Adicionar testes de unidade/integração para novas funcionalidades.
    *   [ ] Garantir que os testes existentes (se houver) passem.
