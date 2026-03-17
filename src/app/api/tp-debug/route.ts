export const runtime = 'nodejs'
/* eslint-disable @typescript-eslint/no-require-imports */
const sql = require('mssql')

const config = {
  server:   'LA-SAYHUE.data.tourplan.net',
  port:     50409,
  database: 'LA-SAYHUE',
  user:     'excelLA-SAYHUE',
  password: 'o6rmFv7$RJnp14NzqI18',
  options: {
    encrypt:                true,
    trustServerCertificate: true,
    connectTimeout:         30000,
    requestTimeout:         60000,
  },
}

export async function GET() {
  let pool: any = null
  try {
    pool = await sql.connect(config)

    const sample = await pool.request().query(`
      SELECT 
        BookingReference,
        BookingCostAmount, BookingCostBaseAmount, BookingCostTaxAmount, BookingCostTaxBaseAmount,
        BookingSellAmount, BookingSellBaseAmount, BookingSellTaxAmount, BookingSellTaxBaseAmount,
        BookingRetailAmount, BookingAgentAmount, BookingMarginAmount,
        BookingCurrencyCode
      FROM vw_BookingHeaderReportData
      WHERE BookingReference = 'ALFI115046'
    `)

    return Response.json({ sampleAmounts: sample.recordset })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  } finally {
    if (pool) await pool.close()
  }
}
