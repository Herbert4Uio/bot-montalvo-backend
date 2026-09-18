import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedSuperAdmin();
  }

  async seedSuperAdmin() {
    const superAdminExists = await this.prisma.user.findFirst({
      where: { role: 'SUPERADMIN' },
    });

    if (!superAdminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.prisma.user.create({
        data: {
          email: 'admin@crm.com',
          password: hashedPassword,
          role: 'SUPERADMIN',
        },
      });
      this.logger.log('SuperAdmin creado por defecto: admin@crm.com / admin123');
    }
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
