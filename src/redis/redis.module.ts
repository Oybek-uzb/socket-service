import {createClient} from "@redis/client"
import * as asyncRedis from "async-redis"
import * as geoRedis from "georedis"
import {Module} from "@nestjs/common";
import Redis from "ioredis";

@Module({
    providers: [
        {
            provide: 'REDIS_OPTIONS',
            useValue: {
                url: 'redis://localhost:6379'
            }
        },
        {
            inject: ['REDIS_OPTIONS'],
            provide: 'REDIS_PUB_CLIENT',
            useFactory: async (options: { url: string }) => {
                const client = createClient(options);
                await client.connect();
                return client;
            }
        },
        {
            inject: ['REDIS_OPTIONS'],
            provide: 'REDIS_SUB_CLIENT',
            useFactory: async (options: { url: string }) => {
                const client = createClient(options);
                await client.connect();
                return client;
            }
        },
        {
            inject: ['REDIS_PUB_CLIENT'],
            provide: 'REDIS_ASYNC_CLIENT',
            useFactory: async (client: Redis) => {
                return asyncRedis["decorate"](client)
            }
        },
        {
            inject: ['REDIS_PUB_CLIENT'],
            provide: 'REDIS_GEO_CLIENT',
            useFactory: (client: Redis) => {
                const geo_redis = geoRedis.initialize(client)
                return geo_redis.addSet('drivers');
            }
        },
    ],
    exports: ['REDIS_PUB_CLIENT', 'REDIS_SUB_CLIENT', 'REDIS_ASYNC_CLIENT', 'REDIS_GEO_CLIENT'],
})
export class RedisModule {}