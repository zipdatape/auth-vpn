import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, logAction } from "@/lib/auth"

interface AllowedUserRequest {
  userPrincipalName: string
  radiusServers: number[]
}

interface RadiusServer {
  id: number
  name: string
  description: string | null
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userPrincipalName, radiusServers }: AllowedUserRequest = await request.json()

    console.log("Received request to update access for user:", userPrincipalName)
    console.log("Requested RADIUS servers:", radiusServers)

    // Fetch current access before making changes
    const currentAccess = await query<{ radius_server_id: number }>(
      "SELECT radius_server_id FROM user_radius_access WHERE user_principal_name = ?",
      [userPrincipalName],
    )
    const currentServerIds = currentAccess.map((record) => record.radius_server_id)

    // Fetch server details
    const allServerIds = Array.from(new Set(currentServerIds.concat(radiusServers)))
    const serverDetails = await query<RadiusServer>(
      "SELECT id, name, description FROM radius_servers WHERE id IN (?)",
      [allServerIds],
    )
    console.log("Fetched server details:", serverDetails) // Debug log

    const serverInfoMap = new Map(
      serverDetails.map((server) => [server.id, `${server.name} (${server.description || "No description"})`]),
    )

    // First, remove all existing access
    await query("DELETE FROM user_radius_access WHERE user_principal_name = ?", [userPrincipalName])

    console.log("Deleted existing access records")

    // Then, add new access records if any servers are selected
    if (radiusServers && radiusServers.length > 0) {
      const insertPromises = radiusServers.map((serverId) =>
        query("INSERT INTO user_radius_access (user_principal_name, radius_server_id) VALUES (?, ?)", [
          userPrincipalName,
          serverId,
        ]),
      )
      await Promise.all(insertPromises)
      console.log("Inserted new access records for servers:", radiusServers)
    }

    // Determine granted and revoked servers
    const grantedServers = radiusServers.filter((id) => !currentServerIds.includes(id))
    const revokedServers = currentServerIds.filter((id) => !radiusServers.includes(id))

    // Prepare server info strings
    const getServerInfo = (ids: number[]) => ids.map((id) => serverInfoMap.get(id) || id.toString()).join(", ")
    const grantedInfo = getServerInfo(grantedServers)
    const revokedInfo = getServerInfo(revokedServers)

    // Log the action with server information
    let action: string
    let details: string
    const userRole = session.role === "admin" ? "Admin" : "User"
    if (grantedServers.length > 0 && revokedServers.length > 0) {
      action = "update_vpn_access"
      details = `${userRole} ${session.username} updated VPN access for user ${userPrincipalName}. Granted: ${grantedInfo}. Revoked: ${revokedInfo}`
    } else if (grantedServers.length > 0) {
      action = "grant_vpn_access"
      details = `${userRole} ${session.username} granted VPN access for user ${userPrincipalName}. Servers: ${grantedInfo}`
    } else if (revokedServers.length > 0) {
      action = "revoke_vpn_access"
      details = `${userRole} ${session.username} revoked VPN access for user ${userPrincipalName}. Servers: ${revokedInfo}`
    } else {
      action = "no_change_vpn_access"
      details = `${userRole} ${session.username} made no changes to VPN access for user ${userPrincipalName}`
    }

    await logAction(session.id, action, details)

    return NextResponse.json({
      success: true,
      radiusServers: radiusServers,
    })
  } catch (error) {
    console.error("Error updating allowed user:", error)
    return NextResponse.json(
      {
        error: "Failed to update user access",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const users = await query<{
      user_principal_name: string
      radius_server_id: number
      name: string
      description: string | null
    }>(
      `SELECT DISTINCT 
        ura.user_principal_name,
        ura.radius_server_id,
        rs.name,
        rs.description
      FROM user_radius_access ura
      LEFT JOIN radius_servers rs ON ura.radius_server_id = rs.id`,
    )

    const userMap = new Map<string, { id: number; name: string | null; description: string | null }[]>()
    users.forEach((user) => {
      if (!userMap.has(user.user_principal_name)) {
        userMap.set(user.user_principal_name, [])
      }
      userMap.get(user.user_principal_name)!.push({
        id: user.radius_server_id,
        name: user.name || null,
        description: user.description || null,
      })
    })

    const result = Array.from(userMap.entries()).map(([userPrincipalName, radiusServers]) => ({
      userPrincipalName,
      radiusServers,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error reading allowed users:", error)
    return NextResponse.json({ error: "Failed to read allowed users" }, { status: 500 })
  }
}

