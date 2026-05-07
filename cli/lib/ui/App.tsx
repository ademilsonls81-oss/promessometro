import React, { useEffect, useState } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { Sidebar } from './Sidebar.js';
import { HistoryList } from './HistoryList.js';
import { InputArea } from './InputArea.js';
import { CommandPalette } from './CommandPalette.js';
import { ProviderSelector } from './ProviderSelector.js';
import { ModelSelector } from './ModelSelector.js';
import { AgentSelector } from './AgentSelector.js';
import type { ChatEngine, ChatState } from '../chat-engine.js';

type Overlay = 'NONE' | 'COMMANDS' | 'PROVIDER_LIST' | 'MODEL_LIST' | 'AGENT_LIST';

const VERSION = '1.0.0';

export function App({ chatEngine }: { chatEngine: ChatEngine }) {
  const [state, setState] = useState<ChatState>(chatEngine.getState());
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout?.columns || 80);
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows || 24);
  const [activeOverlay, setActiveOverlay] = useState<Overlay>('NONE');

  useEffect(() => {
    const unsubscribe = chatEngine.subscribe(setState);

    const handleResize = () => {
      setTerminalHeight(stdout?.rows || 24);
      setTerminalWidth(stdout?.columns || 80);
    };
    stdout?.on('resize', handleResize);

    return () => {
      unsubscribe();
      stdout?.off('resize', handleResize);
    };
  }, [chatEngine, stdout]);

  useInput((input, key) => {
    // Ctrl+P → Command Palette (toggle)
    if (key.ctrl && input === 'p') {
      setActiveOverlay((prev) => (prev === 'COMMANDS' ? 'NONE' : 'COMMANDS'));
      return;
    }

    // Tab → open AgentSelector (only when no overlay is active)
    if (input === '\t' && activeOverlay === 'NONE') {
      setActiveOverlay('AGENT_LIST');
      return;
    }

    // NOTE: Esc is NOT handled globally here.
    // Each overlay handles its own Esc for back-navigation:
    //   ProviderSelector: key-step → Esc → provider-step → Esc → close
    //   CommandPalette:   Esc → close
    //   AgentSelector:    Esc → close
    //   ModelSelector:    Esc → close
    //   InputArea:        Esc with '/' → clear query
  });

  const handleOverlayRequest = (cmd: string) => {
    // If it's a known overlay name → open it
    if (['COMMANDS', 'PROVIDER_LIST', 'MODEL_LIST', 'AGENT_LIST'].includes(cmd)) {
      setActiveOverlay(cmd as Overlay);
      return;
    }
    // If it's a slash command → send to ChatEngine and close any overlay
    if (cmd.startsWith('/')) {
      setActiveOverlay('NONE');
      chatEngine.sendMessage(cmd);
      return;
    }
  };

  const handleModelSelect = (modelId: string) => {
    chatEngine.setModel(modelId);
    setActiveOverlay('NONE');
  };

  const handleAgentSelect = (agentId: string) => {
    chatEngine.setAgent(agentId.toUpperCase());
    setActiveOverlay('NONE');
  };

  const handleProviderClose = () => {
    // Re-sync state after provider change
    setState({ ...chatEngine.getState() });
    setActiveOverlay('NONE');
  };

  const renderOverlay = () => {
    switch (activeOverlay) {
      case 'COMMANDS':
        return (
          <CommandPalette
            onSelect={handleOverlayRequest}
            onClose={() => setActiveOverlay('NONE')}
          />
        );
      case 'PROVIDER_LIST':
        return (
          <ProviderSelector
            onClose={handleProviderClose}
          />
        );
      case 'MODEL_LIST':
        return (
          <ModelSelector
            onSelect={handleModelSelect}
            onCancel={() => setActiveOverlay('NONE')}
          />
        );
      case 'AGENT_LIST':
        return (
          <AgentSelector
            currentAgent={state.currentAgent}
            onSelect={handleAgentSelect}
            onClose={() => setActiveOverlay('NONE')}
          />
        );
      default:
        return null;
    }
  };

  const isOverlayActive = activeOverlay !== 'NONE';
  // Only switch to conversation screen when user has sent a REAL message to the AI
  // Slash command outputs (/help, /status etc.) do NOT count as real conversation
  const hasMessages = state.hasRealMessages;

  // Rodapé inferior com path e versão (igual ao OpenCode)
  const cwd = process.cwd();
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const shortCwd = cwd.replace(homeDir, '~').replace(/\\/g, '/');
  const footerRight = `v${VERSION}`;

  // Welcome screen
  if (!hasMessages) {
    return (
      <Box flexDirection="column" width="100%" height={terminalHeight}>
        {/* Logo + tip ocupam o espaço central */}
        <HistoryList
          messages={[]}
          height={terminalHeight - 5}
          isThinking={state.isThinking}
          currentModel={state.currentModel}
          currentAgent={state.currentAgent}
        />

        {/* Input centralizado */}
        <Box alignItems="center" justifyContent="center">
          <InputArea
            isThinking={state.isThinking}
            onEnter={(msg) => chatEngine.sendMessage(msg)}
            currentModel={state.currentModel}
            currentProvider={state.currentProvider}
            visible={true}
            disabled={isOverlayActive}
            onOverlayRequest={handleOverlayRequest}
          />
        </Box>

        {/* Rodapé */}
        <Box width="100%" paddingX={1}>
          <Text color="gray">{shortCwd}</Text>
          <Box flexGrow={1} />
          <Text color="gray">{footerRight}</Text>
        </Box>

        {/* Overlays */}
        {renderOverlay()}
      </Box>
    );
  }

  // Conversation screen
  return (
    <Box flexDirection="column" width="100%" height={terminalHeight}>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexGrow={1} flexDirection="column">
          <HistoryList
            messages={state.messages}
            height={terminalHeight - 5}
            isThinking={state.isThinking}
            currentModel={state.currentModel}
            currentAgent={state.currentAgent}
          />
        </Box>
        <Sidebar state={state} />
      </Box>

      <InputArea
        isThinking={state.isThinking}
        onEnter={(msg) => chatEngine.sendMessage(msg)}
        currentModel={state.currentModel}
        currentProvider={state.currentProvider}
        disabled={isOverlayActive}
        onOverlayRequest={handleOverlayRequest}
      />

      {/* Rodapé */}
      <Box width="100%" paddingX={1}>
        <Text color="gray">{shortCwd}</Text>
        <Box flexGrow={1} />
        <Text color="gray">{footerRight}</Text>
      </Box>

      {/* Overlays */}
      {renderOverlay()}
    </Box>
  );
}