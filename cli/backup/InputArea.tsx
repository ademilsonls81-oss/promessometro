import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { getConfig } from '../config.js';

const COMMAND_SUGGESTIONS = ['/help', '/connect', '/model', '/agent', '/status', '/clear'];

interface Props {
  onEnter: (message: string) => void;
  isThinking: boolean;
  currentModel: string;
}

export function InputArea({ onEnter, isThinking, currentModel }: Props) {
  const [query, setQuery] = useState('');
  const cfg = getConfig();
  const provider = cfg.provider || 'groq';
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  const handleSubmit = (value: string) => {
    if (!value.trim() || isThinking) return;
    onEnter(value);
    setQuery('');
  };

  const showCommands = query.startsWith('/');
  const filteredCommands = COMMAND_SUGGESTIONS.filter((c) =>
    c.startsWith(query || '/'),
  ).slice(0, 6);

  return (
    <Box flexDirection="column" width="100%">
      {/* Command suggestions */}
      {showCommands && (
        <Box paddingX={2} marginBottom={0}>
          <Text color="gray">
            {filteredCommands.join('  ') || '/help /connect /model /agent /status /clear'}
          </Text>
        </Box>
      )}
      {/* Main input bar */}
      <Box
        borderStyle="single"
        borderColor={isThinking ? 'yellow' : 'blue'}
        paddingX={1}
        width="100%"
      >
        <Box flexGrow={1}>
          {isThinking ? (
            <Text color="gray">Processing...</Text>
          ) : (
            <TextInput
              value={query}
              onChange={setQuery}
              onSubmit={handleSubmit}
              placeholder="Ask anything..."
            />
          )}
        </Box>
      </Box>
      {/* Status bar */}
      <Box paddingX={1}>
        <Text color="cyan">Build</Text>
        <Text color="gray"> · </Text>
        <Text color="white">{currentModel}</Text>
        <Text color="gray"> </Text>
        <Text color="white">{providerLabel}</Text>
        <Text color="gray"> Zen</Text>
      </Box>
    </Box>
  );
}