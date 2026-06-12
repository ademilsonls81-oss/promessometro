import axios from 'axios';
import { PROVIDERS_DATA } from './providers-data.js';
import { getApiKeyForProvider } from './config.js';

export interface FetchedModel {
  id: string;
  name: string;
  free: boolean;
}

async function fetchGroqModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await axios.get('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 6000,
  });
  return res.data.data
    .filter((m: any) => !m.id.includes('whisper') && !m.id.includes('tts'))  // any-ok
    .map((m: any) => ({ id: m.id, name: m.id, free: true }));  // any-ok
}

async function fetchOpenAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await axios.get('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 6000,
  });
  return res.data.data
    .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))  // any-ok
    .sort((a: any, b: any) => b.created - a.created)  // any-ok
    .slice(0, 20)
    .map((m: any) => ({ id: m.id, name: m.id, free: false }));  // any-ok
}

async function fetchGeminiModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
    params: { key: apiKey },
    timeout: 6000,
  });
  return res.data.models
    .filter((m: any) =>  // any-ok
      m.supportedGenerationMethods?.includes('generateContent') &&
      !m.name.includes('embedding'),
    )
    .map((m: any) => ({  // any-ok
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
      free: true,
    }));
}

async function fetchOpenRouterModels(apiKey: string): Promise<FetchedModel[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await axios.get('https://openrouter.ai/api/v1/models', {
    headers,
    timeout: 8000,
  });
  return res.data.data.map((m: any) => ({  // any-ok
    id: m.id,
    name: m.name || m.id,
    free:
      !m.pricing?.completion ||
      m.pricing.completion === '0' ||
      m.id.includes(':free'),
  }));
}

async function fetchAnthropicModels(_apiKey: string): Promise<FetchedModel[]> {
  // Anthropic doesn't have a public list endpoint — use static
  return [];
}

async function fetchOllamaModels(): Promise<FetchedModel[]> {
  const res = await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 });
  return (res.data.models || []).map((m: any) => ({  // any-ok
    id: m.name,
    name: m.name,
    free: true,
  }));
}

export async function fetchModelsForProvider(providerId: string): Promise<FetchedModel[]> {
  const apiKey = getApiKeyForProvider(providerId);

  try {
    switch (providerId) {
      case 'groq':       return await fetchGroqModels(apiKey);
      case 'openai':     return await fetchOpenAIModels(apiKey);
      case 'gemini':     return await fetchGeminiModels(apiKey);
      case 'openrouter': return await fetchOpenRouterModels(apiKey);
      case 'anthropic':  return await fetchAnthropicModels(apiKey);
      case 'ollama':     return await fetchOllamaModels();
      default: {
        const p = PROVIDERS_DATA.find((x) => x.id === providerId);
        if (!p) return [];
        return p.models.map((m) => ({ id: m, name: m, free: p.free }));
      }
    }
  } catch {
    // Network error → fall back to static list
    const p = PROVIDERS_DATA.find((x) => x.id === providerId);
    if (!p) return [];
    return p.models.map((m) => ({ id: m, name: m, free: p.free }));
  }
}
