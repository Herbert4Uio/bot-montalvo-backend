import { Module } from '@nestjs/common';
import { RegexRouterService } from './regex-router.service';
import { StateMachineService } from './state-machine.service';
import { MessageProcessorService } from './message-processor.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CustomerModule } from '../customer/customer.module';
import { AiModule } from '../ai/ai.module';
import { TenantModule } from '../tenant/tenant.module';
import { ChatController } from './chat.controller';
import { MessageLogService } from './message-log.service';

@Module({
  imports: [WhatsappModule, CustomerModule, AiModule, TenantModule],
  controllers: [ChatController],
  providers: [
    RegexRouterService,
    StateMachineService,
    MessageProcessorService,
    MessageLogService,
  ],
  exports: [
    RegexRouterService,
    StateMachineService,
    MessageLogService,
  ],
})
export class BotModule {}
