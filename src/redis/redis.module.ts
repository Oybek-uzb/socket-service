import * as asyncRedis from 'async-redis';
import * as geoRedis from 'georedis';
import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      inject: [ConfigService],
      provide: 'REDIS_PUB_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const pubClient = new Redis(
          configService.get<number>('REDIS_PORT'),
          configService.get<string>('REDIS_HOST'),
        );
        pubClient.on('error', (err) => {
          console.log('Redis PubClient error: ', err);
        });
        return pubClient;
      },
    },
    {
      inject: [ConfigService],
      provide: 'REDIS_SUB_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const subClient = new Redis(
          configService.get<number>('REDIS_PORT'),
          configService.get<string>('REDIS_HOST'),
        );
        subClient.on('error', (err) => {
          console.log('Redis SubClient error: ', err);
        });
        return subClient;
      },
    },
    {
      inject: ['REDIS_PUB_CLIENT'],
      provide: 'REDIS_ASYNC_CLIENT',
      useFactory: async (client: Redis) => {
        return asyncRedis['decorate'](client);
      },
    },
    {
      inject: ['REDIS_PUB_CLIENT'],
      provide: 'REDIS_GEO_CLIENT',
      useFactory: async (client: Redis) => {
        const geo_redis = geoRedis.initialize(client);
        geo_redis.addSet('drivers');
        return geo_redis;
      },
    },
  ],
  exports: [
    'REDIS_PUB_CLIENT',
    'REDIS_SUB_CLIENT',
    'REDIS_ASYNC_CLIENT',
    'REDIS_GEO_CLIENT',
  ],
})
export class RedisModule {}
