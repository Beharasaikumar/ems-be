import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Employee } from '../entities/Employee';
import { Attendance } from '../entities/Attendance';
import { Payslip } from '../entities/Payslip';
import { SalaryRevision } from '../entities/SalaryRevision';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { authRequired, requireRole } from '../middleware/auth';
import puppeteer from 'puppeteer';

import { buildPayslipHtml, escapeHtml } from '../templates/payslipHtml';

import * as dotenv from 'dotenv';
dotenv.config();

const PF_RATE = 0.24;
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_WAGE_LIMIT = 21000;
const PROFESSIONAL_TAX = 200;

function assetDataUri(filename: string): string | undefined {
  const assetPath = path.join(process.cwd(), 'public', filename);
  if (fs.existsSync(assetPath)) {
    const buf = fs.readFileSync(assetPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  }
  if (process.env.PUBLIC_BASE_URL) {
    return `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/${filename}`;
  }
  return undefined;
}



function isValidEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  email = email.trim();
  const simpleRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!simpleRe.test(email)) return false;

  const disallowedDomains = new Set([
    'example.org',
    'test.com',
    'localhost',
    'invalid'
  ]);

  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();

  if (domain.startsWith('[') && domain.endsWith(']')) return false;

  if (disallowedDomains.has(domain)) return false;

  return true;
}


