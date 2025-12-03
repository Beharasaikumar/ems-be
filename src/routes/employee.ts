import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Employee } from '../entities/Employee';
import { MissingDeleteDateColumnError } from 'typeorm/error/MissingDeleteDateColumnError';
import { authRequired, requireRole } from '../middleware/auth';

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
  const { id: _ignoreId, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = payload as any;

  const id = `EMP${String(Math.floor(Math.random() * 900) + 100)}`;

   const e = repo.create({ id, ...rest } as Employee);
  await repo.save(e);

   res.status(201).json(e);
});


  router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const user = (req as any).user;

    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (user.role !== 'admin' && user.id !== id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await repo.update({ id }, req.body);
    const updated = await repo.findOneBy({ id });
    res.json(updated);
  });

  router.delete('/:id', requireRole('admin'), async (req, res) => {
     const id = req.params.id;
    try {
      await repo.softDelete(id);
      return res.json({ ok: true, softDeleted: true });
    } catch (err: any) {
      if (err?.name === 'MissingDeleteDateColumnError' || err instanceof MissingDeleteDateColumnError) {
        await repo.delete({ id } as any);
        return res.json({ ok: true, softDeleted: false, fallback: 'hard-delete' });
      }
       console.error('Delete failed', err);
      return res.status(500).json({ message: 'Delete failed', error: err?.message });
    }

  });
  return router;
}
