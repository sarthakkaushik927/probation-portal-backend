import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { generateOTP, isExpired } from '../utils/otp.util';
import { sendOTPEmail } from './email.service';

export async function signupUser(name: string, email: string, password: string, studentType?: any, phoneNumber?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, password: hashedPassword, studentType, phoneNumber },
  });
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error('User not found. Please sign up first.');
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    throw new Error('Incorrect password');
  }

  if (!user.isVerified) {
    throw new Error('UNVERIFIED');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.AUTH_SECRET!,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      domain: user.domain,
    },
  };
}

export async function sendOTP(email: string) {
  const otp = generateOTP();

  await prisma.oTP.deleteMany({ where: { email } });

  await prisma.oTP.create({
    data: {
      email,
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendOTPEmail(email, otp);
}

export async function verifyOTP(email: string, otp: string) {
  const record = await prisma.oTP.findFirst({
    where: { email, code: otp },
  });

  if (!record) {
    throw new Error('Invalid OTP');
  }

  if (isExpired(record.expiresAt)) {
    throw new Error('OTP has expired. Please request a new one.');
  }

  await prisma.user.update({
    where: { email },
    data: { isVerified: true },
  });

  await prisma.oTP.deleteMany({ where: { email } });
}

export async function resetPasswordWithOTP(email: string, otp: string, newPassword: string) {
  const record = await prisma.oTP.findFirst({
    where: { email, code: otp },
  });

  if (!record) {
    throw new Error('Invalid OTP');
  }

  if (isExpired(record.expiresAt)) {
    throw new Error('OTP has expired. Please request a new one.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, isVerified: true },
  });

  await prisma.oTP.deleteMany({ where: { email } });
}
