import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { Customer } from '@prisma/client';
import { LoggerService } from '../core/logger.service';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Realiza un Upsert del cliente. Si no existe lo crea, si existe actualiza su nombre de perfil.
   */
  async upsertCustomer(
    tenantId: string,
    phone: string,
    profileName?: string,
    phoneNumberReal?: string,
  ): Promise<Customer> {
    try {
      const updateData: any = { profileName: profileName || undefined };
      if (phoneNumberReal) updateData.phoneNumberReal = phoneNumberReal;

      const customer = await this.prisma.customer.upsert({
        where: {
          phone_tenantId: {
            phone,
            tenantId,
          },
        },
        update: updateData,
        create: {
          phone,
          tenantId,
          profileName,
          phoneNumberReal,
        },
      });

      return customer;
    } catch (error) {
      this.logger.error(`Error en upsertCustomer para ${phone}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene todos los clientes de un tenant ordenados por su última actualización (último mensaje)
   */
  async getCustomersByTenant(tenantId: string): Promise<Customer[]> {
    try {
      return await this.prisma.customer.findMany({
        where: { tenantId },
        include: { tags: true },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error obteniendo clientes para el tenant ${tenantId}:`, error);
      throw error;
    }
  }
}
