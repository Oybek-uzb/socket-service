import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.register([
      {
        name: 'SOCKET_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_MQ_URI],
          queue: process.env.RABBIT_MQ_SOCKET_SERVICE_QUEUE,
          queueOptions: {
            durable: false,
          },
        },
      },
    ]),
  ],
})
export class RmqModule {}
