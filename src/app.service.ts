import { Injectable } from '@nestjs/common';
import {DatabaseService} from "./db/database.service";
import {query} from "express";

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService) {
  }

  async getHello(): Promise<string> {
    const q = "SELECT * FROM users";
    let exec = await this.db.executeQuery(q);
    console.log(exec)
    return 'Hello World!';
  }
}
