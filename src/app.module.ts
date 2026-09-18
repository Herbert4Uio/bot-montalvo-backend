import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { CustomerModule } from './customer/customer.module';
import { BotModule } from './bot/bot.module';
import { AiModule } from './ai/ai.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CoreModule, WhatsappModule, CustomerModule, AiModule, BotModule, TenantModule, UsersModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
