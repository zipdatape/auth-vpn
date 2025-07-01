import { NextResponse } from "next/server"
import { fetchAzureUsers, type AzureUser } from "@/lib/azure"
import { query, transaction } from "@/lib/db"
import { terminateVPNSessionsForUser, getActiveVPNSessions } from "@/lib/fortigateVPN"
import { logAction } from "@/lib/auth"

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
    console.log(`📊 Usuarios actuales en la base de datos: ${currentUsers.length}`)

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

    // PASO 1: Verificar acceso RADIUS ANTES de cualquier eliminación
    if (removedUsers.length > 0) {
      console.log(`🔍 Detectados ${removedUsers.length} usuarios eliminados. Verificando acceso RADIUS...`)
      console.log(`🔍 Usuarios eliminados: ${JSON.stringify(removedUsers.map(u => u.userPrincipalName))}`)

      // Obtener la lista de usuarios con acceso RADIUS - CONSULTA CORREGIDA
      let usersWithRadiusAccess = [];
      
      if (removedUsers.length === 1) {
        // Si solo hay un usuario, usar una consulta simple
        console.log(`🔍 Consultando acceso RADIUS para un solo usuario: ${removedUsers[0].userPrincipalName}`)
        usersWithRadiusAccess = await query<{ user_principal_name: string }>(
          "SELECT user_principal_name FROM user_radius_access WHERE user_principal_name = ?",
          [removedUsers[0].userPrincipalName]
        );
      } else {
        // Si hay múltiples usuarios, construir la consulta IN correctamente
        console.log(`🔍 Consultando acceso RADIUS para múltiples usuarios: ${JSON.stringify(removedUsers.map(u => u.userPrincipalName))}`)
        const placeholders = removedUsers.map(() => '?').join(',');
        usersWithRadiusAccess = await query<{ user_principal_name: string }>(
          `SELECT user_principal_name FROM user_radius_access WHERE user_principal_name IN (${placeholders})`,
          removedUsers.map(user => user.userPrincipalName)
        );
      }
      
      console.log(`🔍 Resultado de la consulta de acceso RADIUS: ${JSON.stringify(usersWithRadiusAccess.map(u => u.user_principal_name))}`)

      // Crear un conjunto para búsquedas eficientes
      const radiusAccessSet = new Set(usersWithRadiusAccess.map((user) => user.user_principal_name))

      // Verificación detallada por usuario
      for (const user of removedUsers) {
        const hasAccess = radiusAccessSet.has(user.userPrincipalName);
        console.log(`🔍 Usuario ${user.userPrincipalName} ${hasAccess ? 'TIENE' : 'NO TIENE'} acceso RADIUS`);
      }

      // Filtrar solo los usuarios eliminados que tienen acceso RADIUS
      const removedUsersWithRadius = removedUsers.filter((user) => radiusAccessSet.has(user.userPrincipalName))

      console.log(
        `📊 De ${removedUsers.length} usuarios eliminados, ${removedUsersWithRadius.length} tienen acceso RADIUS`,
      )
      console.log(`🔍 Usuarios eliminados con acceso RADIUS: ${JSON.stringify(removedUsersWithRadius.map(u => u.userPrincipalName))}`)

      // PASO 2: Terminar sesiones VPN para usuarios con acceso RADIUS
      if (removedUsersWithRadius.length > 0) {
        console.log(`🔄 Terminando sesiones VPN para ${removedUsersWithRadius.length} usuarios con acceso RADIUS...`)

        // Obtener todas las sesiones VPN activas una sola vez para referencia
        console.log(`🔍 Obteniendo lista de todas las sesiones VPN activas...`)
        const allActiveSessions = await getActiveVPNSessions()
        console.log(`🔍 Total de sesiones VPN activas: ${allActiveSessions.length}`)

        // Establecer un límite de procesamiento concurrente para evitar sobrecargar el sistema
        const MAX_CONCURRENT = 5
        const chunks = []

        // Dividir los usuarios eliminados en grupos para procesamiento por lotes
        for (let i = 0; i < removedUsersWithRadius.length; i += MAX_CONCURRENT) {
          chunks.push(removedUsersWithRadius.slice(i, i + MAX_CONCURRENT))
        }

        console.log(`🔄 Procesando ${chunks.length} lotes de usuarios (máximo ${MAX_CONCURRENT} por lote)`)

        // Procesar cada grupo de usuarios en paralelo, pero los grupos en serie
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex]
          console.log(`🔄 Procesando lote ${chunkIndex + 1}/${chunks.length} con ${chunk.length} usuarios`)
          
          await Promise.all(
            chunk.map(async (user) => {
              try {
                console.log(`🔄 Iniciando terminación de sesiones VPN para ${user.userPrincipalName}...`)
                
                // Verificar si el usuario tiene sesiones activas
                const userSessions = allActiveSessions.filter(session => 
                  session.username.toLowerCase() === user.userPrincipalName.split('@')[0].toLowerCase()
                )
                
                if (userSessions.length === 0) {
                  console.log(`ℹ️ No se encontraron sesiones VPN activas para ${user.userPrincipalName}`)
                  return
                }
                
                console.log(`🔍 Se encontraron ${userSessions.length} sesiones VPN activas para ${user.userPrincipalName}`)
                
                // Intentar terminar las sesiones con reintentos
                let attempts = 0
                const maxAttempts = 3
                
                while (attempts < maxAttempts) {
                  try {
                    attempts++
                    console.log(`🔄 Intento ${attempts}/${maxAttempts} para terminar sesiones VPN de ${user.userPrincipalName}`)
                    await terminateVPNSessionsForUser(user.userPrincipalName)
                    
                    // Registrar la acción en los logs de auditoría
                    await logAction(
                      1, // ID del sistema para acciones automáticas
                      "auto_terminate_vpn",
                      `Sesión VPN terminada automáticamente para el usuario eliminado ${user.userPrincipalName} (intento ${attempts})`,
                    )
                    
                    console.log(`✅ Sesiones VPN terminadas para ${user.userPrincipalName} en intento ${attempts}`)
                    break // Salir del bucle si tiene éxito
                  } catch (error) {
                    console.error(`❌ Error en intento ${attempts}/${maxAttempts} al terminar sesiones VPN para ${user.userPrincipalName}:`, error)
                    
                    if (attempts < maxAttempts) {
                      console.log(`🔄 Reintentando en 3 segundos...`)
                      await new Promise(resolve => setTimeout(resolve, 3000))
                    } else {
                      console.error(`❌ Se agotaron los intentos para terminar sesiones VPN de ${user.userPrincipalName}`)
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Error general al procesar terminación de VPN para ${user.userPrincipalName}:`, error)
              }
            }),
          )
          
          console.log(`✅ Lote ${chunkIndex + 1}/${chunks.length} procesado`)
        }

        console.log(`✅ Proceso de terminación de sesiones VPN completado para ${removedUsersWithRadius.length} usuarios`)
      } else {
        console.log(`ℹ️ No hay usuarios eliminados con acceso RADIUS. Omitiendo terminación de sesiones VPN.`)
      }
    }

    // PASO 3: Actualizar la base de datos DESPUÉS de terminar las sesiones VPN
    await transaction(async (connection) => {
      // Eliminar acceso RADIUS para usuarios removidos
      if (removedUsers.length > 0) {
        console.log(`🗑️ Eliminando acceso RADIUS para ${removedUsers.length} usuarios...`)
        for (const user of removedUsers) {
          console.log(`🗑️ Iniciando eliminación de acceso RADIUS para: ${user.userPrincipalName}`)
          await query("DELETE FROM user_radius_access WHERE user_principal_name = ?", [user.userPrincipalName])
          console.log(`✅ Acceso RADIUS eliminado exitosamente para: ${user.userPrincipalName}`)
        }
        console.log(`✅ Acceso RADIUS eliminado para todos los usuarios removidos`)
      }

      // Limpiar la tabla users_azure
      console.log(`🗑️ Limpiando tabla users_azure...`)
      await query("TRUNCATE TABLE users_azure")
      console.log(`✅ Tabla users_azure limpiada exitosamente`)

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
        console.log(`✅ Todos los usuarios insertados exitosamente`)
      }

      // Registrar el evento de sincronización solo si hay cambios
      if (hasChanges) {
        console.log(`📝 Registrando evento de sincronización...`)
        await query(
          "INSERT INTO sync_events (users_added, users_updated, users_deleted, total_users) VALUES (?, ?, ?, ?)",
          [addedUsers.length, updatedUsers.length, removedUsers.length, azureUsers.length],
        )
        console.log(`✅ Evento de sincronización registrado exitosamente`)
      } else {
        console.log(`ℹ️ No se registró evento de sincronización porque no hubo cambios`)
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
