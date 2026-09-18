import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TenantService, CreateTenantDto, UpdateTenantDto } from './tenant.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { RolesGuard } from '../core/guards/roles.guard';
import { Roles } from '../core/decorators/roles.decorator';

@ApiTags('Tenants (Empresas)')
@Controller('api/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Crear un nuevo Tenant (Solo SuperAdmin)' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Obtener todos los Tenants (Solo SuperAdmin)' })
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una empresa específica' })
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar la configuración (ej. System Prompt) de una empresa' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(id, updateTenantDto);
  }
}
