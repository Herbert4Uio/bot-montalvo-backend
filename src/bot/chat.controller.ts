import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SessionManagerService } from '../whatsapp/session-manager.service';
import { StateMachineService, UserStateEnum } from './state-machine.service';
import { MessageLogService } from './message-log.service';
import { CustomerService } from '../customer/customer.service';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SetStatusDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}

@ApiTags('Chat en Vivo (CRM)')
@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly stateMachine: StateMachineService,
    private readonly messageLog: MessageLogService,
    private readonly customerService: CustomerService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Envía un mensaje manual y toma control de la conversación' })
  async sendManualMessage(@Body() body: SendMessageDto) {
    const { tenantId, customerPhone, message } = body;

    // Pausar IA
    this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.HUMAN_TRANSFER);

    // Cambiar estado de bandeja a HUMAN
    const customer = await this.customerService.updateChatStatus(tenantId, customerPhone, 'HUMAN');

    await this.sessionManager.sendMessage(tenantId, customerPhone, message);
    
    // Registrar mensaje del humano
    await this.messageLog.logMessage(tenantId, customer.id, 'ADMIN', message);

    return { success: true, status: 'Control humano asumido' };
  }

  @Post('status')
  @ApiOperation({ summary: 'Cambia el estado de la conversación (BOT, HUMAN, CLOSED)' })
  async setStatus(@Body() body: SetStatusDto) {
    const { tenantId, customerPhone, status } = body;

    // Actualizar DB
    await this.customerService.updateChatStatus(tenantId, customerPhone, status);

    // Actualizar máquina de estados
    if (status === 'BOT') {
      // Limpiar memoria
      await this.messageLog.clearHistoryByPhone(tenantId, customerPhone);
      this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.IDLE);
    } else if (status === 'HUMAN') {
      this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.HUMAN_TRANSFER);
    } else if (status === 'CLOSED') {
      this.stateMachine.setState(tenantId, customerPhone, UserStateEnum.IDLE); // O un estado CLOSED si existiera
    }

    return { success: true, status };
  }

  @Get('history/:tenantId/:customerPhone')
  @ApiOperation({ summary: 'Obtiene el historial de chat de un número de teléfono' })
  @ApiParam({ name: 'tenantId', required: true })
  @ApiParam({ name: 'customerPhone', required: true })
  async getHistory(@Param('tenantId') tenantId: string, @Param('customerPhone') customerPhone: string) {
    return this.messageLog.getHistoryByPhone(tenantId, customerPhone);
  }

  @Get('customers/:tenantId')
  @ApiOperation({ summary: 'Obtiene todos los clientes históricos de un tenant' })
  @ApiParam({ name: 'tenantId', required: true })
  async getCustomers(@Param('tenantId') tenantId: string) {
    return this.customerService.getCustomersByTenant(tenantId);
  }

  @Post('clear/:tenantId')
  @ApiOperation({ summary: 'Limpia toda la memoria/historial de la IA para un tenant' })
  @ApiParam({ name: 'tenantId', required: true })
  async clearHistory(@Param('tenantId') tenantId: string) {
    await this.messageLog.clearTenantHistory(tenantId);
    return { success: true, message: 'Memoria de la IA borrada con éxito' };
  }
}
