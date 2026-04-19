import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || '',
  JWT_SECRET: required('JWT_SECRET'),
  PORT: Number(process.env.PORT) || 3001,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_MANAGERS_CHAT_ID: process.env.TELEGRAM_MANAGERS_CHAT_ID || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
};
