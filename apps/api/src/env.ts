function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in apps/api/.env (see .env.example)`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN,
  production: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  accessSecret: required("JWT_ACCESS_SECRET"),
  refreshSecret: required("JWT_REFRESH_SECRET"),
  /** where the web app lives; used in emailed links */
  appUrl: (process.env.APP_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173").replace(/\/$/, ""),
  resendKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM ?? "Ascend <onboarding@resend.dev>",
};
