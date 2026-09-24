import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../core/logger.service';
import { MessageBufferService } from '../whatsapp/message-buffer.service';
import { CustomerService } from '../customer/customer.service';
import { RegexRouterService } from './regex-router.service';
import { StateMachineService, UserStateEnum } from './state-machine.service';
import { AiService } from '../ai/ai.service';
import { SessionManagerService } from '../whatsapp/session-manager.service';
import { TenantService } from '../tenant/tenant.service';
import { MessageLogService } from './message-log.service';

@Injectable()
export class MessageProcessorService implements OnModuleInit {
  constructor(
    private readonly logger: LoggerService,
    private readonly messageBuffer: MessageBufferService,
    private readonly customerService: CustomerService,
    private readonly regexRouter: RegexRouterService,
    private readonly stateMachine: StateMachineService,
    private readonly aiService: AiService,
    private readonly sessionManager: SessionManagerService,
    private readonly tenantService: TenantService,
    private readonly messageLog: MessageLogService,
  ) {}

  onModuleInit() {
    this.messageBuffer.onGroupedMessage.subscribe(async (payload) => {
      this.logger.log(`Procesando bloque de mensajes para ${payload.customerPhone}: "${payload.fullText}"`);

      try {
        const customer = await this.customerService.upsertCustomer(
          payload.tenantId,
          payload.customerPhone,
          payload.customerProfileName,
          payload.customerPhoneReal
        );

        // Actualizamos el payload con el ID real de la base de datos (UUID)
        payload.customerId = customer.id;

        // Registrar el mensaje del usuario en la base de datos
        await this.messageLog.logMessage(payload.tenantId, payload.customerId, 'USER', payload.fullText);

        const route = this.regexRouter.evaluate(payload.fullText);
        if (route.matched) {
          this.logger.log(`Comando rápido detectado. Acción: ${route.action}`);
          await this.handleQuickCommand(payload.tenantId, payload.customerId, payload.customerPhone, route.action);
          return;
        }

        const currentState = this.stateMachine.getState(
          payload.tenantId,
          payload.customerPhone,
        );

        // 4. Lógica basada en estados
        switch (currentState) {
          case UserStateEnum.HUMAN_TRANSFER:
            this.logger.log(`Mensaje ignorado (Humano al control) - ${payload.customerPhone}`);
            break;

          case UserStateEnum.IDLE:
          case UserStateEnum.AI_CHAT:
          default:
            this.logger.log(`Derivando a IA (Fase 4) - ${payload.customerPhone}`);
            this.stateMachine.setState(payload.tenantId, payload.customerPhone, UserStateEnum.AI_CHAT);
            
            let systemPrompt = "Eres un asistente virtual amable. Responde de forma concisa.";
            try {
              const tenantConfig = await this.tenantService.findOne(payload.tenantId);
              if (tenantConfig && tenantConfig.systemPrompt) {
                systemPrompt = tenantConfig.systemPrompt;
              }
            } catch (err) {
              this.logger.warn(`No se pudo cargar el System Prompt para Tenant ${payload.tenantId}. Usando default.`);
            }
            
            // Obtener el historial completo de la BD (últimos 40 mensajes)
            const history = await this.messageLog.getHistoryByPhone(payload.tenantId, payload.customerPhone);
            
            // Mapear historial al formato de OpenAI
            const aiMessages: any[] = [
              { role: 'system', content: systemPrompt },
              ...history.map(m => ({
                role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
                content: m.content
              }))
            ];

            const aiResponse = await this.aiService.getResponse(aiMessages);

            // Registrar respuesta de la IA
            await this.messageLog.logMessage(payload.tenantId, payload.customerId, 'ASSISTANT', aiResponse);
            
            const targetJid = payload.customerJid || payload.customerPhone;
            await this.sessionManager.sendMessage(payload.tenantId, targetJid, aiResponse);
            break;
        }
      } catch (error) {
        this.logger.error(`Error procesando mensaje para ${payload.customerPhone}`, error.stack);
      }
    });
  }

  private async handleQuickCommand(tenantId: string, customerId: string, customerPhone: string, action?: string) {
    switch (action) {
      case 'END_CHAT':
        this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.IDLE);
        // Aquí llamaríamos a Baileys para enviar un mensaje de despedida
        break;
      case 'TRANSFER_TO_HUMAN':
        this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.HUMAN_TRANSFER);
        await this.customerService.updateChatStatus(tenantId, customerPhone, 'HUMAN');
        
        // Notificar en whatsapp que un humano atenderá
        await this.sessionManager.sendMessage(tenantId, customerPhone, "Te estamos transfiriendo con nuestro equipo de soporte humano. En breve te atenderán.");
        await this.messageLog.logMessage(tenantId, customerId, 'SYSTEM', "Te estamos transfiriendo con nuestro equipo de soporte humano. En breve te atenderán.");
        break;
      case 'SEND_MENU':
        this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.MENU);
        // Aquí llamaríamos a Baileys para enviar opciones deterministas
        break;
    }
  }
}
