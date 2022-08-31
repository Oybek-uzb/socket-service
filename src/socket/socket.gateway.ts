import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as jwtDecode from "jwt-decode"
import {DefaultEventsMap} from "socket.io/dist/typed-events";

@Injectable()
@WebSocketGateway(3001, { cors: true })
export class ServerGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject('REDIS_PUB_CLIENT') private readonly redisPubClient: Redis,
    @Inject('REDIS_SUB_CLIENT') private readonly redisSubClient: Redis,
  ) {}

  afterInit(server: Server) {
    server.adapter(createAdapter(this.redisPubClient, this.redisSubClient));
    server.use(async (socket, next) => {
      const header = socket.handshake.headers['authorization'];
      let is_valid = await this.isValidJwt(header, socket)
      if (is_valid) {
        next();
      } else {
        next(new Error('unauthorized'));
      }
    })
  }

  async isValidJwt(header, socket) {
    const token = header.split(' ')[1];
    let decoded = jwtDecode.default<any>(token);
    // console.log(decodeid.user_type, decoded.user_id)
    process.env.TZ = "Asia/Tashkent";
    if (Math.floor(new Date().getTime() / 1000) > decoded.exp || Math.floor(new Date().getTime() / 1000) < decoded.iat || decoded.user_id == undefined || decoded.user_type == undefined) {
      return false;
    }
    await this.redisPubClient.set(`sid${decoded.user_type}${decoded.user_id}`, socket.id, 'EX', 30 * 60);
    return true;
  }
}
