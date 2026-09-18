import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';

@Injectable()
export class MessageLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logMessage(tenantId: string, customerId: string, role: string, content: string) {
    return this.prisma.messageLog.create({
      data: {
        tenantId,
        customerId,
        role,
        content,
      },
    });
  }

  async getHistoryByPhone(tenantId: string, phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone_tenantId: { phone, tenantId } }
    });

    if (!customer) return [];

    const messages = await this.prisma.messageLog.findMany({
      where: { customerId: customer.id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    
    return messages.reverse();
  }

  async clearTenantHistory(tenantId: string) {
    return this.prisma.messageLog.deleteMany({
      where: { tenantId }
    });
  }
}
