import { Router } from 'express';
import { DataSource } from 'typeorm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Employee } from '../entities/Employee';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? 'replace-with-secure-secret';
const JWT_EXPIRES_IN = '8h';

export default function authRouter(dataSource: DataSource) {
  const router = Router();
  const repo = dataSource.getRepository(Employee);

   (async () => {
    const admin = await repo.findOneBy({ id: 'EMPADMIN' });
    if (!admin) {
      await repo.save({
        id: 'EMPADMIN',
        name: 'Admin User',
        email: 'admin@example.com',
        appRole: 'admin',
        basicSalary: 0
      } as any);
      console.log('Admin user inserted: EMPADMIN');
    }
  })();

   router.post('/login', async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
      if (username === 'admin' && (password === process.env.ADMIN_PASSWORD || password === 'admin')) {
      const token = jwt.sign({ id: 'EMPADMIN', username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.json({ ok: true, token, user: { id: 'EMPADMIN', username: 'admin', role: 'admin' } });
    }

     const emp = await repo.findOneBy({ id: username ?? '' });
    if (emp) {
       const token = jwt.sign({ id: emp.id, username: emp.name, role: emp.appRole }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.json({ ok: true, token, user: { id: emp.id, username: emp.name, role: emp.appRole } });
    }

    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  });

  return router;
}
