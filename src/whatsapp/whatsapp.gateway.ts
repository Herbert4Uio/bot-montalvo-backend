import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../core/logger.service';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción restringir al dominio del CRM
  },
  namespace: '/whatsapp',
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly logger: LoggerService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Cliente de CRM conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente de CRM desconectado: ${client.id}`);
  }

  /**
   * Emite un evento en tiempo real al frontend del CRM
   * @param tenantId ID de la empresa a la que pertenece el mensaje
   * @param eventName Nombre del evento (ej. 'new_message', 'status_update')
   * @param payload Datos del evento
   */
  emitToCrm(tenantId: string, eventName: string, payload: any) {
    // Por simplicidad en este MVP, emitimos a todos. 
    // Lo ideal es usar rooms de socket.io: this.server.to(`tenant_${tenantId}`).emit(...)
    this.server.emit(eventName, { tenantId, ...payload });
  }
}
