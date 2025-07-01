import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { userPrincipalName: string } }) {
  try {
    const { userPrincipalName } = params
    const rows = await query("SELECT radius_server_id FROM user_radius_access WHERE user_principal_name = ?", [
      userPrincipalName,
    ])
    const radiusServers = rows.map((row: any) => row.radius_server_id)
    return NextResponse.json({ radiusServers })
  } catch (error) {
    console.error("Error fetching user access:", error)
    return NextResponse.json({ error: "Failed to fetch user access" }, { status: 500 })
  }
}

