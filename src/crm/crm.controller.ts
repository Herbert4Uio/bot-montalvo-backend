import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('CRM')
@Controller('api/crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('dashboard/:tenantId')
  @ApiOperation({ summary: 'Obtiene estadísticas para el dashboard' })
  @ApiParam({ name: 'tenantId', required: true })
  async getDashboard(@Param('tenantId') tenantId: string) {
    return this.crmService.getDashboardStats(tenantId);
  }

  @Get('contacts/:tenantId')
  @ApiOperation({ summary: 'Obtiene todos los contactos con sus etiquetas' })
  @ApiParam({ name: 'tenantId', required: true })
  async getContacts(@Param('tenantId') tenantId: string) {
    return this.crmService.getContacts(tenantId);
  }

  @Post('contacts/:tenantId')
  @ApiOperation({ summary: 'Crea un nuevo contacto manualmente' })
  @ApiParam({ name: 'tenantId', required: true })
  async createContact(
    @Param('tenantId') tenantId: string,
    @Body() data: any
  ) {
    return this.crmService.createContact(tenantId, data);
  }

  @Delete('contacts/:tenantId/:id')
  @ApiOperation({ summary: 'Elimina un contacto por completo' })
  @ApiParam({ name: 'tenantId', required: true })
  @ApiParam({ name: 'id', required: true })
  async deleteContact(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string
  ) {
    return this.crmService.deleteContact(tenantId, id);
  }

  @Patch('contacts/:tenantId/:id')
  @ApiOperation({ summary: 'Actualiza un contacto (notas, etapa, etiquetas, deal)' })
  @ApiParam({ name: 'tenantId', required: true })
  @ApiParam({ name: 'id', required: true })
  async updateContact(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() data: { pipelineStage?: string; notes?: string; tagIds?: string[]; dealTitle?: string; dealValue?: number; profileName?: string; phoneNumberReal?: string }
  ) {
    return this.crmService.updateContact(tenantId, id, data);
  }
}
