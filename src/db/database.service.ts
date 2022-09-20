import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { SEQUELIZE } from '../constants';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(SEQUELIZE) private client: Sequelize) {}

  async executeQuery(queryText: string, values: any[] = []): Promise<any[]> {
    this.logger.debug(`Executing query: ${queryText} (${values})`);

    return this.client
      .query({ query: queryText, values })
      .then((result: [unknown[], unknown]): any => {
        this.logger.debug(`Executed query, result size ${result[0].length}`);
        return result[0];
      })
      .catch((e) => {
        this.logger.error(e);
        return e;
      });
  }
}
