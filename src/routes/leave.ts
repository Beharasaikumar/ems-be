import { Router } from 'express';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { LeaveRequest } from '../entities/leave';
import { Attendance } from '../entities/Attendance';
import { Employee } from '../entities/Employee';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';

export default function leaveRouter(dataSource: DataSource) {
    const router = Router();
    const repo = dataSource.getRepository(LeaveRequest);

    router.use(authRequired);


    router.post('/', async (req: AuthRequest, res) => {
        if (req.user?.role !== 'employee') {
            return res.status(403).json({ message: 'Only employees can apply leave' });
        }

        const { type, startDate, endDate, reason } = req.body;

        const leave = repo.create({
            id: uuidv4(),
            employeeId: req.user.employeeId!,
            type,
            startDate,
            endDate,
            reason,
            status: 'Pending'
        });

        await repo.save(leave);
        res.status(201).json(leave);
    });


    router.get('/me', async (req: AuthRequest, res) => {
        const leaves = await repo.find({
            where: { employeeId: req.user!.employeeId! },
            order: { appliedOn: 'DESC' }
        });
        res.json(leaves);
    });


    router.get('/', requireRole('admin'), async (_req, res) => {
        const leaves = await repo.find({ order: { appliedOn: 'DESC' } });
        res.json(leaves);
    });


    router.put('/:id/status', requireRole('admin'), async (req, res) => {
        const { status } = req.body;

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const leave = await repo.findOneBy({ id: req.params.id });
        if (!leave) return res.status(404).json({ message: 'Leave not found' });


        leave.status = status;
        leave.decidedOn = new Date();
        await repo.save(leave);


        if (status === 'Approved') {
            const attRepo = dataSource.getRepository(Attendance);
            const empRepo = dataSource.getRepository(Employee);

            const emp = await empRepo.findOneBy({ id: leave.employeeId });

            if (emp) {

                const days =
                    Math.floor(
                        (new Date(leave.endDate).getTime() -
                            new Date(leave.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    ) + 1;


                // if (leave.type === 'Sick') emp.sickleave -= days;
                // if (leave.type === 'Casual') emp.casualleave -= days;
                // if (leave.type === 'Paid') emp.paidleave -= days;


                // emp.sickleave = Math.max(0, emp.sickleave);
                // emp.casualleave = Math.max(0, emp.casualleave);
                // emp.paidleave = Math.max(0, emp.paidleave);

                await empRepo.save(emp);
            }


            let d = new Date(leave.startDate);
            const end = new Date(leave.endDate);

            while (d <= end) {
                const dateStr = d.toISOString().split('T')[0];

                const rec = await attRepo.findOneBy({
                    employeeId: leave.employeeId,
                    date: dateStr
                } as any);

                if (!rec) {
                    await attRepo.save(
                        attRepo.create({
                            id: uuidv4(),
                            employeeId: leave.employeeId,
                            date: dateStr,
                            status: 'Leave'
                        })
                    );
                } else {
                    rec.status = 'Leave';
                    await attRepo.save(rec);
                }

                d.setDate(d.getDate() + 1);
            }
        }

        res.json(leave);
    });

    return router;
};
