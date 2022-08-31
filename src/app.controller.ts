import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // @Get()
  // async getHello(): Promise<string> {
  //   return this.appService.getHello();
  // }

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

  // @Get('/search-drivers/:id/accept')
  // searchDriversAccept(@Req() request: Request, @Res() response: Response) {
  //   return this.appService.searchDriversAccept(request, response);
  // }

  @Get()
  homePage(@Req() request: Request, @Res() response: Response): void {
    return this.appService.homePage(request, response);
  }


}
