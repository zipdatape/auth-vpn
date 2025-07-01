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

export async function POST(request: Request) {
  try {
    const { userId, serverId, hasAccess } = await request.json()

    if (hasAccess) {
      await pool.query("INSERT IGNORE INTO user_radius_access (user_id, radius_server_id) VALUES (?, ?)", [
        userId,
        serverId,
      ])
    } else {
      await pool.query("DELETE FROM user_radius_access WHERE user_id = ? AND radius_server_id = ?", [userId, serverId])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user access:", error)
    return NextResponse.json({ error: "Failed to update user access" }, { status: 500 })
  }
}

