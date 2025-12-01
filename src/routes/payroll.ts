import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Employee } from '../entities/Employee';
import { Attendance } from '../entities/Attendance';
import { Payslip } from '../entities/Payslip';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { authRequired, requireRole } from '../middleware/auth';

const PF_RATE = 0.12;
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_WAGE_LIMIT = 21000;
const PROFESSIONAL_TAX = 200;

export default function payrollRouter(dataSource: DataSource) {
  const router = Router();
  const empRepo = dataSource.getRepository(Employee);
  const attRepo = dataSource.getRepository(Attendance);
  const payslipRepo = dataSource.getRepository(Payslip);

  router.use(authRequired);

  router.post('/generate/:employeeId', requireRole('admin'), async (req, res) => {
    const employeeId = req.params.employeeId;
    const emp = await empRepo.findOneBy({ id: employeeId });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    const month = (req.body && req.body.month) || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const monthRecords = await attRepo.find({ where: { employeeId } });
    const filtered = monthRecords.filter(r => r.date.startsWith(month));
    let paidDays = 0;
    if (filtered.length > 0) {
      for (const r of filtered) {
        if (r.status === 'Present') paidDays += 1;
        else if (r.status === 'Leave') paidDays += 1;
        else if (r.status === 'Half Day') paidDays += 0.5;
      }
    } else {
      paidDays = totalDaysInMonth;
    }

    paidDays = Math.min(paidDays, totalDaysInMonth);
    const attendancePercentage = (paidDays / totalDaysInMonth) * 100;

    const calc = (amount?: number) => Math.round(((amount ?? 0) / totalDaysInMonth) * paidDays);

    const basic = calc(emp.basicSalary);
    const hra = calc(emp.hra);
    const da = calc(emp.da);
    const specialAllowance = calc(emp.specialAllowance);
    const gross = basic + hra + da + specialAllowance;
    const pf = Math.round(basic * PF_RATE);
    const esi = gross < ESI_WAGE_LIMIT ? Math.ceil(gross * ESI_EMPLOYEE_RATE) : 0;
    const pt = PROFESSIONAL_TAX;
    const tax = gross > 50000 ? Math.round((gross - 50000) * 0.1) : 0;
    const totalDeductions = pf + esi + pt + tax;
    const netSalary = gross - totalDeductions;

    const payload = {
      id: `PAY-${employeeId}-${Date.now()}`,
      employeeId,
      employeeName: emp.name,
      month,
      year,
      generatedDate: new Date().toLocaleDateString(),
      attendancePercentage,
      earnings: { basic, hra, da, specialAllowance, gross },
      deductions: { pf, esi, pt, tax, totalDeductions },
      netSalary,
      remarks: `Auto-generated (${month})`
    };

    const p = payslipRepo.create({
      id: payload.id,
      employeeId: payload.employeeId,
      month: payload.month,
      year: payload.year,
      generatedDate: payload.generatedDate,
      data: JSON.stringify(payload)
    });
    await payslipRepo.save(p);

    return res.json(payload);
  });

  router.get('/employee/:employeeId', requireRole('admin'), async (req, res) => {
    const rows = await payslipRepo.find({ where: { employeeId: req.params.employeeId }, order: { generatedDate: 'DESC' } });
    const parsed = rows.map(r => ({ id: r.id, employeeId: r.employeeId, month: r.month, year: r.year, generatedDate: r.generatedDate, data: JSON.parse(r.data) }));
    return res.json(parsed);
  });

  router.get('/view/:payslipId', async (req, res) => {
    const payslipId = req.params.payslipId;
    const ps = await payslipRepo.findOneBy({ id: payslipId });
    if (!ps) return res.status(404).json({ message: 'Payslip not found' });

    const payload = JSON.parse(ps.data);

    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.role !== 'admin' && user.employeeId !== payload.employeeId && user.id !== payload.employeeId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const emp = await empRepo.findOneBy({ id: payload.employeeId });
    if (emp) {
      payload.employee = {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        department: emp.department,
        bankAccountNumber: emp.bankAccountNumber,
        pan: emp.pan,
        pfAccountNumber: emp.pfAccountNumber,
      };
    }

    return res.json(payload);
  });

  router.post('/pdf/:payslipId', requireRole('admin'), async (req, res) => {
    const payslipId = req.params.payslipId;
    const ps = await payslipRepo.findOneBy({ id: payslipId });
    if (!ps) return res.status(404).json({ message: 'Payslip not found' });
    const payload = JSON.parse(ps.data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslipId}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(20).text('Lomaa IT Solutions', { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(12).text(`Payslip for ${payload.month}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(11).text(`Employee: ${payload.employeeName || payload.employeeId}`);
    if (payload.employee && payload.employee.department) doc.text(`Department: ${payload.employee.department}`);
    doc.text(`Employee ID: ${payload.employeeId}`);
    doc.text(`Generated: ${payload.generatedDate}`);
    doc.moveDown();

    doc.fontSize(12).text('Earnings', { underline: true });
    doc.fontSize(10).list([
      `Basic: ₹${payload.earnings.basic}`,
      `HRA: ₹${payload.earnings.hra}`,
      `DA: ₹${payload.earnings.da}`,
      `Special Allowance: ₹${payload.earnings.specialAllowance}`,
      `Gross: ₹${payload.earnings.gross}`
    ]);
    doc.moveDown();

    doc.fontSize(12).text('Deductions', { underline: true });
    doc.fontSize(10).list([
      `PF: ₹${payload.deductions.pf}`,
      `ESI: ₹${payload.deductions.esi}`,
      `PT: ₹${payload.deductions.pt}`,
      `TDS: ₹${payload.deductions.tax}`,
      `Total Deductions: ₹${payload.deductions.totalDeductions}`
    ]);
    doc.moveDown();

    doc.fontSize(14).text(`Net Salary: ₹${payload.netSalary}`, { underline: true });
    if (payload.remarks) {
      doc.moveDown();
      doc.fontSize(10).text(`Remarks: ${payload.remarks}`);
    }

    doc.end();
  });

  router.post('/email/:payslipId', requireRole('admin'), async (req, res) => {
    const payslipId = req.params.payslipId;
    const { to, subject, text } = req.body as { to?: string; subject?: string; text?: string };
    if (!to) return res.status(400).json({ message: 'to required' });

    console.log(`Sending payslip ${payslipId} to ${to}`);

    const ps = await payslipRepo.findOneBy({ id: payslipId });
    if (!ps) return res.status(404).json({ message: 'Payslip not found' });
    const payload = JSON.parse(ps.data);
    console.log('Payslip payload', payload);

    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', async () => {
      const pdfBuf = Buffer.concat(chunks);

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.hostinger.com',
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER ?? 'hr@lomaait.com',
          pass: process.env.SMTP_PASS ?? 'Srinivasad@777'
        }
      });

      console.log(`Sending email to ${to}...: ${transporter}`);

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM ?? 'hr@lomaait.com',
          to,
          subject: subject ?? `Payslip ${payload.month}`,
          text: text ?? `Please find attached your payslip for ${payload.month}`,
          attachments: [{ filename: `payslip-${payslipId}.pdf`, content: pdfBuf }]
        });
      console.log('Email sent successfully');
        res.json({ ok: true });
      } catch (err: any) {
        console.error('Mail send failed', err);
        console.log('Email sent failed', err);
        res.status(500).json({ message: 'Failed to send email', error: err?.message });
      }
    });

    doc.fontSize(18).text('Payslip', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Employee: ${payload.employeeName || payload.employeeId}`);
    doc.text(`Month: ${payload.month}`);
    doc.text(`Generated: ${payload.generatedDate}`);
    doc.moveDown();
    doc.text(`Net Salary: ₹${payload.netSalary}`);
    if (payload.remarks) {
      doc.moveDown();
      doc.text(`Remarks: ${payload.remarks}`);
    }
    doc.end();
  });

  return router;
}
