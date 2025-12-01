// src/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const isSqlite = process.env.DB_TYPE === 'sqlite';

const AppDataSource = new DataSource({
  type: isSqlite ? 'sqlite' : 'postgres',
  ...(isSqlite
    ? { database: process.env.SQLITE_FILE ?? 'lomaa.db' }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASS ?? 'postgres',
        database: process.env.DB_NAME ?? 'lomaa_hr',
      }),
  synchronize: false, // keep false in prod; use migrations
  logging: false,
  entities: [__dirname + '/entities/*.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  subscribers: [],
});

export default AppDataSource;
