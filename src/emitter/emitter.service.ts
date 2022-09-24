import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { EmitData, EmitDataForRedis } from '../dto/emit_data';
import { ServerGateway } from '../socket/socket.gateway';

@Injectable()
export class EmitterService {
  constructor(
    @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis
  ) {}

  async emitTillReceived(emitData: EmitData, io: ServerGateway) {
    try {
      const data: string = await this.redisAsyncClient.get(
        `${emitData.data.emit_action_id}`,
      );

      const parsedData: EmitDataForRedis = JSON.parse(data);

      if (!parsedData.timer) {
        const timer = setInterval(
          this.emitContinuously.bind(this, emitData, io),
          3000,
        );
        parsedData.timer = JSON.stringify(timer[Symbol.toPrimitive]());
        parsedData.attempts = 1;
      }

      await this.redisAsyncClient.set(
          `${emitData.data.emit_action_id}`,
          JSON.stringify(parsedData),
      )
    } catch (e) {
      console.log("Error in function emitTillReceived: ", e)
    }
  }

  async emitContinuously(emitData: EmitData, io: ServerGateway) {
    try {
      const data: string = await this.redisAsyncClient.get(
        `${emitData.data.emit_action_id}`,
      );
      if (data) {
        const parsedData: EmitDataForRedis = JSON.parse(data);

        if (parsedData.attempts >= 3) {
          clearInterval(parsedData.timer);
          await this.redisAsyncClient.del(`${emitData.data.emit_action_id}`);
        } else {
          parsedData.attempts++;
          await this.redisAsyncClient.set(
              `${emitData.data.emit_action_id}`,
              JSON.stringify(parsedData),
          );
          io.server.to(emitData.room).emit(emitData.socket, emitData.data);
        }
      }
    } catch (e) {
        console.log("Error in emitContinuously function: ", e)
    }
  }
}
