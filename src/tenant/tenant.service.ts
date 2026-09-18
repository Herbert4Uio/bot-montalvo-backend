import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { Tenant } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  adminPassword?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTenantDto): Promise<Tenant> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: data.id,
          name: data.name,
          systemPrompt: data.systemPrompt || 'Eres un asistente útil y amable.',
        },
      });

      if (data.adminEmail && data.adminPassword) {
        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
        await tx.user.create({
          data: {
            email: data.adminEmail,
            password: hashedPassword,
            role: 'TENANT_ADMIN',
            tenantId: tenant.id,
          },
        });
      }

      return tenant;
    });
  }

  async findAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany();
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} no encontrado`);
    return tenant;
  }

  async update(id: string, data: UpdateTenantDto): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }
}
