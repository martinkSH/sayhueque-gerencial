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

    // Team Leader — 1 fila de muestra
    const tl = await pool.request().query(`
      SELECT TOP 1
        DATEDIFF(DAY, BookingTravelDate, LastServiceDate) AS Cant_Dias,
        *
      FROM vw_BookingHeaderReportData
      WHERE BookingBranchCode IN ('WE','WI','PL','AL','DM','GR','BN')
    `)

    // Bookings Audit — 1 fila de muestra
    const audit = await pool.request().query(`
      SELECT TOP 1
        x.Reference, x.FULL_REFERENCE, x.PrevBookingStatus AS PreviousStatus,
        x.BOOKINGSTATUS AS NewStatus, x.DateOfChange, x.ChangedBy,
        x.TRAVELDATE, x.BRANCH, x.Analysis1, x.Analysis3, x.BookingStatus
      FROM (
        SELECT
          bhd.REFERENCE AS Reference, bhd.FULL_REFERENCE, bud.BOOKINGSTATUS,
          bud.lw_date AS DateOfChange, bud.USERNAME AS ChangedBy,
          bhd.TRAVELDATE, bhd.BRANCH,
          SA1.DESCRIPTION Analysis1, SA3.DESCRIPTION Analysis3,
          LAG(bud.BOOKINGSTATUS) OVER (
            PARTITION BY bhd.BHD_ID ORDER BY bud.DATECREATED
          ) AS PrevBookingStatus
        FROM [LA-SAYHUE_Audit].dbo.BUD AS bud
        JOIN BHD ON BHD.BHD_ID = bud.BHD_ID
        JOIN SA1 ON SA1.CODE = BHD.SALE1
        JOIN SA3 ON SA3.CODE = BHD.SALE3
      ) x
      WHERE x.PrevBookingStatus IS NOT NULL
        AND x.PrevBookingStatus <> x.BOOKINGSTATUS
    `)

    return Response.json({
      teamLeader: {
        columns: Object.keys(tl.recordset[0] ?? {}),
        sample:  tl.recordset[0],
      },
      bookingsAudit: {
        columns: Object.keys(audit.recordset[0] ?? {}),
        sample:  audit.recordset[0],
      },
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  } finally {
    if (pool) await pool.close()
  }
}
