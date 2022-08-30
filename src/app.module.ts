import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {ConfigModule} from "@nestjs/config";
import {DatabaseModule} from "./db/database.module";
import {RmqModule} from "./rmq/rmq.module";
import {ServerGateway} from "./socket/socket.gateway";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
      DatabaseModule,
      RmqModule,
  ],
  controllers: [AppController],
  providers: [AppService, ServerGateway],
})
export class AppModule {}
