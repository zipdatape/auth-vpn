import { NextResponse } from "next/server"
import { fetchAzureUsers, type AzureUser } from "@/lib/azure"
import { query, transaction } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  try {
    console.log("🔄 Iniciando sincronización con Azure AD...")

    // Obtener todos los usuarios de Azure AD y filtrar por dominio en el cliente
    const azureUsers: AzureUser[] = await fetchAzureUsers()
    console.log("✅ Usuarios obtenidos de Azure AD:", azureUsers.length)

    // Obtener usuarios actuales en la base de datos
    const currentUsers = await query<{ id: string; userPrincipalName: string; displayName: string }>(
      "SELECT id, userPrincipalName, displayName FROM users_azure",
    )

    // Crear conjuntos para comparación eficiente
    const azureUserMap = new Map(azureUsers.map((user) => [user.userPrincipalName, user]))
    const currentUserMap = new Map(currentUsers.map((user) => [user.userPrincipalName, user]))

    // Identificar usuarios añadidos, actualizados y eliminados
    const addedUsers = azureUsers.filter((user) => !currentUserMap.has(user.userPrincipalName))
    const updatedUsers = azureUsers.filter((user) => {
      const currentUser = currentUserMap.get(user.userPrincipalName)
      return currentUser && (currentUser.id !== user.id || currentUser.displayName !== user.displayName)
    })
    const removedUsers = currentUsers.filter((user) => !azureUserMap.has(user.userPrincipalName))

    // Verificar si hay cambios
    const hasChanges = addedUsers.length > 0 || updatedUsers.length > 0 || removedUsers.length > 0

    console.log(`📊 Análisis de cambios:`)
    console.log(`- Usuarios nuevos: ${addedUsers.length}`)
    console.log(`- Usuarios actualizados: ${updatedUsers.length}`)
    console.log(`- Usuarios eliminados: ${removedUsers.length}`)
    console.log(`- Total de usuarios en Azure AD: ${azureUsers.length}`)
    console.log(`- ¿Hay cambios? ${hasChanges ? "Sí" : "No"}`)

    await transaction(async (connection) => {
      // Eliminar acceso RADIUS para usuarios removidos
      if (removedUsers.length > 0) {
        console.log(`🗑️ Eliminando acceso RADIUS para ${removedUsers.length} usuarios...`)
        for (const user of removedUsers) {
          await query("DELETE FROM user_radius_access WHERE user_principal_name = ?", [user.userPrincipalName])
        }
        console.log(`🗑️ Acceso RADIUS eliminado para ${removedUsers.length} usuarios`)
      }

      // Limpiar la tabla users_azure
      await query("TRUNCATE TABLE users_azure")
      console.log("🗑️ Tabla users_azure limpiada")

      // Insertar los usuarios actuales de Azure AD en lotes
      if (azureUsers.length > 0) {
        console.log(`📝 Insertando ${azureUsers.length} usuarios en la base de datos...`)

        // Insertar en lotes de 1000 usuarios para mejor rendimiento
        const batchSize = 1000
        for (let i = 0; i < azureUsers.length; i += batchSize) {
          const batch = azureUsers.slice(i, i + batchSize)

          if (batch.length > 0) {
            // Preparar la consulta para inserción múltiple con REPLACE INTO
            const placeholders = batch.map(() => "(?, ?, ?)").join(", ")
            const values = batch.flatMap((user) => [user.id, user.displayName, user.userPrincipalName])

            await query(`REPLACE INTO users_azure (id, displayName, userPrincipalName) VALUES ${placeholders}`, values)

            console.log(`📝 Insertados/Actualizados ${i + batch.length} de ${azureUsers.length} usuarios`)
          }
        }
      }

      // Registrar el evento de sincronización solo si hay cambios
      if (hasChanges) {
        await query(
          "INSERT INTO sync_events (users_added, users_updated, users_deleted, total_users) VALUES (?, ?, ?, ?)",
          [addedUsers.length, updatedUsers.length, removedUsers.length, azureUsers.length],
        )
        console.log("📝 Evento de sincronización registrado")
      } else {
        console.log("ℹ️ No se registró evento de sincronización porque no hubo cambios")
      }
    })

    console.log(`✅ Sincronización completada. ${azureUsers.length} usuarios en la base de datos.`)
    if (hasChanges) {
      console.log(
        `📊 Usuarios añadidos: ${addedUsers.length}, actualizados: ${updatedUsers.length}, eliminados: ${removedUsers.length}`,
      )
    } else {
      console.log("📊 No hubo cambios en los usuarios")
    }

    return NextResponse.json(
      {
        message: "Sincronización completada",
        usersAdded: addedUsers.length,
        usersUpdated: updatedUsers.length,
        usersDeleted: removedUsers.length,
        totalUsers: azureUsers.length,
        removedAccessCount: removedUsers.length,
        usersCount: azureUsers.length,
        hasChanges: hasChanges,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: any) {
    console.error("❌ Error durante la sincronización:", error.message)
    return NextResponse.json(
      { error: "Error durante la sincronización de usuarios", details: error.message },
      { status: 500 },
    )
  }
}

