import {Controller, Get, Req, Res} from '@nestjs/common';
import { AppService } from './app.service';
import {Request, Response} from 'express'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<string> {
    return this.appService.getHello();
  }

  @Get('/search-drivers/:id/skip')
  searchDrivers(@Req() request: Request, @Res() response: Response) {
    return this.appService.searchDrivers(request, response)
  }
}
