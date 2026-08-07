import { transporter } from '../lib/mail';

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Probation Portal — Email Verification',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: auto;">
        <h2>Email Verification</h2>
        <p>Your one-time password is:</p>
        <h1 style="letter-spacing: 8px; color: #6366f1;">${otp}</h1>
        <p style="color: #888;">Valid for 10 minutes. Do not share this code.</p>
      </div>
    `,
  });
}
