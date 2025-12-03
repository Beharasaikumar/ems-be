import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import AppDataSource from './ormconfig'; 
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), './.env') });


import authRouter from './routes/auth';
import employeesRouter from './routes/employee';
import attendanceRouter from './routes/attendance';
import payrollRouter from './routes/payroll';

async function main() {
  const app = express();
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
  app.use(express.json());

  // initialize the exported DataSource instance
  await AppDataSource.initialize();
  console.log('DB initialized');

  // optionally run pending migrations in non-production (optional)
  if (process.env.RUN_MIGRATIONS_ON_START === 'true') {
    console.log('Running migrations...');
    await AppDataSource.runMigrations();
    console.log('Migrations complete');
  }

  
  // pass the DataSource instance into routers that expect it
  app.use('/api/auth', authRouter(AppDataSource));
  app.use('/api/employees', employeesRouter(AppDataSource));
  app.use('/api/attendance', attendanceRouter(AppDataSource));
  app.use('/api/payroll', payrollRouter(AppDataSource));

  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(PORT, () => console.log(`Server listening at http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error('Startup error', err);
  process.exit(1);
});
