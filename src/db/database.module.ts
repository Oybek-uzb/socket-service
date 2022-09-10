import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ModuleRef } from '@nestjs/core';
import { databaseProviders } from './db.providers';
import { SEQUELIZE } from '../constants';
import { Sequelize } from 'sequelize';

@Module({
  providers: [...databaseProviders, DatabaseService],
  exports: [...databaseProviders, DatabaseService],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  onApplicationShutdown(signal?: string): any {
    this.logger.log(`Shutting down on signal ${signal}`);
    const sequelize = this.moduleRef.get(SEQUELIZE) as Sequelize;
    return sequelize.close();
  }
}
