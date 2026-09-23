import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { groupBy, mergeMap, buffer, debounceTime, filter } from 'rxjs/operators';
import { LoggerService } from '../core/logger.service';
import { WhatsappGateway } from './whatsapp.gateway';

export interface IncomingMessagePayload {
  tenantId: string;
  customerId: string;
  customerPhone: string;
  customerPhoneReal?: string;
  customerJid?: string;
  customerProfileName?: string;
  text: string;
}

@Injectable()
export class MessageBufferService implements OnModuleInit, OnModuleDestroy {
  private messageSubject = new Subject<IncomingMessagePayload>();
  private subscription: Subscription;

  public readonly onGroupedMessage = new Subject<{
    tenantId: string;
    customerId: string;
    customerPhone: string;
    customerPhoneReal?: string;
    customerJid?: string;
    customerProfileName?: string;
    messages: string[];
    fullText: string;
  }>();

  constructor(
    private readonly logger: LoggerService,
    private readonly gateway: WhatsappGateway,
  ) {}

  onModuleInit() {
    this.subscription = this.messageSubject
      .pipe(
        groupBy((payload) => `${payload.tenantId}:${payload.customerId}`),
        mergeMap((group$) =>
          group$.pipe(
            buffer(group$.pipe(debounceTime(3000))),
            filter((messages) => messages.length > 0)
          )
        )
      )
      .subscribe((bufferedMessages) => {
        const first = bufferedMessages[0];
        const fullText = bufferedMessages.map((m) => m.text).join('\n');

        this.logger.log(`Mensajes agrupados para ${first.tenantId}:${first.customerPhone} -> ${bufferedMessages.length} mensajes.`);

        const groupedPayload = {
          tenantId: first.tenantId,
          customerId: first.customerId,
          customerPhone: first.customerPhone,
          customerPhoneReal: first.customerPhoneReal,
          customerJid: first.customerJid,
          customerProfileName: first.customerProfileName,
          messages: bufferedMessages.map((m) => m.text),
          fullText,
        };

        // Emitir a los observadores internos (Ej. AI o Máquina de estados)
        this.onGroupedMessage.next(groupedPayload);

        // Emitir en tiempo real al CRM conectado
        this.gateway.emitToCrm(first.tenantId, 'new_message', groupedPayload);
      });
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Ingresa un nuevo mensaje al sistema de buffering
   */
  pushMessage(payload: IncomingMessagePayload) {
    this.messageSubject.next(payload);
  }
}
