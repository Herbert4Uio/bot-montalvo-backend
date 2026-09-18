import { Module } from '@nestjs/common';
import { OpenAiAdapterService } from './openai.adapter';
import { AiService } from './ai.service';

@Module({
  providers: [OpenAiAdapterService, AiService],
  exports: [AiService],
})
export class AiModule {}
