import { Injectable, OnModuleInit } from '@nestjs/common';
import { OpenAiAdapterService } from './openai.adapter';
import CircuitBreaker from 'opossum';
import { LoggerService } from '../core/logger.service';
import { ChatMessage } from './ai.interface';

@Injectable()
export class AiService implements OnModuleInit {
  private breaker: CircuitBreaker;

  constructor(
    private readonly openAiAdapter: OpenAiAdapterService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    const options = {
      timeout: 10000, // Si OpenAI tarda más de 10s, falla
      errorThresholdPercentage: 50, // Si 50% de llamadas fallan, abrir circuito
      resetTimeout: 30000, // Esperar 30s antes de probar de nuevo
    };

    this.breaker = new CircuitBreaker(
      (messages: ChatMessage[]) => this.openAiAdapter.generateResponse(messages),
      options,
    );

    this.breaker.fallback(() => 'Actualmente estoy experimentando demoras técnicas. Por favor, intenta de nuevo en unos minutos o escribe "humano" para hablar con un asesor.');

    this.breaker.on('open', () => this.logger.warn('Circuit Breaker ABIERTO. IA desconectada.'));
    this.breaker.on('halfOpen', () => this.logger.log('Circuit Breaker MEDIO ABIERTO. Probando conexión...'));
    this.breaker.on('close', () => this.logger.log('Circuit Breaker CERRADO. IA operativa.'));
  }

  async getResponse(messages: ChatMessage[]): Promise<string> {
    return this.breaker.fire(messages) as Promise<string>;
  }
}
