import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export interface Subagent {
  name: string;
  description: string;
  prompt: string;
  model?: string;
  mode: 'primary' | 'subagent';
  hidden?: boolean;
  color?: string;
}

const SUBAGENTS_DIR = '.aifeast/agents';

export function getSubagentsDir(): string {
  return path.join(os.homedir(), SUBAGENTS_DIR);
}

export const defaultSubagents: Record<string, Subagent> = {
  explore: {
    name: 'explore',
    description: 'Explora arquivos e estrutura do projeto (apenas leitura)',
    prompt: `Você é um agente de exploração. Suas regras:
- Use APENAS ferramentas de leitura (read_file, list_files, search_in_files)
- NÃO modifique nenhum arquivo
- NÃO execute comandos que façam alterações
- Retorne um resumo da estrutura e temuan interesting do projeto
- Se precisar fazer algo além de ler, peça ao agente principal`,
    mode: 'subagent',
    color: '#3b82f6',
  },
  general: {
    name: 'general',
    description: 'Agente multi-tarefas para tarefas gerais',
    prompt: `Você é um agente geral. Suas regras:
- Pode usar todas as ferramentas
- Foca em completar a tarefa de forma eficiente
- Pergunte ao usuário Clarifications se necessário`,
    mode: 'subagent',
    color: '#10b981',
  },
  'code-reviewer': {
    name: 'code-reviewer',
    description: 'Revisa código em busca de problemas',
    prompt: `Você é um revisor de código. Suas regras:
- Use apenas ferramentas de leitura
- Analise qualidade, bugs potenciales, performance
- NÃO faça alterações diretamente
- Forneça feedback construtivo`,
    mode: 'subagent',
    color: '#f59e0b',
  },
};

export async function loadSubagents(cwd: string): Promise<Record<string, Subagent>> {
  const subagents = { ...defaultSubagents };
  
  const projectAgentsDir = path.join(cwd, '.agent');
  const globalAgentsDir = getSubagentsDir();
  const dirs = [projectAgentsDir, globalAgentsDir];
  
  for (const dir of dirs) {
    if (!await fs.pathExists(dir)) continue;
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      
      try {
        const agentPath = path.join(dir, entry.name);
        const content = await fs.readFile(agentPath, 'utf-8');
        const agent = JSON.parse(content);
        const name = entry.name.replace('.json', '');
        subagents[name] = { ...agent, name };
      } catch (error) {
        console.error(`Erro ao carregar agente ${entry.name}:`, error);
      }
    }
  }
  
  return subagents;
}

export async function listSubagents(cwd: string): Promise<string[]> {
  const subagents = await loadSubagents(cwd);
  return Object.keys(subagents).filter(name => !subagents[name].hidden);
}

export async function getSubagent(cwd: string, name: string): Promise<Subagent | null> {
  const subagents = await loadSubagents(cwd);
  return subagents[name] || null;
}

export function buildSubagentPrompt(subagents: Record<string, Subagent>): string {
  const agentList = Object.entries(subagents)
    .filter(([_, a]) => !a.hidden)
    .map(([name, a]) => `- @${name}: ${a.description}`)
    .join('\n');
  
  return `SUBAGENTS:\nInvoque com @menção, ex: @explore encontrar arquivos\n${agentList}`;
}