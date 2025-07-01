import { exec } from "child_process"
import { promisify } from "util"
import { logAction } from "./auth"

const execPromise = promisify(exec)

// Añadir un timeout para evitar que las operaciones se queden bloqueadas indefinidamente
async function execWithTimeout(command: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process = exec(command, (error, stdout, stderr) => {
      // Si hay un error en stderr pero stdout contiene un JSON válido con success=true,
      // consideramos que la operación fue exitosa a pesar del error
      if (stdout) {
        try {
          const result = JSON.parse(stdout)
          if (result.success === true) {
            resolve({ stdout, stderr })
            return
          }
        } catch (e) {
          // Si no podemos parsear el stdout como JSON, continuamos con el manejo normal de errores
        }
      }

      if (error) {
        reject(error)
        return
      }

      resolve({ stdout, stderr })
    })

    // Establecer un timeout para matar el proceso si tarda demasiado
    setTimeout(() => {
      if (process.exitCode === null) {
        process.kill()
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`))
      }
    }, timeoutMs)
  })
}

export async function terminateVPNSessionsForUser(userPrincipalName: string): Promise<void> {
  try {
    console.log(`🔄 Intentando terminar sesiones VPN para el usuario: ${userPrincipalName}`)

    // Extraer el nombre de usuario sin el dominio (FortiGate a menudo usa solo el nombre sin dominio)
    const username = userPrincipalName.split("@")[0]
    console.log(`🔍 Nombre de usuario extraído para FortiGate: ${username}`)

    // Primero verificar si el usuario tiene sesiones VPN activas
    console.log(`🔍 Verificando si ${username} tiene sesiones VPN activas...`)
    const activeSessions = await getActiveVPNSessions()
    const userSessions = activeSessions.filter(session => 
      session.username.toLowerCase() === username.toLowerCase()
    )
    
    if (userSessions.length === 0) {
      console.log(`ℹ️ No se encontraron sesiones VPN activas para ${username}`)
      return
    }
    
    console.log(`🔍 Se encontraron ${userSessions.length} sesiones VPN activas para ${username}: ${JSON.stringify(userSessions.map(s => s.index))}`)

    // Ejecutar el script Python con timeout
    const command = `python3 scripts/terminate_vpn_session.py terminate "${username}"`
    console.log(`🔄 Ejecutando comando: ${command}`)

    const { stdout, stderr } = await execWithTimeout(command, 30000)

    console.log(`🔍 Salida estándar del script: ${stdout}`)

    if (stderr) {
      console.log(`❌ Error en la salida del script Python: ${stderr}`)
    }

    // Parsear la respuesta JSON del script
    const result = JSON.parse(stdout)

    if (!result.success) {
      // Si no hay sesiones para este usuario, no es un error crítico
      if (result.message.includes("No active sessions found")) {
        console.log(`ℹ️ No se encontraron sesiones activas para ${username}`)
        return
      }

      console.error(`❌ Error al terminar sesiones VPN: ${result.message}`)
      throw new Error(result.message)
    }

    console.log(`✅ Resultado de terminación de sesión VPN para ${username}: ${result.message}`)

    // Si llegamos aquí, la operación fue exitosa
    if (result.terminated_sessions && result.terminated_sessions.length > 0) {
      console.log(`✅ Sesiones terminadas: ${JSON.stringify(result.terminated_sessions)}`)
    }

    // Verificar que las sesiones realmente se hayan cerrado
    console.log(`🔍 Verificando que las sesiones de ${username} se hayan cerrado correctamente...`)
    const sessionsAfter = await getActiveVPNSessions()
    const userSessionsAfter = sessionsAfter.filter(session => 
      session.username.toLowerCase() === username.toLowerCase()
    )
    
    if (userSessionsAfter.length > 0) {
      console.warn(`⚠️ Aún hay ${userSessionsAfter.length} sesiones activas para ${username} después de intentar terminarlas`)
      console.warn(`⚠️ Sesiones restantes: ${JSON.stringify(userSessionsAfter.map(s => s.index))}`)
    } else {
      console.log(`✅ Confirmado: No hay sesiones activas para ${username}`)
    }

    // Registrar en logs de auditoría
    await logAction(
      1, // ID del sistema para acciones automáticas
      "auto_terminate_vpn",
      `Sesión VPN terminada automáticamente para el usuario eliminado ${userPrincipalName}`,
    )

    console.log(`✅ Terminación de sesiones VPN completada para ${userPrincipalName}`)
  } catch (error) {
    console.error(`❌ Error al terminar sesiones VPN para ${userPrincipalName}:`, error)
    throw error
  }
}

export async function getActiveVPNSessions(): Promise<any[]> {
  try {
    // Ejecutar el script Python para listar sesiones con timeout
    console.log(`🔄 Obteniendo sesiones VPN activas...`)
    const { stdout, stderr } = await execWithTimeout("python3 scripts/terminate_vpn_session.py list", 30000)

    if (stderr) {
      console.log(`❌ Error en la salida del script Python: ${stderr}`)
    }

    // Parsear la respuesta JSON del script
    const result = JSON.parse(stdout)

    if (!result.success) {
      console.error(`❌ Error al obtener sesiones VPN: ${result.message}`)
      throw new Error(result.message)
    }

    console.log(`✅ Sesiones VPN activas obtenidas: ${result.sessions ? result.sessions.length : 0}`)
    return result.sessions || []
  } catch (error) {
    console.error("❌ Error al obtener sesiones VPN activas:", error)
    return []
  }
}

export async function terminateVPNSession(sessionId: string): Promise<void> {
  try {
    // Ejecutar el script Python directamente con el índice de sesión
    console.log(`🔄 Terminando sesión VPN con ID: ${sessionId}`)
    const { stdout, stderr } = await execWithTimeout(
      `python3 scripts/terminate_vpn_session.py terminate-index ${sessionId}`,
      30000,
    )

    if (stderr) {
      console.log(`❌ Error en la salida del script Python: ${stderr}`)
    }

    // Parsear la respuesta JSON del script
    const result = JSON.parse(stdout)

    if (!result.success) {
      console.error(`❌ Error al terminar la sesión VPN ${sessionId}: ${result.message}`)
      throw new Error(result.message)
    }

    console.log(`✅ Sesión VPN ${sessionId} terminada.`)
    
    // Verificar que la sesión realmente se haya cerrado
    console.log(`🔍 Verificando que la sesión ${sessionId} se haya cerrado correctamente...`)
    const sessionsAfter = await getActiveVPNSessions()
    const sessionExists = sessionsAfter.some(session => session.index === sessionId)
    
    if (sessionExists) {
      console.warn(`⚠️ La sesión ${sessionId} sigue activa después de intentar terminarla`)
    } else {
      console.log(`✅ Confirmado: La sesión ${sessionId} ha sido terminada correctamente`)
    }
  } catch (error) {
    console.error(`❌ Error al terminar la sesión VPN ${sessionId}:`, error)
    throw error
  }
}
