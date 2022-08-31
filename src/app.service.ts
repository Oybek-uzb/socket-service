import {Inject, Injectable} from '@nestjs/common';
import { DatabaseService } from './db/database.service';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Request, Response } from 'express';
import { searchDriver } from './utils/orders';
import { ServerGateway } from './socket/socket.gateway';

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
    let ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress
    //console.log(ip)
    let order_info = null
    let sub_order
    let order = await this.db.executeQuery(`SELECT * FROM orders WHERE id=${request.params.id} AND order_type='city' AND order_status='new'`);
    if (order.length == 1) {
      sub_order = await this.db.executeQuery(`SELECT * FROM city_orders WHERE id=${order[0].order_id}`);
    }
    if (order.length == 1 && sub_order.length == 1 && sub_order[0].points.points.length > 0) {
      order_info = {
        id: order[0].id,
        client_id: order[0].client_id,
        distance: sub_order[0].points.distance,
        from: sub_order[0].points.points[0].address,
        to: sub_order[0].points.points.length == 1 ? null : sub_order[0].points.points[sub_order[0].points.points.length - 1].address,
        from_loc: sub_order[0].points.points[0].location,
        to_loc: sub_order[0].points.points.length == 1 ? null : sub_order[0].points.points[sub_order[0].points.points.length - 1].location,
        payment_type: sub_order[0].payment_type,
        tariff_id: sub_order[0].tariff_id,
        has_conditioner: sub_order[0].has_conditioner,
        comments: sub_order[0].comments,
        status: order[0].order_status,
        attempts: 1,
        jobId: "order-"+order[0].id+"-1"
      }
    }
    if(order_info !== null){
      await this.redisPubClient.set(`cityorder${order_info.id}`, JSON.stringify(order_info), 'EX', 4 * 60);
      await searchDriver(this.drivers, order_info, this.io, this.redisAsyncClient, this.redisPubClient, this.db)
      let job = await this.queue.getJob(order_info.jobId);
      await job?.remove();
      await this.queue.add(order_info, {
        jobId: order_info.jobId,
        delay: this.skip_time
      })
      return response.status(200).json({
        success: true
      })
    }else{
      return response.status(200).json({
        success: false
      })
    }
  }

  async searchDriversSkip(request: Request, response: Response) {
    let order_info_string = await this.redisAsyncClient.get(
      `cityorder${request.params.id}`,
    );
    if (order_info_string == null) {
      return response.status(200).json({
        success: true,
      });
    } else {
      let order_info = JSON.parse(order_info_string);
      let job = await this.queue.getJob(order_info.jobId);
      await job?.remove();
      order_info.attempts = parseInt(order_info.attempts) + 1;
      order_info.jobId =
        'order-' + order_info.id + '-' + parseInt(order_info.attempts);
      await this.redisPubClient.set(
        `cityorder${order_info.id}`,
        JSON.stringify(order_info),
        'EX',
        4 * 60,
      );
      await searchDriver(
        this.drivers,
        order_info,
        this.io,
        this.redisAsyncClient,
        this.redisPubClient,
        this.db,
      );
      let lastjob = await this.queue.getJob(order_info.jobId);
      await lastjob?.remove();
      await this.queue.add(order_info, {
        jobId: order_info.jobId,
        delay: this.skip_time,
      });
    }
    return response.status(200).json({
      success: true,
    });
  }

  homePage(request: Request, response: Response): void {
    return response.sendFile(__dirname + '/' + 'index.html');
  }
}
