import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const microservice = app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'socket-service',
      queueOptions: {
        durable: true
      },
    },
  });

  await app.startAllMicroservices();

  app.enableShutdownHooks();
  await app.listen(3002);
}
bootstrap();
