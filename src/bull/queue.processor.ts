import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, DoneCallback, Queue } from 'bull';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { DatabaseService } from '../db/database.service';
import { ServerGateway } from '../socket/socket.gateway';
import { searchDriver } from '../utils/orders';
import { Sequelize } from 'sequelize';
import { SEQUELIZE } from '../constants';

@Processor('order-processing')
export class OrderProcessingConsumer {
  private readonly skip_time = 20000;
  constructor(
    @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
    @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
    @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
    @Inject('REDIS_GEO_CLIENT') private readonly drivers: Redis,
    private readonly io: ServerGateway,
    private readonly db: DatabaseService,
  ) {}
  @Process()
  async processNamedJob(job: Job<any>, done: DoneCallback): Promise<any> {
    if (job.data.attempts <= 10) {
      let order_info = job.data;
      order_info.attempts = parseInt(order_info.attempts) + 1;
      order_info.jobId =
        'order-' + order_info.id + '-' + parseInt(order_info.attempts);
      await this.redisPubClient.set(
        `cityorder${job.data.id}`,
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
      let lastjob = await job.queue.getJob(order_info.jobId);
      await lastjob?.remove();
      await job.queue.add(order_info, {
        jobId: order_info.jobId,
        delay: this.skip_time,
      });
    }
    done();
  }
}
