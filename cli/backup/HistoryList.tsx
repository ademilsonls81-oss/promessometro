import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { getConfig } from '../config.js';

const LOGO_LINES = [
  ' █████╗ ██╗    ███████╗███████╗ █████╗ ███████╗████████╗',
  '██╔══██╗██║    ██╔════╝██╔════╝██╔══██╗██╔════╝╚══██╔══╝',
  '███████║██║    █████╗  █████╗  ███████║███████╗   ██║   ',
  '██╔══██║██║    ██╔══╝  ██╔══╝  ██╔══██║╚════██║   ██║   ',
  '██║  ██║██║    ██║     ███████╗██║  ██║███████║   ██║   ',
  '╚═╝  ╚═╝╚═╝    ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝  ',
];

interface Message {
  role: string;
  content: string;
}

interface Props {
  messages: Message[];
  height: number;
  isThinking: boolean;
  currentModel: string;
  currentAgent: string;
  welcomeMode?: boolean;
  onWelcomeSubmit?: (msg: string) => void;
}

function WelcomeInput({ onSubmit, currentModel, provider }: {
  onSubmit: (msg: string) => void;
  currentModel: string;
  provider: string;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const COMMANDS = [
    { cmd: '/help', desc: 'Show help' },
    { cmd: '/connect', desc: 'Connect provider' },
    { cmd: '/model', desc: 'Switch model' },
    { cmd: '/agent', desc: 'Switch agent' },
    { cmd: '/status', desc: 'Show session status' },
    { cmd: '/clear', desc: 'Clear history' },
  ];

  const showMenu = query.startsWith('/');
  const filtered = COMMANDS.filter((c) => c.cmd.startsWith(query || '/'));

  useInput((input, key) => {
    if (!showMenu) return;
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev >= filtered.length - 1 ? 0 : prev + 1));
    }
    if (key.return && filtered[selectedIndex]) {
      onSubmit(filtered[selectedIndex].cmd);
      setQuery('');
      setSelectedIndex(0);
    }
  });

  const handleSubmit = (value: string) => {
    if (!value.trim()) return;
    if (showMenu && filtered[selectedIndex]) {
      onSubmit(filtered[selectedIndex].cmd);
      setQuery('');
      setSelectedIndex(0);
      return;
    }
    onSubmit(value);
    setQuery('');
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  return (
    <Box flexDirection="column" width={60} marginBottom={1}>
      {/* Menu de comandos navegável */}
      {showMenu && filtered.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {filtered.map((item, i) => (
            <Box key={item.cmd} paddingX={1}>
              <Box width={12}>
                <Text
                  color={i === selectedIndex ? 'black' : 'white'}
                  backgroundColor={i === selectedIndex ? 'cyan' : undefined}
                  bold={i === selectedIndex}
                >
                  {item.cmd}
                </Text>
              </Box>
              <Text
                color={i === selectedIndex ? 'black' : 'gray'}
                backgroundColor={i === selectedIndex ? 'cyan' : undefined}
              >
                {'  ' + item.desc}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {/* Input box */}
      <Box borderStyle="single" borderColor="blue" flexDirection="column">
        <Box paddingX={1}>
          <TextInput
            value={query}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder="Ask anything..."
          />
        </Box>
        <Box paddingX={1}>
          <Text color="cyan">Build</Text>
          <Text color="gray"> · </Text>
          <Text color="white">{currentModel}</Text>
          <Text color="gray"> </Text>
          <Text color="white">{provider}</Text>
          <Text color="gray"> Zen</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function HistoryList({
  messages,
  height,
  isThinking,
  currentModel,
  currentAgent,
  welcomeMode,
  onWelcomeSubmit,
}: Props) {
  const cfg = getConfig();
  const provider = cfg.provider || 'groq';
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  // ── WELCOME SCREEN ────────────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        {/* Logo */}
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
          {LOGO_LINES.map((line, i) => (
            <Text key={`logo-${i}`} color="cyan" bold>{line}</Text>
          ))}
        </Box>
        {/* Input box */}
        {welcomeMode && onWelcomeSubmit ? (
          <WelcomeInput
            onSubmit={onWelcomeSubmit}
            currentModel={currentModel}
            provider={providerLabel}
          />
        ) : (
          <Box
            flexDirection="column"
            width={60}
            borderStyle="single"
            borderColor="blue"
            marginBottom={1}
          >
            <Box paddingX={1}>
              <Text color="gray">Ask anything...</Text>
            </Box>
            <Box paddingX={1}>
              <Text color="cyan">Build</Text>
              <Text color="gray"> · </Text>
              <Text color="white">{currentModel}</Text>
              <Text color="gray"> </Text>
              <Text color="white">{providerLabel}</Text>
              <Text color="gray"> Zen</Text>
            </Box>
          </Box>
        )}
        {/* Shortcuts */}
        <Box marginBottom={1}>
          <Text color="gray">tab </Text>
          <Text color="white">agents</Text>
          <Text color="gray">  ctrl+p </Text>
          <Text color="white">commands</Text>
        </Box>
        {/* Tip */}
        <Box>
          <Text color="yellow">● Tip </Text>
          <Text color="gray">Run </Text>
          <Text color="white">/help</Text>
          <Text color="gray"> or </Text>
          <Text color="white">Ctrl+X H</Text>
          <Text color="gray"> to show the help dialog</Text>
        </Box>
      </Box>
    );
  }

  // ── CONVERSATION SCREEN ───────────────────────────────────────────────────
  const visibleMessages = messages.slice(-(height - 2));

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {visibleMessages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const key = `${msg.role}-${i}-${msg.content.slice(0, 8)}`;

        // Tool result — compact
        if (isUser && msg.content.startsWith('Resultado de ')) {
          return (
            <Box key={key} marginBottom={1} paddingLeft={2}>
              <Text color="gray" dimColor>
                {msg.content.slice(0, 120)}{msg.content.length > 120 ? '…' : ''}
              </Text>
            </Box>
          );
        }

        // Thinking line inside assistant message
        const thinkingMatch = !isUser && msg.content.match(/^Thinking:\s*(.+)/m);

        return (
          <Box key={key} flexDirection="column" marginBottom={1}>
            {isUser ? (
              // User message — simula borda esquerda azul com caractere
              <Box flexDirection="row">
                <Text color="blue">▌ </Text>
                <Text color="white">{msg.content}</Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                {thinkingMatch && (
                  <Box marginBottom={0}>
                    <Text color="yellow">Thinking: </Text>
                    <Text color="gray">{thinkingMatch[1]}</Text>
                  </Box>
                )}
                <Text color="white">
                  {msg.content.replace(/^Thinking:.*\n?/, '').trim()}
                </Text>
                {/* Build line abaixo da resposta */}
                <Box marginTop={0}>
                  <Text color="cyan">■ Build</Text>
                  <Text color="gray"> · </Text>
                  <Text color="white">{currentModel}</Text>
                  <Text color="gray"> · </Text>
                  <Text color="gray">{providerLabel} Zen</Text>
                </Box>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Spinner */}
      {isThinking && (
        <Box>
          <Text color="yellow"><Spinner type="dots" /></Text>
          <Text color="gray"> Thinking...</Text>
        </Box>
      )}
    </Box>
  );
}