import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
  ) {}

  @MessagePattern()
  async check(@Payload() data: any, @Ctx() context: RmqContext): Promise<void> {
    console.log("Payload", data)
    await this.appService.check(data, context);
  }

  @Get('/search-drivers/:id')
  async searchDrivers(@Req() request: Request, @Res() response: Response) {
    return await this.appService.searchDrivers(request, response);
  }

  @Get('/search-drivers/:id/skip')
  async searchDriversSkip(@Req() request: Request, @Res() response: Response) {
    return await this.appService.searchDriversSkip(request, response);
  }

  @Get('/search-drivers/:id/cancel')
  async searchDriversCancel(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return await this.appService.searchDriversCancel(request, response);
  }

  @Get('/search-drivers/:id/accept')
  async searchDriversAccept(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return await this.appService.searchDriversAccept(request, response);
  }

  @Get()
  homePage(@Req() request: Request, @Res() response: Response): void {
    return this.appService.homePage(request, response);
  }
}
