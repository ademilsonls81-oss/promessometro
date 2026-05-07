interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  usage: {
    input: number;
    output: number;
  };
}

interface CallAIOptions {
  messages?: Message[];
  systemPrompt?: string;
}

export declare function callAI(prompt: string, options?: CallAIOptions): Promise<AIResponse>;

export declare function streamAI(prompt: string, options?: CallAIOptions): AsyncGenerator<string>;

export declare function callAIWithMessages(messages: Message[], options?: CallAIOptions): Promise<AIResponse>;