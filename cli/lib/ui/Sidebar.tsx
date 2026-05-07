import React from 'react';
import { Box, Text } from 'ink';
import { getConfig } from '../config.js';

interface SidebarState {
  currentAgent: string;
  currentModel: string;
  isThinking: boolean;
  tokens: { input: number; output: number };
}

export function Sidebar({ state }: { state: SidebarState }) {
  const cfg = getConfig();
  const provider = cfg.provider || 'groq';
  const tokensTotal = state.tokens.input + state.tokens.output;
  const contextWindow = 128000;
  const usedPct = Math.min(100, Math.round((tokensTotal / contextWindow) * 100));
  const costEst = ((tokensTotal / 1000) * 0.0001).toFixed(2);
  const agentLabel =
    state.currentAgent.charAt(0).toUpperCase() +
    state.currentAgent.slice(1).toLowerCase();

  return (
    <Box flexDirection="column" width={30} paddingX={1} paddingY={1}>
      {/* Agent title */}
      <Box marginBottom={1}>
        <Text color="white" bold>{agentLabel}</Text>
        <Text color="gray"> message</Text>
      </Box>
      {/* Context block */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">Context</Text>
        <Text color="gray">{tokensTotal.toLocaleString()} tokens</Text>
        <Text color="gray">{usedPct}% used</Text>
        <Text color="gray">${costEst} spent</Text>
      </Box>
      {/* LSP block */}
      <Box flexDirection="column">
        <Text bold color="white">LSP</Text>
        <Text color="gray">
          {state.isThinking ? 'Processing...' : 'LSPs will activate as files are read'}
        </Text>
      </Box>
    </Box>
  );
}