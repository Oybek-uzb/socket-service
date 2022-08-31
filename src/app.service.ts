import { Inject, Injectable} from '@nestjs/common';
import {DatabaseService} from "./db/database.service";
import Redis from "ioredis";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull"
import {Request, Response} from "express";
import {searchDriver} from "./utils/orders";
import {ServerGateway} from "./socket/socket.gateway";
import {queue} from "rxjs";

@Injectable()
export class AppService {
  private readonly skip_time = 20000;

  constructor(
      private readonly db: DatabaseService,
      private readonly io: ServerGateway,
      @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
      @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
      @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
      @Inject('REDIS_GEO_CLIENT') private readonly drivers: Redis,
      @InjectQueue('order-processing') private readonly queue: Queue,
  ) {}

  async getHello(): Promise<string> {

    // const qu = "INSERT INTO users(name) VALUES ('John')"
    // let ex = await this.db.executeQuery(qu);
    //
    // const q = "SELECT * FROM users";
    // let exec = await this.db.executeQuery(q);
    // console.log(exec)
    // console.log(this.redisGeoClient)
    return 'Hello World!';
  }

  async searchDrivers(request: Request, response: Response) {
    let order_info_string = await this.redisAsyncClient.get(`cityorder${request.params.id}`);
    if(order_info_string == null){
      return response.status(200).json({
        success: true
      })
    }else{
      let order_info = JSON.parse(order_info_string)
      let job = await this.queue.getJob(order_info.jobId);
      await job?.remove();
      order_info.attempts = parseInt(order_info.attempts) + 1
      order_info.jobId = "order-"+order_info.id+"-"+parseInt(order_info.attempts)
      await this.redisPubClient.set(`cityorder${order_info.id}`, JSON.stringify(order_info), 'EX', 4 * 60);
      await searchDriver(this.drivers, order_info, this.io, this.redisAsyncClient, this.redisPubClient, this.db)
      let lastjob = await this.queue.getJob(order_info.jobId);
      await lastjob?.remove();
      await this.queue.add(order_info, {
        jobId: order_info.jobId,
        delay: this.skip_time
      })
    }
    return response.status(200).json({
      success: true
    })
  }
}
