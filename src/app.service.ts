import { Inject, Injectable} from '@nestjs/common';
import {DatabaseService} from "./db/database.service";
import Redis from "ioredis";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull"

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService, @Inject('REDIS_CLIENT') private readonly redisClient: Redis, @InjectQueue('my-queue') private queue: Queue) {}

  async getHello(): Promise<string> {
    // const q = "SELECT * FROM users";
    // let exec = await this.db.executeQuery(q);
    // console.log(exec)

    this.queue.add('namedjob', "data")

    return 'Hello World!';
  }
}
