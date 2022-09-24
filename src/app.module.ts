import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module';
import { RmqModule } from './rmq/rmq.module';
import { RedisModule } from './redis/redis.module';
import { BullModule } from '@nestjs/bull';
import { OrderProcessingConsumer } from './bull/queue.processor';
import { EmitterService } from './emitter/emitter.service';
import { SocketModule } from './socket/socket.module';
import { EmitterModule } from './emitter/emitter.module';
import { ServerGateway } from './socket/socket.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    BullModule.registerQueue({
      name: 'order-processing',
      redis: {
        host: 'redis',
        port: 6379,
      },
    }),
    RedisModule,
    DatabaseModule,
    RmqModule,
    SocketModule,
    EmitterModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    OrderProcessingConsumer,
  ],
})
export class AppModule {}
