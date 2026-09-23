import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TagService } from './tag.service';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Tags (CRM)')
@Controller('api/tags')
@UseGuards(JwtAuthGuard)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get(':tenantId')
  @ApiOperation({ summary: 'Obtiene todas las etiquetas de un tenant' })
  @ApiParam({ name: 'tenantId', required: true })
  async findAll(@Param('tenantId') tenantId: string) {
    return this.tagService.findAll(tenantId);
  }

  @Post(':tenantId')
  @ApiOperation({ summary: 'Crea una nueva etiqueta' })
  @ApiParam({ name: 'tenantId', required: true })
  async create(
    @Param('tenantId') tenantId: string,
    @Body('name') name: string,
    @Body('color') color: string,
  ) {
    return this.tagService.create(tenantId, name, color);
  }

  @Delete(':tenantId/:tagId')
  @ApiOperation({ summary: 'Elimina una etiqueta' })
  @ApiParam({ name: 'tenantId', required: true })
  @ApiParam({ name: 'tagId', required: true })
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagService.delete(tenantId, tagId);
  }
}
