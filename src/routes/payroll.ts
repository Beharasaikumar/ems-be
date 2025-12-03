import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Employee } from '../entities/Employee';
import { Attendance } from '../entities/Attendance';
import { Payslip } from '../entities/Payslip';
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

const PF_RATE = 0.12;
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_WAGE_LIMIT = 21000;
const PROFESSIONAL_TAX = 200;



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

    // logo
    let logoDataUri;
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      logoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
    } else if (process.env.PUBLIC_BASE_URL) {
      logoDataUri = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/logo.png`;
    }

    try {
      const html = buildPayslipHtml(payload, logoDataUri);

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
        margin: { top: '20mm', bottom: '20mm', left: '12mm', right: '12mm' },
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

     let logoDataUri;
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      logoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
    } else if (process.env.PUBLIC_BASE_URL) {
      logoDataUri = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/logo.png`;
    }

    if (!isValidEmail(to)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    try {
      const html = buildPayslipHtml(payload, logoDataUri);

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
        margin: { top: '20mm', bottom: '20mm', left: '12mm', right: '12mm' },
      });

      await browser.close();

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = Number(process.env.SMTP_PORT ?? 465);
      const smtpUser = process.env.SMTP_USER || 'beharasaikumar1@gmail.com';
      const smtpPass = process.env.SMTP_PASS || 'ailsfwlwfxihzbwz';

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

  //  router.post('/pdf/:payslipId', requireRole('admin'), async (req, res) => {
  //   const payslipId = req.params.payslipId;
  //   const ps = await payslipRepo.findOneBy({ id: payslipId });
  //   if (!ps) return res.status(404).json({ message: 'Payslip not found' });
  //   const payload = JSON.parse(ps.data);

  //   // Helpers
  //   const fmt = (n: any) => {
  //     const v = Number(n ?? 0);
  //     return `₹${v.toLocaleString('en-IN')}`;
  //   };

  //   res.setHeader('Content-Type', 'application/pdf');
  //   res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslipId}.pdf`);

  //   const doc = new PDFDocument({ margin: 40, size: 'A4' });
  //   doc.pipe(res);

  //   const pageWidth = doc.page.width;
  //   const pageHeight = doc.page.height;
  //   const margin = 40;
  //   const contentWidth = pageWidth - margin * 2;
  //   let x = margin;
  //   let y = margin;

  //    try {
  //     const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  //     if (fs.existsSync(logoPath)) {
  //       const logoSize = 64;
  //       doc.image(logoPath, x, y, { width: logoSize, height: logoSize, align: 'right' });
  //     } else {
  //        doc.save();
  //       doc.lineWidth(2).circle(x + 32, y + 32, 32).stroke('#2dd4bf');
  //       doc.restore();
  //        doc.fontSize(20).fillColor('#0f172a').text('L', x + 16, y + 14, { width: 32, align: 'center' });
  //     }
  //   } catch (err) {
  //     // ignore logo errors
  //   }

  //    const headerX = x + 80;
  //   doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('Lomaa', headerX, y);
  //   doc.fontSize(10).fillColor('#334155').font('Helvetica').text('IT SOLUTIONS', headerX, y + 26);
  //   doc.moveTo(margin, y + 72).lineTo(pageWidth - margin, y + 72).lineWidth(0.5).strokeColor('#e6e9ee').stroke();

  //   y += 86;

  //    const monthLabel = (payload.month && payload.year)
  //     ? `${payload.month} ${payload.year}`
  //     : (payload.month || '');
  //   doc.fontSize(12).fillColor('#059669').font('Helvetica-Bold').text(`Payslip — ${monthLabel}`, { align: 'center' });
  //   y = doc.y + 10;

  //    const colGap = 12;
  //   const colW = (contentWidth - colGap) / 2;
  //   const leftX = margin;
  //   const rightX = margin + colW + colGap;
  //   const emp = payload.employee || {};

  //    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Employee Name', leftX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(payload.employeeName ?? payload.employeeId ?? 'N/A', leftX, doc.y + 2);

  //   doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Employee ID', rightX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(payload.employeeId ?? 'N/A', rightX, doc.y - 14);

  //   y = Math.max(doc.y, y) + 8;

  //    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Department', leftX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(emp.department ?? (payload.employee?.department) ?? 'N/A', leftX, doc.y + 2);

  //   doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Designation', rightX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(emp.role ?? (payload.employee?.role) ?? 'N/A', rightX, doc.y - 14);

  //   y = Math.max(doc.y, y) + 8;

  //    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Bank Account', leftX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(emp.bankAccountNumber ?? payload.employee?.bankAccountNumber ?? 'N/A', leftX, doc.y + 2);

  //   doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('PAN Number', rightX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text((emp.pan ?? payload.employee?.pan ?? 'N/A').toString().toUpperCase(), rightX, doc.y - 14);

  //   y = Math.max(doc.y, y) + 8;

  //    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('PF No', leftX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(emp.pfAccountNumber ?? payload.employee?.pfAccountNumber ?? 'N/A', leftX, doc.y + 2);

  //   const attendancePct = (emp.attendancePercentage ?? payload.attendancePercentage ?? 0);
  //   const daysPresent = Math.round((attendancePct / 100) * 30);

  //   doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Days Present', rightX, y);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(`${daysPresent} days`, rightX, doc.y - 14);

  //   y = Math.max(doc.y, y) + 16;

  //   // Generated date
  //   if (payload.generatedDate) {
  //     doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`Generated: ${payload.generatedDate}`, leftX, y);
  //   }
  //   y = doc.y + 12;

  //   // Earnings & Deductions
  //   const boxX = margin;
  //   const boxY = y;
  //   const boxW = contentWidth;
  //   const midX = boxX + boxW / 2;

  //   // Column headers
  //   doc.fontSize(11).fillColor('#334155').font('Helvetica-Bold').text('Earnings', boxX + 10, boxY);
  //   doc.fontSize(11).fillColor('#334155').font('Helvetica-Bold').text('Deductions', midX + 10, boxY);

  //   let curY = boxY + 22;
  //   const rowGap = 14;
  //   const earnings = payload.earnings || {};
  //   const deductions = payload.deductions || {};

  //   const leftItems = [
  //     { label: 'Basic Salary', value: earnings.basic },
  //     { label: 'HRA', value: earnings.hra },
  //     { label: 'DA', value: earnings.da },
  //     { label: 'Special Allow.', value: earnings.specialAllowance }
  //   ];

  //   const rightItems = [
  //     { label: 'PF (12%)', value: deductions.pf },
  //     { label: 'ESI (0.75%)', value: deductions.esi },
  //     { label: 'Prof. Tax', value: deductions.pt },
  //     { label: 'TDS', value: deductions.tax }
  //   ];

  //   const leftColWidth = (boxW / 2);
  //   const rightColWidth = (boxW / 2);

  //   for (let i = 0; i < Math.max(leftItems.length, rightItems.length); i++) {
  //     const left = leftItems[i];
  //     const right = rightItems[i];

  //     if (left) {
  //       doc.fontSize(10).fillColor('#0f172a').font('Helvetica').text(left.label, boxX + 10, curY);
  //       doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold')
  //         .text(fmt(left.value), boxX + leftColWidth - 10, curY, { align: 'center', width: leftColWidth - 20 });
  //     }

  //     if (right) {
  //       doc.fontSize(10).fillColor('#0f172a').font('Helvetica').text(right.label, midX + 10, curY);
  //       doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold')
  //         .text(fmt(right.value), midX + rightColWidth - 10, curY, { align: 'right', width: rightColWidth - 20 });
  //     }

  //     curY += rowGap;
  //   }

  //   // Separator line above totals
  //   doc.moveTo(boxX, curY + 6).lineTo(boxX + boxW, curY + 6).lineWidth(0.5).strokeColor('#e6e9ee').stroke();

  //   // Totals row
  //   curY += 16;
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('Gross Earnings', boxX + 10, curY);
  //   doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(fmt(earnings.gross), boxX + leftColWidth - 10, curY, { align: 'right', width: leftColWidth - 20 });

  //   doc.fontSize(11).fillColor('#dc2626').font('Helvetica-Bold').text('Total Ded.', midX + 10, curY);
  //   doc.fontSize(11).fillColor('#dc2626').font('Helvetica-Bold').text(fmt(deductions.totalDeductions), midX + rightColWidth - 10, curY, { align: 'right', width: rightColWidth - 20 });

  //   y = curY + 40;

  //   // Net Pay box
  //   const netBoxH = 48;
  //   const netBoxW = contentWidth;
  //   const netBoxX = margin;
  //   const netBoxY = y;
  //   // draw filled rounded rect (PDFKit has roundedRect when using .roundedRect in some builds; fallback to normal rect if not available)
  //   try {
  //     // @ts-ignore
  //     doc.roundedRect(netBoxX, netBoxY, netBoxW, netBoxH, 6).fillAndStroke('#ecfdf5', '#d1fae5');
  //   } catch {
  //     doc.rect(netBoxX, netBoxY, netBoxW, netBoxH).fillAndStroke('#ecfdf5', '#d1fae5');
  //   }
  //   doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(12).text('Net Pay', netBoxX + 12, netBoxY + 10);
  //   doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(18)
  //     .text(fmt(payload.netSalary), netBoxX + netBoxW - 20, netBoxY + 6, { align: 'right' });

  //   y = netBoxY + netBoxH + 18;

  //   // Remarks (fixed variable usage)
  //   if (payload.remarks) {
  //     const remarkBoxX = margin;
  //     const remarkBoxW = contentWidth;
  //     const remarkY = y;

  //     try {
  //       // @ts-ignore
  //       doc.roundedRect(remarkBoxX, remarkY, remarkBoxW, 50, 6).fillAndStroke('#fffbeb', '#fef3c7');
  //     } catch {
  //       doc.rect(remarkBoxX, remarkY, remarkBoxW, 50).fillAndStroke('#fffbeb', '#fef3c7');
  //     }

  //     doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(10).text('HR Remarks', remarkBoxX + 10, remarkY + 8);
  //     doc.fillColor('#92400e').font('Helvetica').fontSize(10).text(String(payload.remarks), remarkBoxX + 10, remarkY + 26, { width: remarkBoxW - 20 });

  //     y = remarkY + 66;
  //   }

  //   // Footer note
  //   doc.fontSize(9).fillColor('#94a3b8').font('Helvetica').text('This is a system-generated payslip and does not require a signature.', margin, pageHeight - margin - 20, {
  //     align: 'center',
  //     width: contentWidth
  //   });

  //   doc.end();
  // });

  // router.post("/email/:payslipId", requireRole("admin"), async (req, res) => {
  //     const payslipId = req.params.payslipId;

  //     const { to, subject, text } = req.body as {
  //       to?: string;
  //       subject?: string;
  //       text?: string;
  //     };
  //     if (!to) return res.status(400).json({ message: "to required" });

  //     const ps = await payslipRepo.findOneBy({ id: payslipId });
  //     if (!ps) return res.status(404).json({ message: "Payslip not found" });

  //     const payload = JSON.parse(ps.data);

  //     let recipientEmail = to;
  //     if (!isValidEmail(to)) {
  //       const employee = await empRepo.findOneBy({ id: payload.employeeId });
  //       if (employee?.email && isValidEmail(employee.email)) {
  //         recipientEmail = employee.email;
  //       } else {
  //         return res.status(400).json({
  //           message: "Invalid email address",
  //           error: `The email address "${to}" is invalid and cannot be used. Test/example emails (like example.com, test.com) are not allowed.`,
  //           provided: to,
  //           employeeId: payload.employeeId,
  //           suggestion: employee?.email
  //             ? `Employee has email "${employee.email}" but it's also invalid. Please update the employee's email address in the system.`
  //             : "Employee does not have a valid email address in the system. Please add a valid email address for this employee.",
  //         });
  //       }
  //     }

  //     const doc = new PDFDocument({ margin: 40 });
  //     const chunks: Buffer[] = [];
  //     doc.on("data", (c) => chunks.push(c));
  //     doc.on("end", async () => {
  //       const pdfBuf = Buffer.concat(chunks);

  //       // Check if email is disabled
  //       if (process.env.EMAIL_DISABLED === "true") {
  //         console.log(
  //           "Email sending is disabled. PDF generated but email not sent."
  //         );
  //         return res.json({
  //           ok: true,
  //           message: "Email sending is disabled. PDF generated successfully.",
  //           pdfGenerated: true,
  //         });
  //       }

  //       const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  //       const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  //       const smtpUser = process.env.SMTP_USER || 'beharasaikumar1@gmail.com';
  //       const smtpPass = process.env.SMTP_PASS || 'ailsfwlwfxihzbwz';

  //       console.log('SMTP', process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER ? 'USER_SET' : 'NO_USER');

  //       // Check if SMTP is configured
  //       if (!smtpHost || !smtpUser || !smtpPass) {
  //         console.warn("SMTP not fully configured. Email cannot be sent.");
  //         return res.status(503).json({
  //           ok: false,
  //           message:
  //             "Email service not configured. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.",
  //           pdfGenerated: true,
  //           suggestion:
  //             "Configure SMTP settings or set EMAIL_DISABLED=true to disable email functionality",
  //         });
  //       }
  //       let lastError: any = null;
  //       const portIsSecure = smtpPort === 465;
  //       const transporter = nodemailer.createTransport({
  //         host: smtpHost,
  //         port: smtpPort,
  //         auth: {
  //           user: smtpUser,
  //           pass: smtpPass,
  //         },
  //         connectionTimeout: 8000, // 8 seconds
  //         greetingTimeout: 8000, // 8 seconds
  //         socketTimeout: 8000, // 8 seconds
  //         tls: {
  //           rejectUnauthorized: false, // Allow self-signed certificates (adjust for production)
  //         },
  //       });

  //       console.log(
  //         `Attempting to send email to ${recipientEmail} via ${smtpHost}:${smtpPort} (secure: ${portIsSecure})`
  //       );

  //       try {
  //         await transporter.sendMail({
  //           from: process.env.SMTP_FROM ?? smtpUser,
  //           to: recipientEmail,
  //           subject: subject ?? `Payslip ${payload.month}`,
  //           text:
  //             text ?? `Please find attached your payslip for ${payload.month}`,
  //           attachments: [
  //             { filename: `payslip-${payslipId}.pdf`, content: pdfBuf },
  //           ],
  //         });

  //         console.log("Email sent successfully");
  //         transporter.close();
  //         return res.json({
  //           ok: true,
  //           message: "Email sent successfully",
  //           smtpPort,
  //         });
  //       } catch (err: any) {
  //         console.error(
  //           `Failed to send email via port ${smtpPort}:`,
  //           err?.message || err
  //         );
  //         lastError = err;
  //         transporter.close();
  //       }

  //       // All attempts failed
  //       console.error("All email sending attempts failed:", lastError);
  //       const errorMessage = lastError?.message || "Failed to send email";
  //       const errorCode = lastError?.code || "EMAIL_ERROR";

  //       // Return a helpful error response
  //       return res.status(500).json({
  //         ok: false,
  //         message: "Failed to send email. Please check your SMTP configuration.",
  //         error: errorMessage,
  //         code: errorCode,
  //         pdfGenerated: true,
  //         troubleshooting: {
  //           message: "Common issues:",
  //           checks: [
  //             "Verify SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS are correct",
  //             "Check if your firewall/network allows outbound connections on ports 465 or 587",
  //             "Verify SMTP credentials are valid",
  //             "Try different SMTP_PORT (465 for SSL, 587 for STARTTLS)",
  //             "Set EMAIL_DISABLED=true to disable email and return PDF only",
  //           ],
  //         },
  //       });
  //     });

  //     doc.fontSize(18).text("Payslip", { align: "center" });
  //     doc.moveDown();
  //     doc
  //       .fontSize(12)
  //       .text(`Employee: ${payload.employeeName || payload.employeeId}`);
  //     doc.text(`Month: ${payload.month}`);
  //     doc.text(`Generated: ${payload.generatedDate}`);
  //     doc.moveDown();
  //     doc.text(`Net Salary: ₹${payload.netSalary}`);
  //     if (payload.remarks) {
  //       doc.moveDown();
  //       doc.text(`Remarks: ${payload.remarks}`);
  //     }
  //     doc.end();
  //   });

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

  return router;
}



