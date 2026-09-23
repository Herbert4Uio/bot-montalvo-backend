import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../core/logger.service';
import makeWASocket, { DisconnectReason, initAuthCreds, BufferJSON, WASocket, WAProto } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { MessageBufferService } from './message-buffer.service';
import pino from 'pino';
import { PrismaService } from '../core/prisma.service';

export interface TenantConnectionStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_READY';
  qr?: string;
}

@Injectable()
export class SessionManagerService implements OnModuleInit, OnModuleDestroy {
  private sockets: Map<string, WASocket> = new Map();
  private statuses: Map<string, TenantConnectionStatus> = new Map();
  private phoneToJidMap: Map<string, string> = new Map();

  constructor(
    private readonly logger: LoggerService,
    private readonly messageBuffer: MessageBufferService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('SessionManagerService iniciado.');
    await this.autoConnectSessions();
  }

  private async autoConnectSessions() {
    try {
      const distinctSessions = await this.prisma.baileysAuth.findMany({
        select: { tenantId: true },
        distinct: ['tenantId'],
      });

      for (const session of distinctSessions) {
        const tenantId = session.tenantId;
        this.logger.log(`Restaurando sesión de WhatsApp (PostgreSQL) para Tenant: ${tenantId}`);
        this.connectTenant(tenantId).catch(err => {
          this.logger.error(`Error restaurando sesión para ${tenantId}:`, err);
        });
      }
    } catch (err) {
      this.logger.warn('No se encontraron sesiones previas en la BD o error conectando:', err);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Cerrando todos los sockets por Graceful Shutdown...');
    for (const [tenantId, socket] of this.sockets.entries()) {
      socket.end(new Error('Servidor apagándose'));
    }
  }

  private async usePrismaAuthState(tenantId: string) {
    const readData = async (type: string, id: string) => {
      const parsedId = `${type}-${id}`;
      const data = await this.prisma.baileysAuth.findUnique({
        where: { tenantId_sessionId: { tenantId, sessionId: parsedId } },
      });
      if (data && data.authData) {
        return JSON.parse(data.authData, BufferJSON.reviver);
      }
      return null;
    };

    const writeData = async (data: any, type: string, id: string) => {
      const parsedId = `${type}-${id}`;
      const dataToSave = JSON.stringify(data, BufferJSON.replacer);
      
      await this.prisma.baileysAuth.upsert({
        where: { tenantId_sessionId: { tenantId, sessionId: parsedId } },
        update: { authData: dataToSave },
        create: { tenantId, sessionId: parsedId, authData: dataToSave },
      });
    };

    const removeData = async (type: string, id: string) => {
      const parsedId = `${type}-${id}`;
      await this.prisma.baileysAuth.deleteMany({
        where: { tenantId, sessionId: parsedId },
      });
    };

    const creds = (await readData('creds', 'default')) || initAuthCreds();

    // In-memory cache para que Baileys no se congele esperando a NeonDB
    const cache = new Map<string, any>();

    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const data: { [key: string]: any } = {};
            const missingIds: string[] = [];

            // Leer de caché primero
            for (const id of ids) {
              const parsedId = `${type}-${id}`;
              if (cache.has(parsedId)) {
                data[id] = cache.get(parsedId);
              } else {
                missingIds.push(id);
              }
            }

            // Lo que no esté en caché, buscarlo en Prisma
            if (missingIds.length > 0) {
              const chunkSize = 5;
              for (let i = 0; i < missingIds.length; i += chunkSize) {
                const chunk = missingIds.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (id) => {
                  let value = await readData(type, id);
                  if (type === 'app-state-sync-key' && value) {
                    value = WAProto.Message.AppStateSyncKeyData.fromObject(value);
                  }
                  data[id] = value;
                  cache.set(`${type}-${id}`, value); // Guardar en caché
                }));
              }
            }
            return data;
          },
          set: async (data: any) => {
            // Fire-and-forget background processing para NO BLOQUEAR A BAILEYS
            Promise.resolve().then(async () => {
              const tasks: (() => Promise<void>)[] = [];
              for (const category in data) {
                for (const id in data[category]) {
                  const value = data[category][id];
                  const type = category;
                  const parsedId = `${type}-${id}`;
                  
                  if (value) {
                    cache.set(parsedId, value); // Actualizar caché instantáneamente
                    tasks.push(() => writeData(value, type, id));
                  } else {
                    cache.delete(parsedId);
                    tasks.push(() => removeData(type, id));
                  }
                }
              }
              
              // Chunking seguro para escritura en background (5 a la vez)
              const chunkSize = 5;
              for (let i = 0; i < tasks.length; i += chunkSize) {
                const chunk = tasks.slice(i, i + chunkSize);
                await Promise.all(chunk.map(fn => fn()));
              }
            }).catch(err => {
              this.logger.error(`[Baileys] Error en background write de keys: ${err.message}`);
            });
          },
        },
      },
      saveCreds: () => writeData(creds, 'creds', 'default'),
    };
  }

  async connectTenant(tenantId: string): Promise<void> {
    if (this.sockets.has(tenantId)) {
      this.logger.log(`Tenant ${tenantId} ya tiene un socket activo.`);
      return;
    }

    this.statuses.set(tenantId, { status: 'CONNECTING' });

    try {
      const { state, saveCreds } = await this.usePrismaAuthState(tenantId);

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'info' }) as any,
        browser: ['CRM Bot', 'Chrome', '1.0.0'],
      });

      this.sockets.set(tenantId, socket);

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('messages.upsert', async (m) => {
        this.logger.log(`[Baileys] Evento messages.upsert recibido. Tipo: ${m.type}, Cantidad: ${m.messages.length}`);
        
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            this.logger.log(`[Baileys] Evaluando mensaje de: ${msg.key.remoteJid} | fromMe: ${msg.key.fromMe}`);

            // Ignorar mensajes enviados por nosotros mismos o system messages vacíos
            if (!msg.message || msg.key.fromMe) {
              this.logger.log(`[Baileys] Mensaje ignorado (es fromMe o sin contenido válido).`);
              continue;
            }

            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              '';

            if (!text.trim()) {
              this.logger.log(`[Baileys] Mensaje ignorado de ${msg.key.remoteJid}: no tiene texto plano (puede ser multimedia o sistema).`);
              continue;
            }

            this.logger.log(`[Baileys] Texto extraído del mensaje: "${text}"`);

            if (!text) {
              this.logger.log(`[Baileys] Mensaje sin texto, ignorando (puede ser audio/sticker sin caption).`);
              continue;
            }

            const remoteJid = msg.key.remoteJid!;
            const customerPhone = remoteJid.split('@')[0];
            
            let customerPhoneReal: string | undefined;
            if (remoteJid.includes('@lid')) {
              const pnjid = (msg.key as any).remoteJidAlt || (msg.key as any).participantAlt;
              if (pnjid && typeof pnjid === 'string') {
                customerPhoneReal = pnjid.split('@')[0].split(':')[0];
              }
            } else {
              customerPhoneReal = customerPhone.split(':')[0];
            }
            
            // Guardar mapeo de JID real para poder responderle después si es @lid
            this.phoneToJidMap.set(`${tenantId}:${customerPhone}`, remoteJid);

            this.logger.log(`[Baileys] Derivando mensaje de ${customerPhone} al MessageBuffer...`);

            this.messageBuffer.pushMessage({
              tenantId,
              customerId: customerPhone,
              customerPhone,
              customerPhoneReal,
              customerJid: remoteJid, // Guardar el JID original exacto para responder
              customerProfileName: msg.pushName || undefined,
              text,
            });
          }
        }
      });

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrBase64 = await QRCode.toDataURL(qr);
            this.statuses.set(tenantId, { status: 'QR_READY', qr: qrBase64 });
            this.logger.log(`[Baileys] QR generado y listo para escanear para Tenant ${tenantId}`);
          } catch (err) {
            this.logger.error(`[Baileys] Error generando QR para Tenant ${tenantId}:`, err);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          this.logger.warn(`[Baileys] Conexión cerrada para Tenant ${tenantId}. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);
          this.statuses.set(tenantId, { status: 'DISCONNECTED' });
          this.sockets.delete(tenantId);

          if (shouldReconnect) {
            // Aislamiento: No hacemos crash de Node.js, simplemente intentamos reconectar.
            this.logger.log(`[Baileys] Intentando reconectar Tenant ${tenantId} en 5 segundos...`);
            setTimeout(() => this.connectTenant(tenantId), 5000);
          } else {
            // La sesión fue invalidada (ej. el usuario cerró sesión en su teléfono o WhatsApp la rechazó).
            // Borramos la data de BD para que el próximo intento genere un QR nuevo.
            try {
              await this.prisma.baileysAuth.deleteMany({
                where: { tenantId },
              });
              this.logger.log(`[Baileys] Credenciales de BD invalidadas/borradas para Tenant ${tenantId} (Sesión cerrada en el móvil)`);
            } catch (e) {
              this.logger.error(`[Baileys] Error borrando credenciales caducadas en BD para ${tenantId}:`, e);
            }
          }
        } else if (connection === 'open') {
          this.logger.log(`[Baileys] Tenant ${tenantId} conectado exitosamente a WhatsApp! 🟢`);
          this.statuses.set(tenantId, { status: 'CONNECTED' });
        }
      });

      // Se omiten los listeners de mensajes por ahora, se inyectarán después
    } catch (error) {
      this.logger.error(`Error aislado conectando Tenant ${tenantId}:`, error);
      this.statuses.set(tenantId, { status: 'DISCONNECTED' });
      this.sockets.delete(tenantId);
    }
  }

  async disconnectTenant(tenantId: string): Promise<void> {
    const socket = this.sockets.get(tenantId);
    if (socket) {
      this.logger.log(`Cerrando sesión de WhatsApp para Tenant ${tenantId} a petición del usuario.`);
      try { await socket.logout(); } catch (e) {}
      this.sockets.delete(tenantId);
    }
    
    // Forzar el borrado de credenciales de la BD
    try {
      await this.prisma.baileysAuth.deleteMany({
        where: { tenantId },
      });
      this.logger.log(`Credenciales olvidadas en PostgreSQL para Tenant ${tenantId}`);
    } catch (e) {
      this.logger.error(`Error borrando credenciales en DB para Tenant ${tenantId}:`, e);
    }

    this.statuses.set(tenantId, { status: 'DISCONNECTED' });
  }

  getSocket(tenantId: string): WASocket | undefined {
    return this.sockets.get(tenantId);
  }

  getStatus(tenantId: string): TenantConnectionStatus {
    return this.statuses.get(tenantId) || { status: 'DISCONNECTED' };
  }

  async sendMessage(tenantId: string, toPhone: string, text: string): Promise<void> {
    const socket = this.sockets.get(tenantId);
    if (!socket) {
      this.logger.warn(`No hay socket activo para Tenant ${tenantId}. No se pudo enviar el mensaje.`);
      return;
    }

    try {
      // Buscar el JID real en caché, o usar un default
      let jid = this.phoneToJidMap.get(`${tenantId}:${toPhone}`);
      if (!jid) {
        jid = toPhone.includes('@') ? toPhone : `${toPhone}@s.whatsapp.net`;
      }
      
      await socket.sendMessage(jid, { text });
      this.logger.log(`Mensaje enviado a ${jid} desde Tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Error enviando mensaje a ${toPhone} desde Tenant ${tenantId}:`, error);
    }
  }
}
