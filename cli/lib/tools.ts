import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

export const SLASH_COMMANDS = [
  { name: '/help', description: 'Lista os comandos do terminal' },
  { name: '/model <nome>', description: 'Troca o modelo atual' },
  { name: '/agent <nome>', description: 'Troca o agente atual' },
  { name: '/status', description: 'Mostra provider, modelo e agente ativos' },
  { name: '/clear', description: 'Limpa o historico da sessao' },
  { name: '/mcp list', description: 'Lista servidores MCP configurados' },
  { name: '/mcp add <nome> <url>', description: 'Adiciona um servidor MCP' },
  { name: '/mcp remove <nome>', description: 'Remove um servidor MCP' },
  { name: '/skills', description: 'Lista skills disponiveis' },
  { name: '/skill <nome>', description: 'Ativa uma skill' },
  { name: '/build', description: 'Modo Build - todas ferramentas' },
  { name: '/plan', description: 'Modo Plan - apenas ler e analisar' },
  { name: '/snapshot', description: 'Lista snapshots' },
  { name: '/snapshot restore <id>', description: 'Restaura um snapshot' },
  { name: '/snapshot delete <id>', description: 'Deleta um snapshot' },
];

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export const tools = [
  {
    name: 'read_file',
    description: 'Ler conteudo de um arquivo',
    execute: async ({ path: filePath }: { path: string }, cwd: string) => {
      const full = path.resolve(cwd, filePath);
      if (!await fs.pathExists(full)) return `Arquivo nao encontrado: ${filePath}`;
      const content = await fs.readFile(full, 'utf-8');
      return `=== ${filePath} ===\n${content}`;
    },
  },
  {
    name: 'write_file',
    description: 'Criar ou sobrescrever um arquivo',
    execute: async ({ path: filePath, content }: { path: string; content: string }, cwd: string) => {
      const full = path.resolve(cwd, filePath);
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, content, 'utf-8');
      return `Arquivo salvo: ${filePath}`;
    },
  },
  {
    name: 'list_files',
    description: 'Listar arquivos do projeto',
    execute: async ({ pattern = '**/*', ignore = ['node_modules/**', '.git/**', 'dist/**'] }: { pattern?: string; ignore?: string[] }, cwd: string) => {
      const files = await glob(pattern, { cwd, ignore, nodir: true });
      return files.slice(0, 100).join('\n');
    },
  },
  {
    name: 'run_command',
    description: 'Executar um comando shell',
    execute: async ({ command }: { command: string }, cwd: string) => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      try {
        const { stdout, stderr } = await execAsync(command, { cwd, timeout: 30000 });
        return stdout || stderr || '(sem output)';
      } catch (error) {  // any-ok
        return `Erro: ${error.message}`;
      }
    },
  },
  {
    name: 'search_in_files',
    description: 'Buscar texto em arquivos do projeto',
    execute: async ({ query, filePattern = '**/*.{ts,js,tsx,jsx,json}' }: { query: string; filePattern?: string }, cwd: string) => {
      const files = await glob(filePattern, { cwd, ignore: ['node_modules/**', '.git/**'], nodir: true });
      const results: string[] = [];
      for (const file of files.slice(0, 50)) {
        const content = await fs.readFile(path.join(cwd, file), 'utf-8').catch(() => '');
        if (!content.includes(query)) continue;
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes(query)) results.push(`${file}:${index + 1}: ${line.trim()}`);
        });
      }
      return results.length ? results.join('\n') : 'Nenhum resultado encontrado';
    },
  },
  {
    name: 'patch_file',
    description: 'Substituir um trecho especifico de um arquivo',
    execute: async ({ path: filePath, old_str, new_str }: { path: string; old_str: string; new_str: string }, cwd: string) => {
      const full = path.resolve(cwd, filePath);
      const content = await fs.readFile(full, 'utf-8');
      if (!content.includes(old_str)) return `Trecho nao encontrado em ${filePath}`;
      const updated = content.replace(old_str, new_str);
      await fs.writeFile(full, updated, 'utf-8');
      return `Patch aplicado em ${filePath}`;
    },
  },
];

export function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /<tool>([\w_]+)<\/tool>\s*<args>([\s\S]*?)<\/args>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(response)) !== null) {
    try {
      calls.push({ tool: match[1], args: JSON.parse(match[2]) });
    } catch {}
  }
  return calls;
}

export function buildSystemPrompt(cwd: string) {
  return `Você é um assistente de código para o projeto em: ${cwd}
OS: ${process.platform}
REGRAS OBRIGATÓRIAS:
1. Sempre que precisar ler, escrever ou executar algo, USE as tools abaixo. NUNCA finja ter feito algo.
2. Para usar uma tool, responda EXATAMENTE neste formato (sem texto antes ou depois):
<tool>NOME_DA_TOOL</tool><args>{"chave": "valor"}</args>
3. Após receber o resultado da tool, continue normalmente.
4. Seja conciso. Sem listas de comandos ou apresentações.

TOOLS DISPONÍVEIS:
- read_file: {"path": "caminho/arquivo"}
- write_file: {"path": "caminho", "content": "conteúdo"}
- patch_file: {"path": "caminho", "old_str": "antes", "new_str": "depois"}
- list_files: {"pattern": "**/*"}
- search_in_files: {"query": "texto"}
- run_command: {"command": "comando shell"}`;
}
