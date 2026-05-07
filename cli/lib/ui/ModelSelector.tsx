import { Box, Text, useInput } from 'ink';
import React, { useState, useMemo, useEffect } from 'react';
import { getAllModels, ModelInfo } from '../model-registry.js';
import { getConfig, setConfig } from '../config.js';

interface ModelSelectorProps {
  onSelect: (modelId: string) => void;
  onCancel: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onSelect, onCancel }) => {
  const config = getConfig();
  const allModels = useMemo(() => getAllModels(), []);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const VISIBLE_HEIGHT = 14;

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const query = searchQuery.toLowerCase();
    return allModels.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.provider.toLowerCase().includes(query)
    );
  }, [allModels, searchQuery]);

  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + VISIBLE_HEIGHT) {
      setScrollOffset(selectedIndex - VISIBLE_HEIGHT + 1);
    }
  }, [selectedIndex, scrollOffset]);

  useInput((input, key) => {
    if (!key.ctrl && !key.meta && input && input.length === 1 && !key.escape) {
      setSearchQuery(prev => prev + input);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredModels.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < filteredModels.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      if (filteredModels[selectedIndex]) {
        const selectedModel = filteredModels[selectedIndex];
        const providerMap: Record<string, string> = {
          'groq': 'groq',
          'google': 'gemini',
          'gemini': 'gemini',
          'alibaba': 'alibaba',
          'ollama': 'ollama',
          'openrouter': 'openrouter',
          'anthropic': 'anthropic',
          'openai': 'openai',
          'deepseek': 'deepseek',
          'nvidia': 'nvidia',
          'opencode zen': 'opencode',
        };
        const providerKey = providerMap[selectedModel.provider.toLowerCase()] || selectedModel.provider.toLowerCase();
        setConfig('provider', providerKey);
        onSelect(selectedModel.id);
      }
    } else if (key.escape) {
      onCancel();
    } else if (key.backspace) {
      setSearchQuery(prev => prev.slice(0, -1));
    }
  });

  const visibleModels = filteredModels.slice(scrollOffset, scrollOffset + VISIBLE_HEIGHT);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={80}
      justifyContent="center"
      alignItems="center"
    >
      <Text bold color="cyan">Select model</Text>
      <Box marginTop={1}>
        <Text color="gray">Search: </Text>
        <Text color="white" backgroundColor="gray">
          {searchQuery || ' '}
        </Text>
        <Text color="gray" dimColor> (type to filter)</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {visibleModels.map((model, index) => {
          const globalIndex = scrollOffset + index;
          const isSelected = globalIndex === selectedIndex;
          return (
            <Box key={model.id}>
              <Box width={2}>
                <Text
                  color={isSelected ? 'white' : 'gray'}
                  backgroundColor={isSelected ? 'gray' : undefined}
                >
                  {isSelected ? '> ' : '  '}
                </Text>
              </Box>
              <Text
                color={isSelected ? 'white' : 'gray'}
                backgroundColor={isSelected ? 'gray' : undefined}
              >
                {model.name}
              </Text>
              <Text
                color={isSelected ? 'white' : 'gray'}
                backgroundColor={isSelected ? 'gray' : undefined}
              >
                {' '}{model.provider}
              </Text>
              <Box width={15} alignItems="flex-end" justifyContent="flex-end">
                {model.free ? (
                  <Text color="green">Free</Text>
                ) : (
                  <Text color="cyan">Paid</Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>
          {filteredModels.length} models - {scrollOffset + 1}-{Math.min(scrollOffset + VISIBLE_HEIGHT, filteredModels.length)}
        </Text>
        <Box marginTop={1}>
          <Text color="gray">
            <Text color="cyan">up/down</Text> navigate <Text color="cyan">Enter</Text> select <Text color="cyan">esc</Text> cancel
          </Text>
        </Box>
      </Box>
    </Box>
  );
};