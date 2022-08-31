import {createClient} from "@redis/client"
import {Module} from "@nestjs/common";

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
            provide: 'REDIS_CLIENT',
            useFactory: async (options: { url: string }) => {
                const client = createClient(options);
                await client.connect();
                return client;
            }
        }
    ],
    exports: ['REDIS_CLIENT'],
})
export class RedisModule {}