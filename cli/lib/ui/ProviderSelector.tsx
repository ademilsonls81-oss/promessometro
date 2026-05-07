import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { PROVIDERS_DATA, type ProviderInfo } from '../providers-data.js';
import { getApiKeyForProvider, saveProviderKey, getConfig } from '../config.js';

type Step = 'provider' | 'key' | 'saved';

function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) queryIndex++;
  }
  return queryIndex === queryLower.length;
}

// Group providers
const POPULAR_IDS = ['anthropic', 'openai', 'gemini', 'groq', 'mistral', 'deepseek'];
const popularProviders = PROVIDERS_DATA.filter((p) => POPULAR_IDS.includes(p.id));
const otherProviders = PROVIDERS_DATA.filter((p) => !POPULAR_IDS.includes(p.id));

interface Props {
  onClose: () => void;
}

export function ProviderSelector({ onClose }: Props) {
  const [step, setStep] = useState<Step>('provider');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [error, setError] = useState('');
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg = getConfig();
  const configuredProviders = new Set(
    PROVIDERS_DATA.filter((p) => !!getApiKeyForProvider(p.id)).map((p) => p.id),
  );

  const allProviders = query
    ? PROVIDERS_DATA.filter((p) => fuzzyMatch(p.name, query) || fuzzyMatch(p.id, query))
    : PROVIDERS_DATA;

  const filteredPopular = query ? allProviders.filter((p) => POPULAR_IDS.includes(p.id)) : popularProviders;
  const filteredOther   = query ? allProviders.filter((p) => !POPULAR_IDS.includes(p.id)) : otherProviders;

  // Flat list for navigation (popular first, then other)
  const flatList = [...filteredPopular, ...filteredOther];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const handleProviderSelect = useCallback(
    (provider: ProviderInfo) => {
      setSelectedProvider(provider);

      if (provider.id === 'ollama') {
        saveProviderKey(provider.id, 'local');
        setStep('saved');
        savedTimeoutRef.current = setTimeout(() => onClose(), 1200);
        return;
      }

      const existingKey = getApiKeyForProvider(provider.id);
      if (existingKey) {
        // Already configured — just switch to it
        saveProviderKey(provider.id, existingKey);
        setStep('saved');
        savedTimeoutRef.current = setTimeout(() => onClose(), 1200);
        return;
      }

      setStep('key');
      setApiKey('');
      setError('');
    },
    [onClose],
  );

  const handleApiKeySubmit = useCallback(() => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    if (selectedProvider) {
      saveProviderKey(selectedProvider.id, apiKey.trim());
      setStep('saved');
      savedTimeoutRef.current = setTimeout(() => onClose(), 1200);
    }
  }, [apiKey, selectedProvider, onClose]);

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'key') {
        setStep('provider');
        setApiKey('');
        setError('');
      } else {
        onClose();
      }
      return;
    }

    if (step === 'key') {
      if (key.return) {
        handleApiKeySubmit();
      }
      return;
    }

    if (step === 'provider') {
      if (key.return) {
        if (flatList[selectedIndex]) {
          handleProviderSelect(flatList[selectedIndex]);
        }
      } else if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatList.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => (prev < flatList.length - 1 ? prev + 1 : 0));
      }
    }
  });

  // ── SAVED ─────────────────────────────────────────────────────────────────
  if (step === 'saved') {
    return (
      <Box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
        <Box borderStyle="round" borderColor="green" paddingX={3} paddingY={1}>
          <Text bold color="green">✓ API key saved</Text>
        </Box>
      </Box>
    );
  }

  // ── API KEY INPUT (identical to OpenCode image 7) ─────────────────────────
  if (step === 'key' && selectedProvider) {
    return (
      <Box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
        <Box flexDirection="column" width={55}>
          {/* Header */}
          <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={0}>
            <Text bold color="white">API key</Text>
            <Box flexGrow={1} />
            <Text color="gray">esc</Text>
          </Box>
          {/* Body */}
          <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
            <Box marginBottom={1}>
              <TextInput
                value={apiKey}
                onChange={(val) => {
                  setApiKey(val);
                  setError('');
                }}
                onSubmit={handleApiKeySubmit}
                mask="*"
                placeholder="API key"
              />
            </Box>
            {error && (
              <Box>
                <Text color="red">{error}</Text>
              </Box>
            )}
          </Box>
          {/* Footer */}
          <Box marginTop={0} paddingX={1}>
            <Text bold color="white">enter</Text>
            <Text color="gray"> submit</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── PROVIDER LIST (identical to OpenCode image 6) ─────────────────────────
  const popularCount = filteredPopular.length;

  return (
    <Box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
      <Box flexDirection="column" width={62}>
        {/* Header */}
        <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={0}>
          <Text bold color="white">Connect a provider</Text>
          <Box flexGrow={1} />
          <Text color="gray">esc</Text>
        </Box>

        {/* Body */}
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
          {/* Search */}
          <Box marginBottom={1}>
            <TextInput
              value={query}
              onChange={(val) => {
                setQuery(val);
                setSelectedIndex(0);
              }}
              placeholder="Search"
            />
          </Box>

          {/* Popular section */}
          {filteredPopular.length > 0 && (
            <>
              <Box marginBottom={0}>
                <Text color="cyan">Popular</Text>
              </Box>
              {filteredPopular.map((provider, idx) => {
                const isSelected = idx === selectedIndex;
                const isConfigured = configuredProviders.has(provider.id);
                return (
                  <Box key={provider.id}>
                    <Text color="cyan">{isConfigured ? '✓ ' : '  '}</Text>
                    <Text
                      bold={isSelected}
                      backgroundColor={isSelected ? '#f0a070' : undefined}
                      color={isSelected ? 'black' : 'white'}
                    >
                      {provider.name}
                    </Text>
                    {provider.free && !isSelected && (
                      <Text color="gray"> Free</Text>
                    )}
                  </Box>
                );
              })}
            </>
          )}

          {/* Other section */}
          {filteredOther.length > 0 && (
            <>
              <Box marginTop={1} marginBottom={0}>
                <Text color="cyan">Other</Text>
              </Box>
              {filteredOther.map((provider, idx) => {
                const globalIdx = popularCount + idx;
                const isSelected = globalIdx === selectedIndex;
                const isConfigured = configuredProviders.has(provider.id);
                return (
                  <Box key={provider.id}>
                    <Text color="cyan">{isConfigured ? '✓ ' : '  '}</Text>
                    <Text
                      bold={isSelected}
                      backgroundColor={isSelected ? '#f0a070' : undefined}
                      color={isSelected ? 'black' : 'white'}
                    >
                      {provider.name}
                    </Text>
                    {provider.free && !isSelected && (
                      <Text color="gray"> Free</Text>
                    )}
                  </Box>
                );
              })}
            </>
          )}
        </Box>

        {/* Footer */}
        <Box marginTop={0} paddingX={1}>
          <Text color="gray">↑↓ Navigate · Enter Select · Esc Close</Text>
        </Box>
      </Box>
    </Box>
  );
}