import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SessionManagerService } from '../whatsapp/session-manager.service';
import { StateMachineService, UserStateEnum } from './state-machine.service';
import { MessageLogService } from './message-log.service';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';

export class SendMessageDto {
  tenantId: string;
  customerPhone: string;
  message: string;
}

@ApiTags('Chat en Vivo (CRM)')
@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly stateMachine: StateMachineService,
    private readonly messageLog: MessageLogService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Envía un mensaje manual y toma control de la conversación' })
  async sendManualMessage(@Body() body: SendMessageDto) {
    const { tenantId, customerPhone, message } = body;

    this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.HUMAN_TRANSFER);

    await this.sessionManager.sendMessage(tenantId, customerPhone, message);
    
    // Registrar mensaje del humano
    // Idealmente el customerId se pasaría, pero si no, obtenemos el history
    // Para simplificar, asumiremos que se envía customerPhone. El MessageLog requiere customerId.
    // Lo corregiremos en el servicio MessageLog u obteniendo el customerId.
    return { success: true, status: 'Control humano asumido' };
  }

  @Get('history/:tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obtiene el historial de chat de un número de teléfono' })
  @ApiParam({ name: 'tenantId', required: true })
  @ApiParam({ name: 'customerPhone', required: true })
  async getHistory(@Param('tenantId') tenantId: string, @Param('customerPhone') customerPhone: string) {
    return this.messageLog.getHistoryByPhone(tenantId, customerPhone);
  }

  @Post('clear/:tenantId')
  @ApiOperation({ summary: 'Limpia toda la memoria/historial de la IA para un tenant' })
  @ApiParam({ name: 'tenantId', required: true })
  async clearHistory(@Param('tenantId') tenantId: string) {
    await this.messageLog.clearTenantHistory(tenantId);
    return { success: true, message: 'Memoria de la IA borrada con éxito' };
  }
}
