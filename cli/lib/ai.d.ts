interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIResponse {
  content: string;
  usage?: {
    input: number;
    output: number;
  };
}

interface CallAIOptions {
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
}

export declare function callAI(messages: Message[], options?: CallAIOptions): Promise<AIResponse>;

export declare function callAIWithMessages(messages: Message[], options?: CallAIOptions): Promise<AIResponse>;