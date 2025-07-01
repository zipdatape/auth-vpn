import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { getAllowedDomains } from "@/lib/domains"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Obtener parámetros de paginación de la URL
    const url = new URL(request.url)
    const page = Number.parseInt(url.searchParams.get("page") || "1")
    const limit = Number.parseInt(url.searchParams.get("limit") || "100")
    const search = url.searchParams.get("search") || ""
    const allowedDomains = getAllowedDomains() // Obtener dominios permitidos desde configuración

    // Validar parámetros
    const validPage = page > 0 ? page : 1
    const validLimit = limit > 0 && limit <= 500 ? limit : 100
    const offset = (validPage - 1) * validLimit

    console.log(`🔄 API: Fetching users with pagination (page ${validPage}, limit ${validLimit})...`)

    // Construir la consulta base con filtro de dominios múltiples
    let sqlQuery = `
      SELECT DISTINCT
        ua.id, 
        ua.displayName, 
        ua.userPrincipalName,
        GROUP_CONCAT(DISTINCT ura.radius_server_id) as vpnServers
      FROM 
        users_azure ua
      LEFT JOIN 
        user_radius_access ura ON ua.userPrincipalName = ura.user_principal_name
      WHERE 
        (${allowedDomains.map(() => 'ua.userPrincipalName LIKE ?').join(' OR ')})
    `

    // Parámetros base con los filtros de dominios
    const queryParams = []
    allowedDomains.forEach(domain => {
      queryParams.push(`%${domain}`)
    })

    // Añadir condición de búsqueda si se proporciona
    if (search) {
      sqlQuery += `
        AND (
          ua.displayName LIKE ? OR 
          ua.userPrincipalName LIKE ?
        )
      `
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    // Añadir agrupación y ordenación
    sqlQuery += `
      GROUP BY 
        ua.id, ua.displayName, ua.userPrincipalName
      ORDER BY 
        ua.displayName ASC
    `

    // Añadir límites como parte de la consulta, no como parámetros
    sqlQuery += ` LIMIT ${validLimit} OFFSET ${offset}`

    // Ejecutar la consulta principal
    const users = await query<{
      id: string
      displayName: string
      userPrincipalName: string
      vpnServers: string | null
    }>(sqlQuery, queryParams)

    // Obtener el total de usuarios para la paginación
    let countQuery = `
      SELECT COUNT(DISTINCT ua.id) as total 
      FROM users_azure ua 
      WHERE (${allowedDomains.map(() => 'ua.userPrincipalName LIKE ?').join(' OR ')})
    `

    const countParams = []
    allowedDomains.forEach(domain => {
      countParams.push(`%${domain}`)
    })

    if (search) {
      countQuery += ` AND (ua.displayName LIKE ? OR ua.userPrincipalName LIKE ?)`
      countParams.push(`%${search}%`, `%${search}%`)
    }

    const totalResult = await query<{ total: number }>(countQuery, countParams)
    const total = totalResult[0].total

    console.log(`📊 API: Number of users fetched: ${users.length} (total: ${total})`)

    const formattedUsers = users.map((user) => ({
      ...user,
      vpnServers: user.vpnServers ? user.vpnServers.split(",").map(Number) : [],
      hasVpnAccess: !!user.vpnServers,
    }))

    return NextResponse.json(
      {
        users: formattedUsers,
        pagination: {
          total,
          page: validPage,
          limit: validLimit,
          totalPages: Math.ceil(total / validLimit),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("❌ API: Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

