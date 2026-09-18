import { Injectable } from '@nestjs/common';
import { LoggerService } from '../core/logger.service';

export interface RouteResult {
  matched: boolean;
  action?: 'END_CHAT' | 'TRANSFER_TO_HUMAN' | 'SEND_MENU' | string;
}

@Injectable()
export class RegexRouterService {
  constructor(private readonly logger: LoggerService) {}

  /**
   * Evalúa un texto entrante para detectar comandos rápidos y evitar la IA
   */
  evaluate(text: string): RouteResult {
    const lowerText = text.toLowerCase().trim();

    if (/^(salir|terminar|adiós|adios|chau)$/.test(lowerText)) {
      this.logger.log(`Comando rápido detectado: END_CHAT`);
      return { matched: true, action: 'END_CHAT' };
    }

    if (/^(asesor|humano|soporte|ayuda)$/.test(lowerText)) {
      this.logger.log(`Comando rápido detectado: TRANSFER_TO_HUMAN`);
      return { matched: true, action: 'TRANSFER_TO_HUMAN' };
    }

    if (/^(menu|menú|opciones)$/.test(lowerText)) {
      this.logger.log(`Comando rápido detectado: SEND_MENU`);
      return { matched: true, action: 'SEND_MENU' };
    }

    return { matched: false };
  }
}
