import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as jwtDecode from 'jwt-decode';
import { DatabaseService } from '../db/database.service';
import * as moment from 'moment';
import { NextFunction } from 'express';
import { EmitterService } from '../emitter/emitter.service';
import { EmitData, EmitDataForRedis } from '../dto/emit_data';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
@WebSocketGateway(3100, { cors: true })
export class ServerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
    @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
    @Inject('REDIS_GEO_CLIENT') private readonly drivers: any,
    @Inject('REDIS_ASYNC_CLIENT') private readonly redisAsyncClient: Redis,
    private readonly db: DatabaseService,
    private readonly autoEmitter: EmitterService,
  ) {}

  afterInit(server: Server) {
    server.adapter(createAdapter(this.redisPubClient, this.redisSubClient));
    server.use(async (socket: Socket, next: NextFunction) => {
      const header = socket.handshake.headers['authorization'];
      let is_valid = await this.isValidJwt(header, socket);
      if (is_valid) {
        next();
      } else {
        next(new Error('unauthorized'));
      }
    });
  }

  async isValidJwt(header, socket) {
    const token = header.split(' ')[1];
    let decoded = jwtDecode.default<any>(token);
    // console.log(decodeid.user_type, decoded.user_id)
    process.env.TZ = 'Asia/Tashkent';
    const now = new Date().getTime();
    if (
      Math.floor(now / 1000) > decoded.exp ||
      Math.floor(now / 1000) < decoded.iat ||
      decoded.user_id == undefined ||
      decoded.user_type == undefined
    ) {
      return false;
    }
    await this.redisPubClient.set(
      `sid${decoded.user_type}${decoded.user_id}`,
      socket.id,
      'EX',
      30 * 60,
    );
    return true;
  }

  handleConnection(socket: Socket): any {
    console.log('a user connected');
  }

  @SubscribeMessage('room')
  handleRoom(socket: Socket, room) {
    socket.join(room);
  }

  @SubscribeMessage('driver_locations')
  async handleDriverLocations(socket: Socket, msg) {
    let options = {
      withCoordinates: true,
      withHashes: false,
      withDistances: true,
      order: 'ASC',
      units: 'm',
      count: 20,
      accurate: true,
    };

    const driver = new Promise((resolve, reject) => {
      this.drivers.nearby(
        { latitude: msg.latitude, longitude: msg.longitude },
        msg.distance,
        options,
        function (err, driver) {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            resolve(driver);
          }
        },
      );
    });

    return await driver;
  }

  @SubscribeMessage('send_message')
  handleSendMessage(socket: Socket, msg) {
    this.redisPubClient.get(
      `sid${msg.to}${msg[msg.to + '_id']}`,
      this.emitToMessages.bind(this, msg),
    );
  }

  async emitToMessages(msg, err, value) {
    if (err) {
      console.error('error');
    } else {
      const emit_action_id = uuidv4();

      const emitData: EmitData = {
        data: { ...msg, emit_action_id },
        room: value,
        socket: `messages`,
      };

      const emitDataForRedis: EmitDataForRedis = {
        emit_data: emitData,
        timer: null,
        attempts: 0,
        isReceived: false,
      };

      this.redisPubClient.set(
        `${emitData.data.emit_action_id}`,
        JSON.stringify(emitDataForRedis),
      );
      this.autoEmitter.emitTillReceived(emitData, this);

      // this.server.to(value).emit(`messages`, msg);

      await this.db.executeQuery(
        `INSERT INTO chat_messages (user_type,driver_id,client_id,ride_id,order_id,message_type,content,created_at) VALUES ('${
          msg.from
        }',${msg.driver_id},${msg.client_id},${msg.ride_id},${msg.order_id},'${
          msg.type
        }','${msg.content}','${moment()
          .subtract(5, 'hours')
          .format('YYYY-MM-DD HH:mm:ss')}')`,
      );
    }
  }

  @SubscribeMessage('set_client_location')
  handleSetClientLocation(socket: Socket, msg) {
    this.redisPubClient.get(
      `siddriver${msg.driver_id}`,
      this.emitToClientLocation.bind(this, msg),
    );
  }

  async emitToClientLocation(msg, err, value) {
    if (err) {
      console.error('error');
    } else {
      const emit_action_id = uuidv4();

      const emitData: EmitData = {
        data: { ...msg, emit_action_id },
        room: value,
        socket: `client_location`,
      };

      const emitDataForRedis: EmitDataForRedis = {
        emit_data: emitData,
        timer: null,
        attempts: 0,
        isReceived: false,
      };

      this.redisPubClient.set(
        `${emitData.data.emit_action_id}`,
        JSON.stringify(emitDataForRedis),
      );
      
      this.autoEmitter.emitTillReceived(emitData, this);

      // this.server.to(value).emit(`client_location`, msg);
    }
  }

  @SubscribeMessage('set_driver_offline')
  handleSetDriverOffline(socket: Socket, msg) {
    this.drivers.removeLocation(
      'driver_' + msg.driver_id,
      function (err, reply) {
        if (err) console.error(err);
      },
    );
  }

  @SubscribeMessage('set_driver_location')
  handleSetDriverLocation(socket: Socket, msg) {
    this.drivers.addLocation(
      'driver_' + msg.driver_id,
      { latitude: msg.latitude, longitude: msg.longitude },
      this.addLocation.bind(this, msg),
    );
  }

  addLocation(msg, redis_err, reply) {
    if (redis_err) {
      console.error(redis_err);
    } else {
      process.env.TZ = 'Asia/Tashkent';
      this.redisPubClient.set(
        `driver_${msg.driver_id}_location_last_update`,
        Math.floor(new Date().getTime() / 1000),
        'EX',
        30 * 60,
        function (err, value) {
          if (err) console.error(err);
          // console.log(value, msg.driver_id)
        },
      );
      if (msg.client_id !== 0) {
        this.redisPubClient.get(
          `sidclient${msg.client_id}`,
          this.emitToDriverLocation.bind(this, msg),
        );
      }
    }
  }

  async emitToDriverLocation(msg, err, value) {
    if (err) {
      console.error('error');
    } else {
      // const emit_action_id = uuidv4();

      // const emitData: EmitData = {
      //   data: { ...msg, emit_action_id },
      //   room: value,
      //   socket: `driver_location`,
      // };

      // const emitDataForRedis: EmitDataForRedis = {
      //   emit_data: emitData,
      //   timer: null,
      //   attempts: 0,
      //   isReceived: false,
      // };

      // await this.redisAsyncClient.set(
      //   `${emitData.data.emit_action_id}`,
      //   JSON.stringify(emitDataForRedis),
      // );
      
      // this.autoEmitter.emitTillReceived(emitData, this);
      this.server.to(value).emit(`driver_location`, msg);
    }
  }

  handleDisconnect(socket: Socket) {
    console.log('user disconnected');
  }

  @SubscribeMessage('received')
  async handleReceived(socket: Socket, msg: any) {
    console.log("received", msg);
    
    const data = await this.redisAsyncClient.get(`${msg}`);
    const parsedData: EmitDataForRedis = JSON.parse(data);

    clearInterval(parsedData.timer);

    await this.redisAsyncClient.del(`${msg}`);
  }
}
