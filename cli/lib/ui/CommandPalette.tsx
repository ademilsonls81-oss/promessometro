import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Command {
  label: string;
  description: string;
  overlay?: string; // set if this command opens an overlay
}

// All commands — aligned with OpenCode image 4
const COMMANDS: Command[] = [
  { label: '/agents',  description: 'Switch agent',                        overlay: 'AGENT_LIST' },
  { label: '/connect', description: 'Connect provider',                    overlay: 'PROVIDER_LIST' },
  { label: '/models',  description: 'Switch model',                        overlay: 'MODEL_LIST' },
  { label: '/new',     description: 'New session' },
  { label: '/clear',   description: 'Clear chat history' },
  { label: '/status',  description: 'Show connection status' },
  { label: '/export',  description: 'Export chat as markdown' },
  { label: '/help',    description: 'Show help' },
  { label: '/exit',    description: 'Exit AIFeast' },
];

interface Props {
  onSelect: (overlay: string) => void; // called with overlay name OR slash command
  onClose: () => void;
}

export function CommandPalette({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('/');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (cmd: Command) => {
    if (cmd.overlay) {
      // Open a specific overlay
      onSelect(cmd.overlay);
      // Don't call onClose — App will handle it when the overlay mounts
    } else {
      // Pass the slash command string so App can route it to ChatEngine
      onSelect(cmd.label);
      onClose();
    }
  };

  useInput((input, key) => {
    if (key.return) {
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    } else if (key.escape) {
      onClose();
    } else if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    }
  });

  const height = Math.min(filteredCommands.length + 4, 18);

  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
    >
      <Box flexDirection="column" width={62}>
        {/* Header */}
        <Box borderStyle="round" borderColor="#f0a070" paddingX={2} paddingY={0} marginBottom={0}>
          <Text bold color="#f0a070">Command Palette</Text>
          <Box flexGrow={1} />
          <Text color="gray">esc</Text>
        </Box>

        {/* Body */}
        <Box borderStyle="round" borderColor="#f0a070" flexDirection="column" paddingX={2} paddingY={1}>
          {/* Search input */}
          <Box marginBottom={1}>
            <TextInput value={query} onChange={setQuery} placeholder="Type /command..." />
          </Box>

          {/* Command list */}
          <Box flexDirection="column">
            {filteredCommands.slice(0, 12).map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <Box key={cmd.label}>
                  <Text bold color={isSelected ? '#f0a070' : 'transparent'}>
                    {isSelected ? '/' : ' '}
                  </Text>
                  <Text
                    bold
                    color={isSelected ? '#f0a070' : 'white'}
                  >
                    {' '}{cmd.label.slice(1).padEnd(10)}
                  </Text>
                  <Text color="gray"> {cmd.description}</Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Footer */}
        <Box marginTop={0} paddingX={1}>
          <Text color="gray">↑↓ Navigate · Enter Select · Esc Close</Text>
        </Box>
      </Box>
    </Box>
  );
}