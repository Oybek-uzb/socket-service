import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SocketModule } from '../socket/socket.module';
import { EmitterService } from './emitter.service';

@Module({
  imports: [RedisModule],
  providers: [EmitterService],
  exports: [EmitterService]
})
export class EmitterModule {}
