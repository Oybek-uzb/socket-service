import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './db/database.service';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Request, Response } from 'express';
import { searchDriver } from './utils/orders';
import { ServerGateway } from './socket/socket.gateway';
import { RmqContext } from '@nestjs/microservices';
import { EventBody } from './dto/event_body';
import { CityOrder, Order, OrderInfo, OrderStatuses } from './dto/orders';
import {
  Driver,
  DriverFromGeoRedis,
  ResponseAllOnlineDrivers,
} from './dto/driver';

@Injectable()
export class AppService {
  private readonly skip_time = 20000;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly io: ServerGateway,
    private readonly db: DatabaseService,
    @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
    @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
    @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
    @Inject('REDIS_GEO_CLIENT') private readonly drivers: any,
    @InjectQueue('order-processing') private readonly queue: Queue,
  ) {}

  async rmqConsume(body: EventBody, context: RmqContext) {
    let user_id, user_type: string, soc: string;
    if (body.driver_id === undefined && body.client_id !== 0) {
      user_id = body.client_id;
      user_type = 'client';
      soc = 'client_orders';
      delete body.client_id;
    }
    if (body.client_id === undefined && body.driver_id !== undefined) {
      user_id = body.driver_id;
      user_type = 'driver';
      soc = 'driver_orders';
      delete body.driver_id;
    }

    this.redisPubClient.get(
      `sid${user_type}${user_id}`,
      this.emitFromConsumer.bind(this, soc, body),
    );
  }

  async emitFromConsumer(
    soc: string,
    body: EventBody,
    err: Error,
    value: string,
  ) {
    try {
      if (err) {
        console.error('error');
        console.info('error order ' + body.id);
      } else {
        this.io.server.to(value).emit(soc, body);
      }
    } catch (e) {
      this.logger.error('Error in function emitFromConsumer: ', e);
    }
  }

  async searchDrivers(request: Request, response: Response) {
    const ip =
      request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    let order_info: OrderInfo;
    let sub_order: CityOrder;
    let order: Order;

    try {
      [order] = await this.db.executeQuery(
        `SELECT * FROM orders WHERE id=${request.params.id} AND order_type='city' AND order_status='new'`,
      );

      if (order) {
        [sub_order] = await this.db.executeQuery(
          `SELECT * FROM city_orders WHERE id=${order.order_id}`,
        );
      }
    } catch (e) {
      this.logger.error(e);
    }

    if (order && sub_order && sub_order.points.points.length > 0) {
      order_info = {
        id: order.id,
        client_id: order.client_id,
        distance: sub_order.points.distance,
        from: sub_order.points.points[0].address,
        to:
          sub_order.points.points.length == 1
            ? null
            : sub_order.points.points[sub_order.points.points.length - 1]
                .address,
        from_loc: sub_order.points.points[0].location,
        to_loc:
          sub_order.points.points.length == 1
            ? null
            : sub_order.points.points[sub_order.points.points.length - 1]
                .location,
        payment_type: sub_order.payment_type,
        tariff_id: sub_order.tariff_id,
        has_conditioner: sub_order.has_conditioner,
        comments: sub_order.comments,
        status: order.order_status,
        attempts: 1,
        jobId: 'order-' + order.id + '-1',
      };
    }

    try {
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
        const job = await this.queue.getJob(order_info.jobId);
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
    } catch (e) {
      this.logger.error('Error in searchDrivers function: ', e);
    }
  }

  async searchDriversSkip(request: Request, response: Response) {
    let order_info_string: string | null;
    try {
      order_info_string = await this.redisAsyncClient.get(
        `cityorder${request.params.id}`,
      );
    } catch (e) {
      this.logger.error(
        'Error in searchDriversSkip function while getting data from redis: ',
        e,
      );
    }

    try {
      if (order_info_string == null) {
        return response.status(200).json({
          success: true,
        });
      } else {
        const order_info: OrderInfo = JSON.parse(order_info_string);
        const job = await this.queue.getJob(order_info.jobId);

        await job?.remove();
        order_info.attempts = order_info.attempts + 1;
        order_info.jobId = 'order-' + order_info.id + '-' + order_info.attempts;

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

        const lastjob = await this.queue.getJob(order_info.jobId);
        await lastjob?.remove();
        await this.queue.add(order_info, {
          jobId: order_info.jobId,
          delay: this.skip_time,
        });
      }
      return response.status(200).json({
        success: true,
      });
    } catch (e) {
      this.logger.error('Error in searchDriversSkip function: ', e);
    }
  }

  homePage(request: Request, response: Response): void {
    return response.sendFile(__dirname + '/' + 'index.html');
  }

  async searchDriversCancel(request: Request, response: Response) {
    let order_info_string: string | null;
    try {
      order_info_string = await this.redisAsyncClient.get(
        `cityorder${request.params.id}`,
      );
    } catch (e) {
      this.logger.error(
        'Error in searchDriversCancel function while getting data from redis: ',
        e,
      );
    }

    try {
      if (order_info_string == null) {
        return response.status(200).json({
          success: true,
        });
      } else {
        const order_info: OrderInfo = JSON.parse(order_info_string);
        for (let index = 1; index <= 10; index++) {
          const lastjob = await this.queue.getJob(
            'order-' + order_info.id + '-' + index,
          );
          await lastjob?.remove();
        }

        order_info.status = OrderStatuses.ClientCancelled;
        const driver_id: string = await this.redisAsyncClient.get(
          `order_driver_${order_info.id}`,
        );

        const socket_id: string = await this.redisAsyncClient.get(
          `siddriver${driver_id}`,
        );

        this.io.server.to(socket_id).emit(`driver_orders`, {
          id: order_info.id,
          status: OrderStatuses.ClientCancelled,
        });

        return response.status(200).json({
          success: true,
        });
      }
    } catch (e) {
      this.logger.error('Error in function searchDriversCancel: ', e);
    }
  }

  async searchDriversAccept(request: Request, response: Response) {
    let order_info_string: string | null;
    try {
      order_info_string = await this.redisAsyncClient.get(
        `cityorder${request.params.id}`,
      );
    } catch (e) {
      this.logger.error(
        'Error in searchDriversAccept function while getting data from redis: ',
        e,
      );
    }

    try {
      if (order_info_string == null) {
        return response.status(200).json({
          success: true,
        });
      } else {
        const order_info: OrderInfo = JSON.parse(order_info_string);
        for (let index = 1; index <= 10; index++) {
          const lastjob = await this.queue.getJob(
            'order-' + order_info.id + '-' + index,
          );
          await lastjob?.remove();
        }
        return response.status(200).json({
          success: true,
        });
      }
    } catch (e) {
      this.logger.error('Error in searchDriversAccept function: ', e);
    }
  }

  async getAllOnlineDrivers(): Promise<ResponseAllOnlineDrivers | Error> {
    const options = {
      withCoordinates: true,
      withHashes: false,
      withDistances: true,
      order: 'ASC',
      units: 'km',
    };

    const response: ResponseAllOnlineDrivers = {
      success: false,
      body: null,
    };

    const drivers: Driver[] = [];
    let driver_id = 0;

    const [latitude, longitude] = [41.375634, 69.198809];
    try {
      const promise = new Promise<DriverFromGeoRedis[]>((resolve, reject) => {
        this.drivers.radius(
          { latitude, longitude },
          100000,
          options,
          (err: Error, driversList: DriverFromGeoRedis[]) => {
            if (err) {
              reject(err);
            } else {
              resolve(driversList);
            }
          },
        );
      });

      const driversList: DriverFromGeoRedis[] = await promise;

      driversList.forEach((driver) => {
        driver_id = +driver.key.split('_')[1];
        drivers.push({
          id: driver_id,
          latitude: driver.latitude,
          longitude: driver.longitude,
          bearing: null,
        });
      });

      let value: string;
      for (let i = 0; i < drivers.length; i++) {
        value = await this.redisAsyncClient.get(`driver_${drivers[i].id}_vb`);

        if (value) {
          drivers[i].bearing = parseInt(value.split(':')[1]);
        }
      }

      response.success = true;
      response.body = drivers;

      return response;
    } catch (err) {
      this.logger.error(err);
      return response;
    }
  }
}
