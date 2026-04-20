import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

if (process.env.NODE_ENV === 'production' && !process.env.TELEGRAM_WEBHOOK_SECRET) {
  throw new Error('TELEGRAM_WEBHOOK_SECRET is required in production');
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || '',
  JWT_SECRET: required('JWT_SECRET'),
  PORT: Number(process.env.PORT) || 3001,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_MANAGERS_CHAT_ID: process.env.TELEGRAM_MANAGERS_CHAT_ID || '',
  TELEGRAM_ADMIN_IDS: process.env.TELEGRAM_ADMIN_IDS || '',
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  TELEGRAM_MINIAPP_URL: process.env.TELEGRAM_MINIAPP_URL || '',
  CRON_SECRET: process.env.CRON_SECRET || '',
};
