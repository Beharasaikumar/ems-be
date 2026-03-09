import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * Load environment variables from root .env
 */
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

const AppDataSource = new DataSource({
  type: 'postgres',

  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),

  username: process.env.DB_USER || 'postgres',
  password: 'LomaaITSolutions@1234',

  database: process.env.DB_NAME || 'ems_db',

  synchronize: false,
  logging: false,

  entities: [path.join(__dirname, 'entities', '*.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  subscribers: [],
});

export default AppDataSource;
