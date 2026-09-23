import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, name: string, color: string) {
    return this.prisma.tag.create({
      data: {
        name,
        color,
        tenantId,
      },
    });
  }

  async delete(tenantId: string, tagId: string) {
    return this.prisma.tag.delete({
      where: {
        id: tagId,
        tenantId,
      },
    });
  }
}
