export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function isExpired(date: Date): boolean {
  return date < new Date();
}
