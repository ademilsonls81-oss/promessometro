import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { ChatEngine } from './chat-engine.js';
import { getConfig } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

interface AgentDef {
  name: string;
  systemPrompt: string;
}

function loadAgents(cwd: string): AgentDef[] {
  const agents: AgentDef[] = [];
  const agentDir = path.join(cwd, '.agent');

  if (fs.existsSync(agentDir)) {
    const files = fs.readdirSync(agentDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(agentDir, file), 'utf-8');
        const data = JSON.parse(raw);
        const name = path.basename(file, '.json').toUpperCase();
        const systemPrompt = data.systemPrompt || data.prompt || '';
        if (systemPrompt) agents.push({ name, systemPrompt });
      } catch {
        // ignora arquivos inválidos
      }
    }
  }

  // Fallback: agente genérico
  if (agents.length === 0) {
    agents.push({
      name: 'ARQUITETO',
      systemPrompt: 'Você é um coding agent especialista. Analise o projeto e ajude o usuário.',
    });
  }

  return agents;
}

export async function startZenTui() {
  const cwd = process.cwd();
  const cfg = getConfig();
  const agents = loadAgents(cwd);
  const initialAgent = agents[0].name;
  const initialModel = cfg.model || 'llama-3.3-70b-versatile';
  const chatEngine = new ChatEngine(initialAgent, initialModel);
  const { waitUntilExit } = render(<App chatEngine={chatEngine} />, {
    patchConsole: true,
  });
  await waitUntilExit();
}