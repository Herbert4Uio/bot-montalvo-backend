import { Injectable } from '@nestjs/common';
import { LoggerService } from '../core/logger.service';

export enum UserStateEnum {
  IDLE = 'IDLE',
  AI_CHAT = 'AI_CHAT',
  HUMAN_TRANSFER = 'HUMAN_TRANSFER',
  MENU = 'MENU',
}

export interface UserState {
  state: UserStateEnum;
  lastUpdated: number;
}

@Injectable()
export class StateMachineService {
  // Mapa de clave única: `${tenantId}:${customerId}`
  private states: Map<string, UserState> = new Map();

  constructor(private readonly logger: LoggerService) {}

  getState(tenantId: string, customerId: string): UserStateEnum {
    const key = `${tenantId}:${customerId}`;
    const state = this.states.get(key);
    
    // Si el estado no existe o expiró (ej. > 24 hrs), volver a IDLE
    if (!state || Date.now() - state.lastUpdated > 24 * 60 * 60 * 1000) {
      return UserStateEnum.IDLE;
    }

    return state.state;
  }

  setState(tenantId: string, customerId: string, newState: UserStateEnum) {
    const key = `${tenantId}:${customerId}`;
    this.states.set(key, {
      state: newState,
      lastUpdated: Date.now(),
    });
    this.logger.log(`Estado actualizado para ${key} -> ${newState}`);
  }
}
