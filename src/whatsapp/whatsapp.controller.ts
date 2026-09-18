import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionManagerService } from './session-manager.service';
import type { TenantConnectionStatus } from './session-manager.service';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';

@ApiTags('WhatsApp')
@Controller('api/whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly sessionManager: SessionManagerService) {}

  @Post(':tenantId/connect')
  @ApiOperation({ summary: 'Inicializa la conexión de WhatsApp para un Tenant' })
  @ApiParam({ name: 'tenantId', required: true, description: 'ID del Tenant' })
  async connect(@Param('tenantId') tenantId: string) {
    await this.sessionManager.connectTenant(tenantId);
    return { message: `Iniciando conexión para el tenant ${tenantId}. Por favor, consulte el estado para el código QR.` };
  }

  @Post(':tenantId/disconnect')
  @ApiOperation({ summary: 'Cierra la conexión de WhatsApp actual' })
  @ApiParam({ name: 'tenantId', required: true, description: 'ID del Tenant' })
  async disconnect(@Param('tenantId') tenantId: string) {
    await this.sessionManager.disconnectTenant(tenantId);
    return { message: 'WhatsApp desconectado.' };
  }

  @Get(':tenantId/status')
  @ApiOperation({ summary: 'Obtiene el estado de conexión actual (incluye QR si está pendiente)' })
  @ApiParam({ name: 'tenantId', required: true, description: 'ID del Tenant' })
  getStatus(@Param('tenantId') tenantId: string): TenantConnectionStatus {
    return this.sessionManager.getStatus(tenantId);
  }

  @Get(':tenantId/qr')
  @ApiOperation({ summary: 'Obtiene únicamente el código QR en Base64 si existe' })
  @ApiParam({ name: 'tenantId', required: true, description: 'ID del Tenant' })
  getQr(@Param('tenantId') tenantId: string) {
    const status = this.sessionManager.getStatus(tenantId);
    if (status.status === 'QR_READY' && status.qr) {
      return { qr: status.qr };
    }
    return { message: 'No hay código QR disponible en este momento. Estado actual: ' + status.status };
  }
}
