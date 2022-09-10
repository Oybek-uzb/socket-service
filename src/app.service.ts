import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './db/database.service';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Request, Response } from 'express';
import { searchDriver } from './utils/orders';
import { ServerGateway } from './socket/socket.gateway';
import { RmqService } from './rmq/rmq.service';
import { RmqContext } from '@nestjs/microservices';

@Injectable()
export class AppService {
  private readonly skip_time = 20000;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly io: ServerGateway,
    private readonly rmq: RmqService,
    private readonly db: DatabaseService,
    @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
    @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
    @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
    @Inject('REDIS_GEO_CLIENT') private readonly drivers: Redis,
    @InjectQueue('order-processing') private readonly queue: Queue,
  ) {}

  async check(data: any, context: RmqContext) {
    let body = JSON.parse(data.content.toString());
    let user_id, user_type, soc;
    if (body.driver_id === undefined && body.client_id !== 0) {
      user_id = body['client_id'];
      user_type = 'client';
      soc = 'client_orders';
      delete body['client_id'];
    }
    if (body.client_id === undefined && body.driver_id !== undefined) {
      user_id = body['driver_id'];
      user_type = 'driver';
      soc = 'driver_orders';
      delete body['driver_id'];
    }
    console.log(body, user_id, user_type, soc);
    this.redisPubClient.get(
      `sid${user_type}${user_id}`,
      this.handleCheck.bind(this, soc, body),
    );
  }

  handleCheck(soc, body, err, value) {
    if (err) {
      console.error('error');
      console.info('error order ' + body['order_id']);
    } else {
      this.io.server.to(value).emit(soc, body);
    }
  }

  async searchDrivers(request: Request, response: Response) {
    let ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    //console.log(ip)
    let order_info = null;
    let sub_order;
    let order;
    
    try {
      order = await this.db.executeQuery(
        `SELECT * FROM orders WHERE id=${request.params.id} AND order_type='city' AND order_status='new'`,
      );
      
      if (order.length == 1) {
        sub_order = await this.db.executeQuery(
          `SELECT * FROM city_orders WHERE id=${order[0].order_id}`,
        );
      }
      
    } catch (e) {
      this.logger.error(e)
    }
    
    
    if (
      order.length == 1 &&
      sub_order.length == 1 &&
      sub_order[0].points.points.length > 0
    ) {
      order_info = {
        id: order[0].id,
        client_id: order[0].client_id,
        distance: sub_order[0].points.distance,
        from: sub_order[0].points.points[0].address,
        to:
          sub_order[0].points.points.length == 1
            ? null
            : sub_order[0].points.points[sub_order[0].points.points.length - 1]
                .address,
        from_loc: sub_order[0].points.points[0].location,
        to_loc:
          sub_order[0].points.points.length == 1
            ? null
            : sub_order[0].points.points[sub_order[0].points.points.length - 1]
                .location,
        payment_type: sub_order[0].payment_type,
        tariff_id: sub_order[0].tariff_id,
        has_conditioner: sub_order[0].has_conditioner,
        comments: sub_order[0].comments,
        status: order[0].order_status,
        attempts: 1,
        jobId: 'order-' + order[0].id + '-1',
      };
    }
    if (order_info !== null) {
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
      let job = await this.queue.getJob(order_info.jobId);
      await job?.remove();
      await this.queue.add(order_info, {
        jobId: order_info.jobId,
        delay: this.skip_time,
      });
      return response.status(200).json({
        success: true,
      });
    } else {
      return response.status(200).json({
        success: false,
      });
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

  async searchDriversCancel(request: Request, response: Response) {
    let order_info_string = await this.redisAsyncClient.get(
      `cityorder${request.params.id}`,
    );
    if (order_info_string == null) {
      return response.status(200).json({
        success: true,
      });
    } else {
      let order_info = JSON.parse(order_info_string);
      for (let index = 1; index <= 10; index++) {
        let lastjob = await this.queue.getJob(
          'order-' + order_info.id + '-' + index,
        );
        await lastjob?.remove();
      }
      order_info.status = 'client_cancelled';
      let driver_id = await this.redisAsyncClient.get(
        `order_driver_${order_info.id}`,
      );
      let socket_id = await this.redisAsyncClient.get(`siddriver${driver_id}`);
      console.log(order_info, driver_id, socket_id);
      this.io.server.to(socket_id).emit(`driver_orders`, {
        id: order_info.id,
        status: 'client_cancelled',
      });
      return response.status(200).json({
        success: true,
      });
    }
  }

  async searchDriversAccept(request: Request, response: Response) {
    let order_info_string = await this.redisAsyncClient.get(
      `cityorder${request.params.id}`,
    );
    if (order_info_string == null) {
      return response.status(200).json({
        success: true,
      });
    } else {
      let order_info = JSON.parse(order_info_string);
      for (let index = 1; index <= 10; index++) {
        let lastjob = await this.queue.getJob(
          'order-' + order_info.id + '-' + index,
        );
        await lastjob?.remove();
      }
      return response.status(200).json({
        success: true,
      });
    }
  }
}
