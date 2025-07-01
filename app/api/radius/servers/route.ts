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

    const servers = await query<{
      id: number
      name: string
      description: string | null
      created_at: string
    }>("SELECT id, name, description, created_at FROM radius_servers ORDER BY name ASC")

    return NextResponse.json({ servers })
  } catch (error) {
    console.error("Error fetching RADIUS servers:", error)
    return NextResponse.json({ error: "Failed to fetch RADIUS servers" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description } = await request.json()

    // Validar datos
    if (!name) {
      return NextResponse.json({ error: "Server name is required" }, { status: 400 })
    }

    // Verificar si ya existe un servidor con ese nombre
    const existing = await query<{ count: number }>("SELECT COUNT(*) as count FROM radius_servers WHERE name = ?", [
      name,
    ])

    if (existing[0].count > 0) {
      return NextResponse.json({ error: "A server with that name already exists" }, { status: 400 })
    }

    const result = await query("INSERT INTO radius_servers (name, description) VALUES (?, ?)", [
      name,
      description || null,
    ])

    // Obtener el ID del servidor recién creado
    const newServerResult = await query<{ id: number }>("SELECT LAST_INSERT_ID() as id")
    const newServerId = newServerResult[0]?.id

    return NextResponse.json({
      message: "RADIUS server created successfully",
      serverId: newServerId,
    })
  } catch (error) {
    console.error("Error creating RADIUS server:", error)
    return NextResponse.json({ error: "Failed to create RADIUS server" }, { status: 500 })
  }
}

