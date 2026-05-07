import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getConfig } from '../config.js';

// Slash commands that appear as autocomplete suggestions
const COMMAND_SUGGESTIONS = [
  { label: '/agents',  description: 'Switch agent' },
  { label: '/connect', description: 'Connect provider' },
  { label: '/models',  description: 'Switch model' },
  { label: '/new',     description: 'New session' },
  { label: '/clear',   description: 'Clear history' },
  { label: '/status',  description: 'Connection status' },
  { label: '/export',  description: 'Export as markdown' },
  { label: '/help',    description: 'Show help' },
  { label: '/exit',    description: 'Exit AIFeast' },
];

// Commands that open specific overlays instead of going to ChatEngine
const COMMAND_OVERLAYS: Record<string, string> = {
  '/connect': 'PROVIDER_LIST',
  '/models':  'MODEL_LIST',
  '/model':   'MODEL_LIST',
  '/agents':  'AGENT_LIST',
  '/agent':   'AGENT_LIST',
};

interface Props {
  onEnter: (message: string) => void;
  onEscape?: () => void;
  isThinking: boolean;
  currentModel: string;
  currentProvider?: string;
  visible?: boolean;
  disabled?: boolean;
  onOverlayRequest?: (overlay: string) => void;
}

export function InputArea({
  onEnter,
  onEscape,
  isThinking,
  currentModel,
  currentProvider,
  visible = true,
  disabled = false,
  onOverlayRequest,
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const cfg = getConfig();
  const provider = currentProvider || cfg.provider || 'groq';
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  const showSuggestions = query.startsWith('/') && !disabled;
  const filteredSuggestions = COMMAND_SUGGESTIONS.filter((c) =>
    c.label.startsWith(query || '/'),
  ).slice(0, 6);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Dispatch a command — either open an overlay or send to ChatEngine
  const dispatchCommand = useCallback(
    (cmd: string) => {
      const overlayKey = COMMAND_OVERLAYS[cmd];
      if (overlayKey && onOverlayRequest) {
        setQuery('');
        onOverlayRequest(overlayKey);
      } else {
        // Slash commands that go to ChatEngine (/help, /clear, /new, etc.)
        onEnter(cmd);
        setQuery('');
      }
    },
    [onEnter, onOverlayRequest],
  );

  useInput(
    (input, key) => {
      if (disabled || isThinking) return;

      // Ctrl+P → open Command Palette
      if (key.ctrl && input === 'p') {
        onOverlayRequest?.('COMMANDS');
        return;
      }

      if (key.escape) {
        if (query.startsWith('/')) {
          setQuery('');
          return;
        }
        onEscape?.();
        return;
      }

      // When suggestion list is open, intercept navigation + Enter
      if (showSuggestions && filteredSuggestions.length > 0) {
        if (key.upArrow) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
          return;
        } else if (key.downArrow) {
          setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
          return;
        } else if (key.return) {
          // Select highlighted suggestion and dispatch
          const selected = filteredSuggestions[selectedIndex];
          if (selected) {
            dispatchCommand(selected.label);
          }
          return;
        } else if (key.tab) {
          // Tab just autocompletes without dispatching
          if (filteredSuggestions[selectedIndex]) {
            setQuery(filteredSuggestions[selectedIndex].label);
          }
          return;
        }
      }
    },
    { isActive: true },
  );

  // Called by TextInput when user presses Enter with NO suggestion selected
  // (i.e., they typed the full command manually)
  const handleSubmit = useCallback(
    (value: string) => {
      if (!value.trim() || isThinking || disabled) return;
      dispatchCommand(value.trim());
    },
    [dispatchCommand, isThinking, disabled],
  );

  if (!visible) return null;

  // Truncate model name to avoid wrapping
  const shortModel = currentModel.length > 20 ? currentModel.slice(0, 18) + '…' : currentModel;

  return (
    <Box flexDirection="column" width={60}>
      {/* Slash command suggestions list */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <Box flexDirection="column" marginBottom={0} paddingX={1}>
          {filteredSuggestions.map((cmd, idx) => (
            <Box key={cmd.label}>
              <Text color={idx === selectedIndex ? 'cyan' : 'gray'}>
                {idx === selectedIndex ? '〉' : '  '}
              </Text>
              <Text bold color={idx === selectedIndex ? 'cyan' : 'white'}>
                {cmd.label.padEnd(10)}
              </Text>
              <Text color="gray"> {cmd.description}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Input box — blue left border like OpenCode */}
      <Box
        borderStyle="single"
        borderColor={isThinking || disabled ? 'yellow' : 'blue'}
        paddingX={1}
        width="100%"
      >
        <Box flexGrow={1} overflow="hidden">
          {isThinking ? (
            <Text color="gray">Processing...</Text>
          ) : disabled ? (
            <Text color="gray">Press Esc to close</Text>
          ) : (
            <TextInput
              value={query}
              onChange={setQuery}
              onSubmit={handleSubmit}
              placeholder='Ask anything... "Fix broken tests"'
            />
          )}
        </Box>
      </Box>

      {/* Status bar — single line, compact */}
      <Box paddingX={1}>
        <Text color="cyan">Build</Text>
        <Text color="gray"> · </Text>
        <Text color="white">{shortModel}</Text>
        <Text color="gray"> </Text>
        <Text color="white">{providerLabel}</Text>
        <Text color="gray"> Zen</Text>
      </Box>
    </Box>
  );
}