import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
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
  onWelcomeSubmit?: (text: string) => void;
}

export function HistoryList({ messages, height, isThinking, currentModel, currentAgent }: Props) {
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
            <Text key={i} color="cyan" bold>{line}</Text>
          ))}
        </Box>

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
  const visibleMessages = messages
    .filter(msg => !msg.content.startsWith('<tool>') && !(msg.role === 'user' && msg.content.startsWith('Resultado de ')))
    .slice(-(height - 2))
    .map(msg => ({
      ...msg,
      content: msg.content.replace(/<tool>.*?<\/tool>\s*<args>.*?<\/args>/gs, '').trim()
    }));

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {visibleMessages.map((msg, i) => {
        const isUser = msg.role === 'user';

        // Thinking line inside assistant message
        const thinkingMatch = !isUser && msg.content.match(/^Thinking:\s*(.+)/m);

        return (
          <Box key={i} flexDirection="column" marginBottom={1}>
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