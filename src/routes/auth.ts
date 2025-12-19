import { Router } from 'express';
import { DataSource } from 'typeorm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { User } from '../entities/User';
import { PasswordResetToken } from '../entities/PasswordResetToken';
import { AuthRequest, authRequired } from '../middleware/auth';
 
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-secure-secret';

export default function authRouter(dataSource: DataSource) {
  const router = Router();
  const userRepo = dataSource.getRepository(User);
  const tokenRepo = dataSource.getRepository(PasswordResetToken);

  //  router.post('/signup', async (req, res) => {
  //   const { username, email, password } = req.body;

  //   const exists = await userRepo.findOne({
  //     where: [{ username }, { email }]
  //   });

  //   if (exists) return res.status(400).json({ message: 'User already exists' });
    
  //   const hashedPassword = await bcrypt.hash(password, 10); 

  //   const user = userRepo.create({ username, email, password: hashedPassword });
  //   await userRepo.save(user);

  //   res.json({ ok: true, message: 'Account created successfully' });
  // });

   router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await userRepo.findOne({ where: { username } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, employeeId: user.employeeId ?? null, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ ok: true, token, user });
  });

   router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    const user = await userRepo.findOne({ where: { email } });

     if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');

    await tokenRepo.delete({ userId: user.id });

    await tokenRepo.save({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
    });

    const frontend_url = process.env.FRONTEND_URL || 'http://localhost:3000';

    const resetUrl = `${frontend_url}/reset-password/${token}`;

    const mailer = nodemailer.createTransport({ 
      host: process.env.SMTP_HOST || 'smtp.gmail.com', 
      port: Number(process.env.SMTP_PORT || 465), 
      secure: true, 
      auth: { 
        user: process.env.SMTP_USER || 'beharasaikumar1@gmail.com', 
        pass: process.env.SMTP_PASS || 'ailsfwlwfxihzbwz' 
      } 
    });

    await mailer.sendMail({
      from: process.env.SMTP_USER || 'beharasaikumar1@gmail.com' ,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 15 minutes.</p>
      `
    });

    res.json({ ok: true, message: 'Reset link sent to email' });
  });

   router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const reset = await tokenRepo.findOne({ where: { token } });

    if (!reset || reset.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const user = await userRepo.findOneBy({ id: reset.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = await bcrypt.hash(password, 10);
    await userRepo.save(user);

    await tokenRepo.delete({ id: reset.id });

    res.json({ ok: true, message: 'Password reset successful' });
  });

  router.get('/me', authRequired, (req: AuthRequest, res) => {
    res.json(req.user);
  });

  return router;
}
