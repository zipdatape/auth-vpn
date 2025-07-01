import { NextResponse } from "next/server"
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

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    const [rows] = await pool.query("SELECT radius_server_id FROM user_radius_access WHERE user_id = ?", [
      params.userId,
    ])
    const serverIds = (rows as any[]).map((row) => row.radius_server_id)
    return NextResponse.json(serverIds)
  } catch (error) {
    console.error("Error fetching user access:", error)
    return NextResponse.json({ error: "Failed to fetch user access" }, { status: 500 })
  }
}

