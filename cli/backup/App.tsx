import { Box } from 'ink';
import React, { useEffect, useState } from 'react';
import { ChatEngine } from '../chat-engine.js';
import { HistoryList } from './HistoryList.js';
import { InputArea } from './InputArea.js';
import { Sidebar } from './Sidebar.js';
import { ModelSelector } from './ModelSelector.js';

interface AppProps {
  chatEngine: ChatEngine;
}

export const App: React.FC<AppProps> = ({ chatEngine }) => {
  const [state, setState] = useState(chatEngine.getState());
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const unsubscribe = chatEngine.subscribe((newState) => {
      setState(newState);
      if (newState.messages.some((m) => m.role === 'user')) {
        setStarted(true);
      }
    });
    return unsubscribe;
  }, [chatEngine]);

  const handleInput = (text: string) => {
    if (text.trim() === '/model') {
      setShowModelSelector(true);
      return;
    }
    setStarted(true);
    chatEngine.sendMessage(text);
  };

  if (showModelSelector) {
    return (
      <Box flexDirection="column" height="100%" justifyContent="center" alignItems="center">
        <ModelSelector
          onSelect={(modelId) => {
            if (typeof chatEngine.setModel === 'function') {
              chatEngine.setModel(modelId);
            }
            setShowModelSelector(false);
          }}
          onCancel={() => setShowModelSelector(false)}
        />
      </Box>
    );
  }

  if (!started) {
    return (
      <Box flexDirection="column" width="100%" height={24}>
        <HistoryList
          messages={[]}
          height={24}
          isThinking={false}
          currentModel={state.currentModel}
          currentAgent={state.currentAgent}
          welcomeMode={true}
          onWelcomeSubmit={handleInput}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="row" flexGrow={1}>
        <Box flexGrow={1} flexDirection="column">
          <HistoryList
            messages={state.messages}
            height={20}
            isThinking={state.isThinking}
            currentModel={state.currentModel}
            currentAgent={state.currentAgent}
          />
        </Box>
        <Sidebar state={state} />
      </Box>
      <InputArea
        isThinking={state.isThinking}
        onEnter={handleInput}
        currentModel={state.currentModel}
      />
    </Box>
  );
};