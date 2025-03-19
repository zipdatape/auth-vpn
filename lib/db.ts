import mysql from "mysql2/promise"

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    console.log("Executing query:", sql)
    console.log("With parameters:", params)

    let result
    if (params.length > 0) {
      ;[result] = await pool.execute(sql, params)
    } else {
      ;[result] = await pool.query(sql)
    }

    return result as T[]
  } catch (error) {
    console.error("Database query error:", error)
    if (error instanceof Error) {
      throw new Error(`Database query failed: ${error.message}`)
    } else {
      throw new Error("An unknown error occurred while querying the database")
    }
  }
}

export async function transaction<T>(callback: (connection: mysql.Connection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    console.error("Transaction error:", error)
    throw new Error("An error occurred during the database transaction")
  } finally {
    connection.release()
  }
}