export default function payrollRouter(dataSource: DataSource) {
  const router = Router();
  const empRepo = dataSource.getRepository(Employee);
  const attRepo = dataSource.getRepository(Attendance);
  const payslipRepo = dataSource.getRepository(Payslip);
  const revisionRepo = dataSource.getRepository(SalaryRevision);

  router.use(authRequired);


  router.post('/pdf-html/:payslipId', requireRole('admin'), async (req, res) => {
    const payslipId = req.params.payslipId;
    const ps = await payslipRepo.findOneBy({ id: payslipId });
    if (!ps) return res.status(404).json({ message: 'Payslip not found' });
    const payload = JSON.parse(ps.data);

    try {
      const emp = await empRepo.findOneBy({ id: payload.employeeId });
      if (emp) {
        payload.employee = {
          id: emp.id, name: emp.name, email: emp.email, phone: emp.phone,
          role: emp.role, department: emp.department,
          bankAccountNumber: emp.bankAccountNumber, pan: emp.pan,
          pfAccountNumber: emp.pfAccountNumber,
          attendancePercentage: payload.attendancePercentage
        };
      }
    } catch (err) {
      console.warn('hydrate emp error', err);
    }

    // logo + watermark
    const logoDataUri = assetDataUri('logo.png');
    const watermarkDataUri = assetDataUri('watermark.png');

    try {
      const html = buildPayslipHtml(payload, logoDataUri, watermarkDataUri);

      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });

      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('screen');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' },
        preferCSSPageSize: true,
        scale: 0.95
      });


      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslipId}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      return res.end(pdfBuffer);
    } catch (err: any) {
      console.error('Puppeteer PDF generation failed', err);
      return res.status(500).json({ message: 'PDF generation failed', error: String(err) });
    }
  });


  router.post('/email-html/:payslipId', requireRole('admin'), async (req, res) => {
    const payslipId = req.params.payslipId;
    const { to, subject, text } = req.body as { to?: string; subject?: string; text?: string };
    if (!to) return res.status(400).json({ message: 'to required' });

    const ps = await payslipRepo.findOneBy({ id: payslipId });
    if (!ps) return res.status(404).json({ message: 'Payslip not found' });
    const payload = JSON.parse(ps.data);

    try {
      const emp = await empRepo.findOneBy({ id: payload.employeeId });
      if (emp) {
        payload.employee = {
          id: emp.id, name: emp.name, email: emp.email, phone: emp.phone,
          role: emp.role, department: emp.department,
          bankAccountNumber: emp.bankAccountNumber, pan: emp.pan,
          pfAccountNumber: emp.pfAccountNumber,
          attendancePercentage: payload.attendancePercentage
        };
      }
    } catch (err) {
      console.warn('hydrate emp error', err);
    }

    const logoDataUri = assetDataUri('logo.png');
    const watermarkDataUri = assetDataUri('watermark.png');

    if (!isValidEmail(to)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    try {
      const html = buildPayslipHtml(payload, logoDataUri, watermarkDataUri);

      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('screen');

      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' },
        preferCSSPageSize: true,
        scale: 0.95
      });
      const pdfBuffer = Buffer.from(pdfUint8);

      await browser.close();

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = Number(process.env.SMTP_PORT ?? 465);
      const smtpUser = process.env.SMTP_USER || 'hr@lomaait.com';
      const smtpPass = process.env.SMTP_PASS || '';

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(503).json({
          ok: false,
          message: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.',
          pdfGenerated: true,
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? smtpUser,
        to,
        subject: subject ?? `Payslip ${payload.month}`,
        text: text ?? `Please find attached your payslip for ${payload.month}`,
        attachments: [{ filename: `payslip-${payslipId}.pdf`, content: pdfBuffer }],
      });

      transporter.close();
      return res.json({ ok: true, message: 'Email sent successfully' });
    } catch (err: any) {
      console.error('Email (HTML/PDF) failed', err);
      return res.status(500).json({ message: 'Email failed', error: String(err) });
    }
  });


  router.post('/generate/:employeeId', requireRole('admin'), async (req, res) => {
    const employeeId = req.params.employeeId;
    const emp = await empRepo.findOneBy({ id: employeeId });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    // const month = (req.body && req.body.month) || (() => {
    //   const d = new Date();
    //   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // })();

    let month: string | undefined;
    if (!req.body) month = undefined;
    else if (typeof req.body === 'string') {
      // client sent a raw string like "2025-10"
      month = req.body;
    } else if (typeof req.body === 'object') {
      month = (req.body as any).month;
    }
    if (!month) {
      const d = new Date();
      month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    month = String(month).trim();

    async function backfillAttendanceForMonth(employeeId: string, monthStr: string, joinDateStr?: string) {
      const parts = (monthStr || '').split('-');
      if (parts.length < 2) return;
      const year = Number(parts[0]);
      const monthIndex = Number(parts[1]) - 1;
      if (!year || isNaN(monthIndex)) return;

      const startOfMonth = new Date(year, monthIndex, 1);
      let endOfMonth = new Date(year, monthIndex + 1, 0); // last day of month

      const today = new Date();
      if (endOfMonth > today) endOfMonth = today; // don't backfill future days

      // if joinDate is provided and is after startOfMonth, adjust start
      if (joinDateStr) {
        const joinDate = new Date(joinDateStr);
        if (!isNaN(joinDate.getTime())) {
          if (joinDate > endOfMonth) return; // join date after this month -> nothing to seed
          if (joinDate > startOfMonth) startOfMonth.setTime(joinDate.getTime());
        }
      }

      const attRepository = attRepo; // use existing repo
      const cur = new Date(startOfMonth);
      while (cur <= endOfMonth) {
        const dStr = cur.toISOString().split('T')[0];
        const existing = await attRepository.findOneBy({ employeeId, date: dStr } as any);
        if (!existing) {
          const rec = attRepository.create({
            id: uuidv4(),
            employeeId,
            date: dStr,
            status: 'Present'
          });
          try {
            await attRepository.save(rec);
          } catch (e) {
            // ignore save errors (race/unique conflicts)
            console.warn('backfill save failed', employeeId, dStr, e);
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    try {
      await backfillAttendanceForMonth(employeeId, month, emp.joinDate);
    } catch (err) {
      console.warn('Backfill attendance failed', err);
    }

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // const monthRecords = await attRepo.find({ where: { employeeId } });
    const filtered = await attRepo
      .createQueryBuilder("attendance")
      .where("attendance.employeeId = :employeeId", { employeeId })
      .andWhere("attendance.date LIKE :month", { month: `${month}%` })
      .getMany();
    let paidDays = 0;
    let absentDays = 0;

    if (filtered.length > 0) {
      for (const r of filtered) {
        if (r.status === 'Present') paidDays += 1;
        else if (r.status === 'Leave') paidDays += 1;
        else if (r.status === 'Half Day') paidDays += 0.5;
        else if (r.status === 'Absent') absentDays += 1;
      }
    } else {
      return res.status(400).json({
        message: `Cannot generate payslip. No attendance found for ${month}.`
      });
    }



    paidDays = Math.min(paidDays, totalDaysInMonth);
    const attendancePercentage = (paidDays / totalDaysInMonth) * 100;

    // Use whichever salary revision was in effect for the target month, not the employee's
    // live (possibly since-incremented) snapshot — a payslip for a past month must reflect
    // the salary that applied back then.
    const monthEndStr = `${yearStr}-${String(monthIndex + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;
    const revisions = await revisionRepo.find({ where: { employeeId }, order: { effectiveDate: 'ASC' } });
    let salarySource: { basicSalary?: number; hra?: number; da?: number; specialAllowance?: number; monthlyGrossSalary?: number } = emp;
    if (revisions.length > 0) {
      let applicable = revisions[0];
      for (const r of revisions) {
        if (r.effectiveDate <= monthEndStr) applicable = r;
      }
      salarySource = applicable;
    }

    const calc = (amount?: number) => Math.round(((amount ?? 0) / totalDaysInMonth) * paidDays);


    const basic = calc(salarySource.basicSalary);
    const hra = calc(salarySource.hra);
    const da = calc(salarySource.da);
    const specialAllowance = calc(salarySource.specialAllowance);
    const gross = basic + hra + da + specialAllowance;
    const monthlyGrossSalary = salarySource.monthlyGrossSalary ?? gross;
    const pf =
      emp.pfEnabled
        ? Math.round(basic * PF_RATE)
        : 0;
    const esi =
      emp.esiEnabled && gross < ESI_WAGE_LIMIT
        ? Math.ceil(gross * ESI_EMPLOYEE_RATE)
        : 0;
    const pt = PROFESSIONAL_TAX;
    const tax = gross > 50000 ? Math.round((gross - 50000) * 0.1) : 0;
    const emergencyAdvance = Number(req.body.emergencyAdvance ?? 0);
    const advanceRecovery = Number(req.body.advanceRecovery ?? 0);
    const totalDeductions = pf + esi + pt + tax + emergencyAdvance + advanceRecovery;
    const netSalary = gross - totalDeductions;

    const payload = {
      id: `PAY-${employeeId}-${Date.now()}`,
      employeeId,
      employeeName: emp.name,
      month,
      year,
      generatedDate: new Date().toISOString(),
      attendancePercentage,
      absentDays,
      monthlyGrossSalary,
      earnings: { basic, hra, da, specialAllowance, gross },
      deductions: { pf, esi, pt, tax, emergencyAdvance, advanceRecovery, totalDeductions },
      netSalary,
      remarks: 'Thank you for your contribution this month.'
    };

    const payslipexisting = await payslipRepo.findOne({
      where: { employeeId, month }
    });

    if (payslipexisting) {
      payslipexisting.data = JSON.stringify(payload);

      payslipexisting.emergencyAdvance = emergencyAdvance;
      payslipexisting.advanceRecovery = advanceRecovery;
      payslipexisting.generatedDate = payload.generatedDate;

      await payslipRepo.save(payslipexisting);

      return res.json(payload);
    }

    const p = payslipRepo.create({
      id: payload.id,
      employeeId: payload.employeeId,
      month: payload.month,
      year: payload.year,
      generatedDate: payload.generatedDate,
      emergencyAdvance,
      advanceRecovery,
      data: JSON.stringify(payload)
    });
    await payslipRepo.save(p);

    return res.json(payload);
  });

  router.get('/employee/:employeeId', requireRole('admin'), async (req, res) => {
    const rows = await payslipRepo.find({ where: { employeeId: req.params.employeeId }, order: { generatedDate: 'DESC' } });
    const parsed = rows.map(r => {
      const payload = JSON.parse(r.data);
      payload.id = r.id;
      payload.generatedDate = r.generatedDate;
      return payload;
    });
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

  router.get('/latest', requireRole('admin'), async (req, res) => {
    const rows = await payslipRepo.find({ order: { generatedDate: 'DESC' } });
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.employeeId)) {
        const payload = JSON.parse(r.data);
        payload.id = r.id;
        payload.generatedDate = r.generatedDate;
        map.set(r.employeeId, payload);
      }
    }
    return res.json(Array.from(map.values()));
  });

  router.get('/me', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const rows = await payslipRepo.find({
      where: { employeeId: user.employeeId },
      order: { generatedDate: 'DESC' }
    });

    const parsed = rows.map(r => {
      const payload = JSON.parse(r.data);
      payload.id = r.id;
      payload.generatedDate = r.generatedDate;
      return payload;
    });

    res.json(parsed);
  });


  return router;
}



