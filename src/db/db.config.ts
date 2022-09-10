import * as dotenv from 'dotenv';
import { IDatabaseConfig } from './db.config-interface';

dotenv.config();

export const databaseConfig: IDatabaseConfig = {
  development: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: process.env.POSTGRES_DIALECT,
    schema: process.env.POSTGRES_PUBLIC_SCHEMA,
  },
  test: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: process.env.POSTGRES_DIALECT,
    schema: process.env.POSTGRES_PUBLIC_SCHEMA,
  },
  production: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: process.env.POSTGRES_DIALECT,
    schema: process.env.POSTGRES_PUBLIC_SCHEMA,
  },
};
