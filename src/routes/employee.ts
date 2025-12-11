import { Router } from 'express';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Attendance } from '../entities/Attendance';
import { Employee } from '../entities/Employee';
import { MissingDeleteDateColumnError } from 'typeorm/error/MissingDeleteDateColumnError';
import { authRequired, requireRole } from '../middleware/auth';


async function seedAttendanceFromJoinDate(dataSource: DataSource, employeeId: string, joinDateStr?: string) {
  if (!joinDateStr) return;
  const start = new Date(joinDateStr);
  if (isNaN(start.getTime())) return;
  const today = new Date();
  if (start > today) return;

  const attRepo = dataSource.getRepository(Attendance);

  const current = new Date(start);
  while (current <= today) {
    const dStr = current.toISOString().split('T')[0];
    const existing = await attRepo.findOneBy({ employeeId, date: dStr } as any);
    if (!existing) {
      const rec = attRepo.create({
        id: uuidv4(),
        employeeId,
        date: dStr,
        status: 'Present'
      });
      try {
        await attRepo.save(rec);
      } catch (e) {
        console.warn('seedAttendance save failed for', employeeId, dStr, e);
      }
    }
    current.setDate(current.getDate() + 1);
  }
}


export default function employeesRouter(dataSource: DataSource) {
  const router = Router();
  const repo = dataSource.getRepository(Employee);

  router.use(authRequired);

  //   router.use((req, res, next) => {
  //   console.log(`[Employees] ${req.method} ${req.originalUrl} - body:`, req.body || '<no body>');
  //   next();
  // });


  router.get('/', requireRole('admin'), async (req, res) => {
    const list = await repo.find({ order: { name: 'ASC' } });
    res.json(list);
  });

  router.get('/:id', requireRole('admin'), async (req, res) => {
    const row = await repo.findOneBy({ id: req.params.id });
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  });

  router.post('/', requireRole('admin'), async (req, res) => {
    const payload = req.body as Partial<Employee>;
    const { createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = payload as any;

    if (!rest.id) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    const existing = await repo.findOneBy({ id: rest.id });

    if (existing) {
      return res.status(409).json({ message: 'Employee ID already exists' });
    }

    if (rest.monthlyGrossSalary !== undefined && rest.monthlyGrossSalary !== null) {
      rest.monthlyGrossSalary = Number(rest.monthlyGrossSalary);
    }

    if (rest.basicSalary !== undefined) rest.basicSalary = Number(rest.basicSalary);
    if (rest.hra !== undefined) rest.hra = Number(rest.hra);
    if (rest.da !== undefined) rest.da = Number(rest.da);
    if (rest.specialAllowance !== undefined) rest.specialAllowance = Number(rest.specialAllowance);

    const e = repo.create(rest as Employee);
    await repo.save(e);

    try {
      await seedAttendanceFromJoinDate(dataSource, e.id, e.joinDate);
    } catch (err) {
      console.warn('Attendance seeding failed', err);
    }

    res.status(201).json(e);
  });


  router.put('/:id', authRequired, async (req, res) => {
    const id = req.params.id;
    const user = (req as any).user;

    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (user.role !== 'admin' && user.id !== id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updateBody = { ...req.body } as any;

    if (updateBody.monthlyGrossSalary !== undefined) updateBody.monthlyGrossSalary = Number(updateBody.monthlyGrossSalary);
    if (updateBody.basicSalary !== undefined) updateBody.basicSalary = Number(updateBody.basicSalary);
    if (updateBody.hra !== undefined) updateBody.hra = Number(updateBody.hra);
    if (updateBody.da !== undefined) updateBody.da = Number(updateBody.da);
    if (updateBody.specialAllowance !== undefined) updateBody.specialAllowance = Number(updateBody.specialAllowance);

    await repo.update({ id }, updateBody);
    const updated = await repo.findOneBy({ id });
    if (updated) {
  try {
    const newJoin = (updateBody.joinDate ?? updated.joinDate) as string | undefined;
    await seedAttendanceFromJoinDate(dataSource, id, newJoin);
  } catch (err) {
    console.warn('Attendance seeding on update failed', err);
  }
}
    res.json(updated);
  });

  router.delete('/:id', requireRole('admin'), async (req, res) => {
    const id = req.params.id;
    try {
      await repo.softDelete(id);
       await dataSource.getRepository(Attendance).delete({ employeeId: id });
      return res.json({ ok: true, softDeleted: true, attendanceDeleted: true });
    } catch (err: any) {
      if (err?.name === 'MissingDeleteDateColumnError' || err instanceof MissingDeleteDateColumnError) {
        await repo.delete({ id } as any);
         await dataSource.getRepository(Attendance).delete({ employeeId: id });
        return res.json({ ok: true, softDeleted: false, fallback: 'hard-delete', attendanceDeleted: true });
      }
      console.error('Delete failed', err);
      return res.status(500).json({ message: 'Delete failed', error: err?.message });
    }

  });
  return router;
}
