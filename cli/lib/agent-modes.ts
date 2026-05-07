export enum AgentMode {
  BUILD = 'build',
  PLAN = 'plan',
}

export interface AgentConfig {
  mode: AgentMode;
  description: string;
  tools: {
    read_file: boolean;
    write_file: boolean;
    patch_file: boolean;
    list_files: boolean;
    search_in_files: boolean;
    run_command: boolean;
  };
  permission: {
    read_file: 'allow' | 'ask' | 'deny';
    write_file: 'allow' | 'ask' | 'deny';
    patch_file: 'allow' | 'ask' | 'deny';
    list_files: 'allow' | 'ask' | 'deny';
    search_in_files: 'allow' | 'ask' | 'deny';
    run_command: 'allow' | 'ask' | 'deny';
  };
}

export const agentConfigs: Record<AgentMode, AgentConfig> = {
  [AgentMode.BUILD]: {
    mode: AgentMode.BUILD,
    description: 'Modo construção - todas ferramentas habilitadas',
    tools: {
      read_file: true,
      write_file: true,
      patch_file: true,
      list_files: true,
      search_in_files: true,
      run_command: true,
    },
    permission: {
      read_file: 'allow',
      write_file: 'allow',
      patch_file: 'allow',
      list_files: 'allow',
      search_in_files: 'allow',
      run_command: 'allow',
    },
  },
  [AgentMode.PLAN]: {
    mode: AgentMode.PLAN,
    description: 'Modo planejamento - apenas análise (pede permissão)',
    tools: {
      read_file: true,
      write_file: false,
      patch_file: false,
      list_files: true,
      search_in_files: true,
      run_command: false,
    },
    permission: {
      read_file: 'allow',
      write_file: 'deny',
      patch_file: 'deny',
      list_files: 'allow',
      search_in_files: 'allow',
      run_command: 'deny',
    },
  },
};

export function getAgentConfig(mode: AgentMode): AgentConfig {
  return agentConfigs[mode];
}

export function canUseTool(mode: AgentMode, tool: string): boolean {
  const config = agentConfigs[mode];
  return config.tools[tool as keyof typeof config.tools] === true;
}

export function getToolPermission(mode: AgentMode, tool: string): 'allow' | 'ask' | 'deny' {
  const config = agentConfigs[mode];
  return config.permission[tool as keyof typeof config.permission];
}