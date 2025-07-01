import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, logAction } from "@/lib/auth"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const serverId = Number.parseInt(params.id)
    if (isNaN(serverId)) {
      return NextResponse.json({ error: "Invalid server ID" }, { status: 400 })
    }

    // Obtener información del servidor antes de eliminarlo
    const servers = await query<{ name: string }>("SELECT name FROM radius_servers WHERE id = ?", [serverId])

    if (servers.length === 0) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 })
    }

    // Eliminar primero los registros relacionados en user_radius_access
    await query("DELETE FROM user_radius_access WHERE radius_server_id = ?", [serverId])
    console.log(`Deleted access records for server ID ${serverId}`)

    // Ahora eliminar el servidor
    await query("DELETE FROM radius_servers WHERE id = ?", [serverId])
    console.log(`Deleted server with ID ${serverId}`)

    // Registrar la acción
    await logAction(
      session.id,
      "delete_radius_server",
      `Admin ${session.username} deleted RADIUS server ${servers[0].name} (ID: ${serverId})`,
    )

    return NextResponse.json({
      message: "RADIUS server deleted successfully",
      serverName: servers[0].name,
      serverId: serverId,
    })
  } catch (error) {
    console.error("Error deleting RADIUS server:", error)
    return NextResponse.json(
      {
        error: "Failed to delete RADIUS server",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

