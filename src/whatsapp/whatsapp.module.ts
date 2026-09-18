import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { SessionManagerService } from './session-manager.service';
import { MessageBufferService } from './message-buffer.service';
import { WhatsappGateway } from './whatsapp.gateway';

@Module({
  controllers: [WhatsappController],
  providers: [
    SessionManagerService,
    MessageBufferService,
    WhatsappGateway,
  ],
  exports: [
    SessionManagerService,
    MessageBufferService,
    WhatsappGateway,
  ],
})
export class WhatsappModule {}
