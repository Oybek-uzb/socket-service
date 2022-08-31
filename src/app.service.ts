import { Inject, Injectable} from '@nestjs/common';
import {DatabaseService} from "./db/database.service";
import Redis from "ioredis";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull"

@Injectable()
export class AppService {
  constructor(
      private readonly db: DatabaseService,
      @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
      @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
      @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
      @Inject('REDIS_GEO_CLIENT') private readonly redisGeoClient: Redis,
      @InjectQueue('order-processing') private readonly queue: Queue,
  ) {}

  async getHello(): Promise<string> {

    // const qu = "INSERT INTO users(name) VALUES ('John')"
    // let ex = await this.db.executeQuery(qu);
    //
    // const q = "SELECT * FROM users";
    // let exec = await this.db.executeQuery(q);
    // console.log(exec)
    console.log(this.redisGeoClient)
    return 'Hello World!';
  }
}
