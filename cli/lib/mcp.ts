import { getConfig } from './config.js';

export interface MCPConfig {
  enabled: boolean;
  url?: string;
  command?: string;
  args?: string[];
}

export interface MCPServerConfig {
  [name: string]: {
    type: 'remote' | 'stdio';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
}

const store = getConfig();

const defaultMCP: MCPServerConfig = {
  'files': {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', './'],
  },
};

export function getMCPConfig(): MCPServerConfig {
  const mcp = (store as any).mcp || {};
  return { ...defaultMCP, ...mcp };
}

export function setMCPConfig(name: string, config: MCPServerConfig[string]) {
  const mcp = getMCPConfig();
  mcp[name] = config;
  (store as any).mcp = mcp;
}

export function removeMCPConfig(name: string) {
  const mcp = getMCPConfig();
  delete mcp[name];
  (store as any).mcp = mcp;
}

export async function listMCPServers(): Promise<string[]> {
  const mcp = getMCPConfig();
  return Object.keys(mcp);
}

export { defaultMCP };