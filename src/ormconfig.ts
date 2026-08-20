import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * Load environment variables from src/.env
 */
dotenv.config({
  path: path.resolve(__dirname, '.env'),
});

const AppDataSource = new DataSource({
  type: 'postgres',

  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),

  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'your_postgres_password',

  database: process.env.DB_NAME || 'ems_db',

  synchronize: false,
  logging: false,

  entities: [path.join(__dirname, 'entities', '*.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  subscribers: [],
});

export default AppDataSource;
