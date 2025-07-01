import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const events = await query<{
      id: number
      timestamp: string
      users_added: number
      users_updated: number
      users_deleted: number
      total_users: number
    }>("SELECT * FROM sync_events ORDER BY timestamp DESC LIMIT 10")

    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Error fetching sync events:", error)
    return NextResponse.json({ error: "Failed to fetch sync events" }, { status: 500 })
  }
}

