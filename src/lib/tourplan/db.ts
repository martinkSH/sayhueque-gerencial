/**
 * Conexión a la base TourPlan (LA-SAYHUE, SQL Server).
 * Las credenciales se leen de variables de entorno — antes estaban hardcodeadas
 * en el código fuente (y versionadas en git) en mssql.ts, sync-quotes y tp-debug.
 *
 * Env vars (ver .env.local / Vercel → Environment Variables):
 *   TP_DB_SERVER, TP_DB_PORT, TP_DB_NAME, TP_DB_USER, TP_DB_PASSWORD
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const sql = require('mssql')

const config = {
  server:   process.env.TP_DB_SERVER ?? 'LA-SAYHUE.data.tourplan.net',
  port:     Number(process.env.TP_DB_PORT ?? 50409),
  database: process.env.TP_DB_NAME ?? 'LA-SAYHUE',
  user:     process.env.TP_DB_USER ?? 'excelLA-SAYHUE',
  password: process.env.TP_DB_PASSWORD ?? '',
  options: {
    encrypt:                true,
    trustServerCertificate: true,
    connectTimeout:         30000,
    requestTimeout:         120000,
  },
}

/** Abre un pool de conexión a TourPlan. Recordá cerrarlo con pool.close() en finally. */
export function tpConnect() {
  if (!config.password) {
    throw new Error('TP_DB_PASSWORD no está configurada (revisá .env.local / Vercel env vars)')
  }
  return sql.connect(config)
}

export { sql }
