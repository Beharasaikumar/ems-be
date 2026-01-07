import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import AppDataSource from './ormconfig';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), './src/.env') });


import authRouter from './routes/auth';
import employeesRouter from './routes/employee';
import attendanceRouter from './routes/attendance';
import payrollRouter from './routes/payroll';
import billRouter from './routes/bills';
import leaveRouter from './routes/leave';
import dailyLogRouter from './routes/dailylogs';

async function main() {
  const app = express();
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));


  await AppDataSource.initialize();
  console.log('DB initialized');

  if (process.env.RUN_MIGRATIONS_ON_START === 'true') {
    console.log('Running migrations...');
    await AppDataSource.runMigrations();
    console.log('Migrations complete');
  }


  app.use('/api/auth', authRouter(AppDataSource));
  app.use('/api/employees', employeesRouter(AppDataSource));
  app.use('/api/attendance', attendanceRouter(AppDataSource));
  app.use('/api/payroll', payrollRouter(AppDataSource));
  app.use('/api/bills', billRouter(AppDataSource));
  app.use('/api/leaves', leaveRouter(AppDataSource));
  app.use('/api/dailylogs', dailyLogRouter(AppDataSource));

  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server listening at http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error('Startup error', err);
  process.exit(1);
});
