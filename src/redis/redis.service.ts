import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  duplicateClient(): { PubClient: Redis; SubClient: Redis } {
    const pubClient = this.redisClient;
    const subClient = pubClient.duplicate();

    return {
      PubClient: pubClient,
      SubClient: subClient,
    };
  }
}
