import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(tenantId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { messageLogs: true }
        }
      }
    });

    const totalContacts = customers.length;
    let totalDeals = 0;
    let messagesSent = 0;
    let totalDealValue = 0;
    
    const stageDistribution: Record<string, number> = {
      'NUEVO LEAD': 0,
      'CALIFICADO': 0,
      'PRESUPUESTO ENVIADO': 0,
      'NEGOCIACION': 0,
      'GANADO': 0
    };

    customers.forEach(c => {
      messagesSent += c._count.messageLogs;
      
      // Solo contar en el embudo y como Deal si tienen dealTitle
      if (c.dealTitle) {
        totalDeals++;
        if (c.dealValue) {
          totalDealValue += c.dealValue;
        }
        
        if (stageDistribution[c.pipelineStage] !== undefined) {
          stageDistribution[c.pipelineStage]++;
        } else {
          stageDistribution[c.pipelineStage] = 1;
        }
      }
    });

    return {
      totalContacts,
      totalDeals,
      totalDealValue,
      messagesSent,
      stageDistribution,
    };
  }

  async getContacts(tenantId: string) {
    return this.prisma.customer.findMany({
      where: { tenantId },
      include: { tags: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateContact(
    tenantId: string, 
    customerId: string, 
    data: { 
      pipelineStage?: string; 
      notes?: string; 
      tagIds?: string[];
      dealTitle?: string;
      dealValue?: number;
      profileName?: string;
      phoneNumberReal?: string;
    }
  ) {
    const updateData: any = {};
    if (data.pipelineStage !== undefined) updateData.pipelineStage = data.pipelineStage;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.dealTitle !== undefined) updateData.dealTitle = data.dealTitle;
    if (data.dealValue !== undefined) updateData.dealValue = data.dealValue;
    if (data.profileName !== undefined) updateData.profileName = data.profileName;
    if (data.phoneNumberReal !== undefined) updateData.phoneNumberReal = data.phoneNumberReal;
    
    if (data.tagIds !== undefined) {
      updateData.tags = {
        set: data.tagIds.map(id => ({ id }))
      };
    }

    return this.prisma.customer.update({
      where: { id: customerId, tenantId },
      data: updateData,
      include: { tags: true }
    });
  }
}
