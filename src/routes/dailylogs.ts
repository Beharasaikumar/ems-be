import { Router } from 'express';
import { DataSource } from 'typeorm';
import { DailyLog } from '../entities/DailyLog';
import { authRequired, AuthRequest } from '../middleware/auth';

export default function dailyLogRouter(dataSource: DataSource) {
  const repo = dataSource.getRepository(DailyLog);
  const router = Router();


  router.get('/', authRequired, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin')
      return res.status(403).json({ message: 'Admins only' });

    const logs = await repo.find({
      order: { createdAt: 'DESC' }
    });

    res.json(logs);
  });


  router.post('/', authRequired, async (req: AuthRequest, res) => {
    const { title, content, category } = req.body;

    const log = repo.create({
      title,
      content,
      category,
      createdBy: req.user?.id
    });

    await repo.save(log);
    res.json(log);
  });

 
  router.put('/:id/pin', authRequired, async (req: AuthRequest, res) => {
    const { isPinned } = req.body;
    await repo.update(req.params.id, { isPinned });
    res.json(await repo.findOneBy({ id: req.params.id }));
  });

 
  router.delete('/:id', authRequired, async (req: AuthRequest, res) => {
    await repo.delete(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
