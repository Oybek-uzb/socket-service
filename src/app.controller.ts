import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { RmqService } from './rmq/rmq.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly rmqService: RmqService,
  ) {}

  @EventPattern('socket-service')
  async check(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.appService.check(data, context);
  }

  @Get('/search-drivers/:id')
  async searchDrivers(@Req() request: Request, @Res() response: Response) {
    return this.appService.searchDrivers(request, response);
  }

  @Get('/search-drivers/:id/skip')
  searchDriversSkip(@Req() request: Request, @Res() response: Response) {
    return this.appService.searchDriversSkip(request, response);
  }

  @Get('/search-drivers/:id/cancel')
  searchDriversCancel(@Req() request: Request, @Res() response: Response) {
    return this.appService.searchDriversCancel(request, response);
  }

  @Get('/search-drivers/:id/accept')
  searchDriversAccept(@Req() request: Request, @Res() response: Response) {
    return this.appService.searchDriversAccept(request, response);
  }

  @Get()
  homePage(@Req() request: Request, @Res() response: Response): void {
    return this.appService.homePage(request, response);
  }
}
