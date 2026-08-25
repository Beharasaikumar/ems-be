import { Router } from 'express';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Attendance } from '../entities/Attendance';
import { Employee } from '../entities/Employee';
import { SalaryRevision } from '../entities/SalaryRevision';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';
import { MissingDeleteDateColumnError } from 'typeorm/error/MissingDeleteDateColumnError';
import { AuthRequest, authRequired, requireRole } from '../middleware/auth';


export async function seedAttendanceFromJoinDate(dataSource: DataSource, employeeId: string, joinDateStr?: string) {
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


async function syncEmployeeSnapshotFromRevisions(dataSource: DataSource, employeeId: string) {
  const revisionRepo = dataSource.getRepository(SalaryRevision);
  const repo = dataSource.getRepository(Employee);
  const revisions = await revisionRepo.find({ where: { employeeId }, order: { effectiveDate: 'ASC' } });
  if (revisions.length === 0) return revisions;

  const today = new Date().toISOString().split('T')[0];
  let applicable = revisions[0];
  for (const r of revisions) {
    if (r.effectiveDate <= today) applicable = r;
  }

  await repo.update({ id: employeeId }, {
    monthlyGrossSalary: applicable.monthlyGrossSalary,
    basicSalary: applicable.basicSalary,
    hra: applicable.hra,
    da: applicable.da,
    specialAllowance: applicable.specialAllowance,
  });

  return revisions;
}

export default function employeesRouter(dataSource: DataSource) {
  const router = Router();

  const userRepo = dataSource.getRepository(User);
  const repo = dataSource.getRepository(Employee);
  const revisionRepo = dataSource.getRepository(SalaryRevision);

  router.use(authRequired);

  //   router.use((req, res, next) => {
  //   console.log(`[Employees] ${req.method} ${req.originalUrl} - body:`, req.body || '<no body>');
  //   next();
  // });


  router.get('/me', authRequired, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'employee') {
    return res.status(403).json({ message: 'Not an employee' });
  }

  const emp = await repo.findOneBy({ id: req.user.employeeId! });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });

  res.json(emp);
});


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

    const e = repo.create({
      ...rest,
      appRole: 'employee'
    } as Employee);
    await repo.save(e);
    const existingUser = await userRepo.findOne({
      where: [{ username: e.id }, { email: e.email }]
    });

    if (!existingUser && e.email) {
      const tempPassword = await bcrypt.hash(
        Math.random().toString(36),
        10
      );

      const user = userRepo.create({
        employeeId: e.id,              // 🔑 SAME ID AS EMPLOYEE
        username: e.id,        // login using employee ID
        email: e.email,
        password: tempPassword,
        role: 'employee'
      });

      await userRepo.save(user);
    }
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

    if (updateBody.email) {
  const user = await userRepo.findOneBy({ employeeId: id });

  if (user) {
    user.email = updateBody.email;
    await userRepo.save(user);
  }
}

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

  router.get('/:id/salary-revisions', authRequired, async (req, res) => {
    const id = req.params.id;
    const user = (req as any).user;

    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.role !== 'admin' && user.id !== id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const revisions = await revisionRepo.find({ where: { employeeId: id }, order: { effectiveDate: 'ASC' } });
    res.json(revisions);
  });

  router.post('/:id/salary-revisions', requireRole('admin'), async (req, res) => {
    const id = req.params.id;
    const emp = await repo.findOneBy({ id });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    const { effectiveDate, monthlyGrossSalary, basicSalary, hra, da, specialAllowance, reason } = req.body;
    if (!effectiveDate || monthlyGrossSalary === undefined || basicSalary === undefined) {
      return res.status(400).json({ message: 'effectiveDate, monthlyGrossSalary and basicSalary are required' });
    }

    const existingCount = await revisionRepo.count({ where: { employeeId: id } });
    if (existingCount === 0 && emp.basicSalary) {
      const baselineGross = emp.monthlyGrossSalary || ((emp.basicSalary ?? 0) + (emp.hra ?? 0) + (emp.da ?? 0) + (emp.specialAllowance ?? 0));
      const baseline = revisionRepo.create({
        id: uuidv4(),
        employeeId: id,
        effectiveDate: emp.joinDate || effectiveDate,
        monthlyGrossSalary: baselineGross,
        basicSalary: emp.basicSalary ?? 0,
        hra: emp.hra ?? 0,
        da: emp.da ?? 0,
        specialAllowance: emp.specialAllowance ?? 0,
        reason: 'Joining Compensation',
      });
      await revisionRepo.save(baseline);
    }

    const revision = revisionRepo.create({
      id: uuidv4(),
      employeeId: id,
      effectiveDate,
      monthlyGrossSalary: Number(monthlyGrossSalary),
      basicSalary: Number(basicSalary),
      hra: Number(hra ?? 0),
      da: Number(da ?? 0),
      specialAllowance: Number(specialAllowance ?? 0),
      reason: reason || undefined,
    });
    await revisionRepo.save(revision);

    const revisions = await syncEmployeeSnapshotFromRevisions(dataSource, id);
    const updatedEmployee = await repo.findOneBy({ id });
    res.status(201).json({ revisions, employee: updatedEmployee });
  });

  router.delete('/:id/salary-revisions/:revisionId', requireRole('admin'), async (req, res) => {
    const { id, revisionId } = req.params;
    await revisionRepo.delete({ id: revisionId, employeeId: id });

    const revisions = await syncEmployeeSnapshotFromRevisions(dataSource, id);
    const updatedEmployee = await repo.findOneBy({ id });
    res.json({ revisions, employee: updatedEmployee });
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
