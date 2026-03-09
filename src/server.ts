import 'reflect-metadata';
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import AppDataSource from './ormconfig';

import authRouter from './routes/auth';
import employeesRouter from './routes/employee';
import attendanceRouter from './routes/attendance';
import payrollRouter from './routes/payroll';
import billRouter from './routes/bills';
import leaveRouter from './routes/leave';
import dailyLogRouter from './routes/dailylogs';

async function main() {
  const app = express();

  /* -------------------- CORS -------------------- */
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  /* -------------------- BODY PARSER -------------------- */
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  /* -------------------- DATABASE -------------------- */
  await AppDataSource.initialize();
  console.log('DB initialized');

  if (process.env.RUN_MIGRATIONS_ON_START === 'true') {
    console.log('Running migrations...');
    await AppDataSource.runMigrations();
    console.log('Migrations complete');
  }

  /* -------------------- ROUTES -------------------- */
  app.use('/api/auth', authRouter(AppDataSource));
  app.use('/api/employees', employeesRouter(AppDataSource));
  app.use('/api/attendance', attendanceRouter(AppDataSource));
  app.use('/api/payroll', payrollRouter(AppDataSource));
  app.use('/api/bills', billRouter(AppDataSource));
  app.use('/api/leaves', leaveRouter(AppDataSource));
  app.use('/api/dailylogs', dailyLogRouter(AppDataSource));

  /* -------------------- SERVER -------------------- */
  const PORT = Number(process.env.PORT) || 4000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

/* -------------------- START APP -------------------- */
main().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
