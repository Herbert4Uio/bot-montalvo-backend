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
  ): Promise<Customer> {
    try {
      const customer = await this.prisma.customer.upsert({
        where: {
          phone_tenantId: {
            phone,
            tenantId,
          },
        },
        update: {
          profileName: profileName || undefined,
        },
        create: {
          phone,
          tenantId,
          profileName,
        },
      });

      return customer;
    } catch (error) {
      this.logger.error(`Error en upsertCustomer para ${phone}:`, error);
      throw error;
    }
  }
}
