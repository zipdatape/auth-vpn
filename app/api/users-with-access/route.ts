import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Obtener usuarios con acceso VPN (usuarios que tienen al menos un registro en user_radius_access)
    const usersWithAccess = await query<{
      id: string
      displayName: string
      userPrincipalName: string
      server_count: number
      server_names: string
      radius_server_ids: string
    }>(`
      SELECT 
        ua.id, 
        ua.displayName, 
        ua.userPrincipalName,
        COUNT(DISTINCT ura.radius_server_id) as server_count,
        GROUP_CONCAT(DISTINCT rs.name SEPARATOR ', ') as server_names,
        GROUP_CONCAT(DISTINCT ura.radius_server_id) as radius_server_ids
      FROM 
        users_azure ua
      JOIN 
        user_radius_access ura ON ua.userPrincipalName = ura.user_principal_name
      LEFT JOIN
        radius_servers rs ON ura.radius_server_id = rs.id
      GROUP BY 
        ua.id, ua.displayName, ua.userPrincipalName
      ORDER BY 
        ua.displayName ASC
    `)

    // Procesar los IDs de servidores para convertirlos en arrays de números
    const processedUsers = usersWithAccess.map((user) => ({
      ...user,
      radius_server_ids: user.radius_server_ids.split(",").map((id) => Number.parseInt(id)),
    }))

    // Obtener el total de usuarios con acceso VPN
    const totalCount = await query<{ count: number }>(`
      SELECT COUNT(DISTINCT user_principal_name) as count 
      FROM user_radius_access
    `)

    return NextResponse.json({
      users: processedUsers,
      total: totalCount[0].count,
    })
  } catch (error) {
    console.error("Error fetching users with VPN access:", error)
    return NextResponse.json({ error: "Failed to fetch users with VPN access" }, { status: 500 })
  }
}

