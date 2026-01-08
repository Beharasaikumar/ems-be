import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Bill } from '../entities/Bill';
import { AuthRequest, authRequired } from '../middleware/auth';

export default function billRouter(dataSource: DataSource) {
  const router = Router();
  const repo = dataSource.getRepository(Bill);


  router.post('/', authRequired, async (req: AuthRequest, res) => {
    const { title, amount, category, billDate, fileName, fileData } = req.body;

    const bill = repo.create({
      title,
      amount,
      category,
      billDate,
      status: 'Pending',
      fileName,
      fileData,
      uploadedBy: req.user?.id,
    });

    await repo.save(bill);
    res.json(bill);
  });

   router.get('/', authRequired, async (req: AuthRequest, res) => {
    let bills;

    if (req.user?.role === 'admin') {
      bills = await repo.find({ order: { createdAt: 'DESC' } });
    } else {
      bills = await repo.find({
        where: { uploadedBy: req.user?.id },
        order: { createdAt: 'DESC' }
      });
    }

    res.json(bills);
  });

   router.put('/:id/status', authRequired, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admins only' });
    }

    const { status } = req.body;

    await repo.update(req.params.id, { status });
    const updated = await repo.findOneBy({ id: req.params.id });

    res.json(updated);
  });

   router.delete('/:id', authRequired, async (req: AuthRequest, res) => {
    await repo.delete(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
