import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module';
import { RmqModule } from './rmq/rmq.module';
import { RedisModule } from './redis/redis.module';
import { BullModule } from '@nestjs/bull';
import { OrderProcessingConsumer } from './bull/queue.processor';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    BullModule.registerQueue({
      name: 'order-processing',
      redis: {
        host: process.env.REDIS_HOST,
        port: +process.env.REDIS_PORT,
      },
    }),
    RedisModule,
    DatabaseModule,
    RmqModule,
    SocketModule,
  ],
  controllers: [AppController],
  providers: [AppService, OrderProcessingConsumer],
})
export class AppModule {}
