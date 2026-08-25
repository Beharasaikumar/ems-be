import 'reflect-metadata';
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { DataSource } from 'typeorm';
import AppDataSource from './ormconfig';

import authRouter from './routes/auth';
import employeesRouter, { seedAttendanceFromJoinDate } from './routes/employee';
import attendanceRouter from './routes/attendance';
import payrollRouter from './routes/payroll';
import billRouter from './routes/bills';
import leaveRouter from './routes/leave';
import dailyLogRouter from './routes/dailylogs';
import { Employee } from './entities/Employee';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Backfills today's (and any missed) attendance for every employee, independent of any
 * admin request — otherwise attendance only gets seeded as a side-effect of an admin
 * editing an employee or generating payroll, so days with no admin activity never get
 * marked. Runs once at startup and then every 24h for as long as the server is up.
 */
async function runDailyAttendanceAutoSeed(dataSource: DataSource) {
  try {
    const employees = await dataSource.getRepository(Employee).find();
    for (const emp of employees) {
      await seedAttendanceFromJoinDate(dataSource, emp.id, emp.joinDate);
    }
    console.log(`Daily attendance auto-seed completed for ${employees.length} employee(s)`);
  } catch (err) {
    console.error('Daily attendance auto-seed failed', err);
  }
}

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

  runDailyAttendanceAutoSeed(AppDataSource);
  setInterval(() => runDailyAttendanceAutoSeed(AppDataSource), ONE_DAY_MS);

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
