import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Attendance } from '../entities/Attendance';
import { v4 as uuidv4 } from 'uuid';
import { authRequired } from '../middleware/auth';

export default function attendanceRouter(dataSource: DataSource) {
  const router = Router();
  const repo = dataSource.getRepository(Attendance);

  router.use(authRequired);

  router.get('/', async (req, res) => {
    const { month, employeeId } = req.query as { month?: string; employeeId?: string };
    if (employeeId && month) {
      const rows = await repo.find({ where: { employeeId }, order: { date: 'ASC' } });
      return res.json(rows.filter(r => r.date.startsWith(month)));
    }
    if (month) {
      const rows = await repo.find();
      return res.json(rows.filter(r => r.date.startsWith(month)));
    }
    if (employeeId) {
      const rows = await repo.find({ where: { employeeId }, order: { date: 'ASC' } });
      return res.json(rows);
    }
    const rows = await repo.find({ order: { employeeId: 'ASC', date: 'ASC' } });
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const { employeeId, date, status } = req.body as { employeeId?: string; date?: string; status?: string };
    if (!employeeId || !date || !status) return res.status(400).json({ message: 'employeeId, date, status required' });

    let record = await repo.findOneBy({ employeeId, date } as any);
    if (!record) {
      record = repo.create({ id: uuidv4(), employeeId, date, status });
    } else {
      record.status = status;
    }
    await repo.save(record);
    res.json(record);
  });

  return router;
}
