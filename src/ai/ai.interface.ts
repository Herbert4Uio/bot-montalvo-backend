export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderInterface {
  /**
   * Genera una respuesta usando el LLM
   * @param messages El historial de mensajes y el system prompt
   */
  generateResponse(messages: ChatMessage[]): Promise<string>;
}
