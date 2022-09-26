import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ServerGateway } from './socket.gateway';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [RedisModule, DatabaseModule],
  providers: [ServerGateway],
  exports: [ServerGateway],
})
export class SocketModule {}
