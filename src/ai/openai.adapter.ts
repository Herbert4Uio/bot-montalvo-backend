import { Injectable } from '@nestjs/common';
import { AiProviderInterface, ChatMessage } from './ai.interface';
import OpenAI from 'openai';
import { LoggerService } from '../core/logger.service';

@Injectable()
export class OpenAiAdapterService implements AiProviderInterface {
  private openai: OpenAI;

  constructor(private readonly logger: LoggerService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    this.logger.log(`OpenAI request enviado con ${messages.length} mensajes de contexto.`);
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // configurable según el CRM
        messages: messages,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'No pude generar una respuesta.';
    } catch (error) {
      this.logger.error('Error en OpenAI API:', error);
      throw error; // Se relanza para que el Circuit Breaker lo atrape
    }
  }
}
