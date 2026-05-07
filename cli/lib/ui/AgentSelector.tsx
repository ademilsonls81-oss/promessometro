import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import * as fs from 'fs';
import * as path from 'path';

interface AgentInfo {
  id: string;
  name: string;
  description: string;
}

function loadAgents(): AgentInfo[] {
  const agents: AgentInfo[] = [
    { id: 'build', name: 'build', description: 'Default full-access coding agent' },
    { id: 'plan', name: 'plan', description: 'Read-only analysis and planning' },
  ];

  try {
    const agentDir = path.join(process.cwd(), '.agent');
    if (fs.existsSync(agentDir)) {
      const files = fs.readdirSync(agentDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(agentDir, file), 'utf-8');
          const data = JSON.parse(raw);
          const id = path.basename(file, '.json').toLowerCase();
          const name = id;
          const description = data.description || data.systemPrompt?.slice(0, 60) || '';
          if (!agents.find((a) => a.id === id)) {
            agents.push({ id, name, description });
          }
        } catch {
          // ignore invalid files
        }
      }
    }
  } catch {
    // ignore
  }

  return agents;
}

interface Props {
  currentAgent: string;
  onSelect: (agentId: string) => void;
  onClose: () => void;
}

export function AgentSelector({ currentAgent, onSelect, onClose }: Props) {
  const agents = loadAgents();
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = agents.findIndex((a) => a.id === currentAgent.toLowerCase());
    return idx >= 0 ? idx : 0;
  });

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : agents.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < agents.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      if (agents[selectedIndex]) {
        onSelect(agents[selectedIndex].id);
      }
    }
  });

  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
    >
      <Box flexDirection="column" width={60}>
        <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={0}>
          <Box flexGrow={1}>
            <Text bold color="cyan">Switch agent</Text>
          </Box>
          <Text color="gray">esc</Text>
        </Box>
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
          {agents.map((agent, idx) => {
            const isSelected = idx === selectedIndex;
            const isCurrent = agent.id === currentAgent.toLowerCase();
            return (
              <Box key={agent.id}>
                <Text color={isCurrent ? 'cyan' : 'gray'}>
                  {isCurrent ? '✓ ' : '  '}
                </Text>
                <Text
                  bold={isSelected}
                  color={isSelected ? 'cyan' : 'white'}
                  backgroundColor={isSelected ? '#333' : undefined}
                >
                  {agent.name.padEnd(16)}
                </Text>
                <Text color="gray">{agent.description.slice(0, 32)}</Text>
              </Box>
            );
          })}
        </Box>
        <Box marginTop={0}>
          <Text color="gray">↑↓ Navigate · Enter Select · Esc Close</Text>
        </Box>
      </Box>
    </Box>
  );
}
