import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { LoggerService } from './core/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Habilitar CORS para permitir peticiones desde Vite (Frontend)
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('WhatsApp Multi-Tenant CRM API')
    .setDescription('API REST para administración de tenants y clientes del chatbot')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  logger.log('Aplicación iniciada en http://localhost:3000');
  logger.log('Swagger UI disponible en http://localhost:3000/api/docs');
}
bootstrap();
