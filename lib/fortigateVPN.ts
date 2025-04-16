import { exec } from "child_process"
import { promisify } from "util"
import { logAction } from "./auth"

const execPromise = promisify(exec)

export async function terminateVPNSessionsForUser(userPrincipalName: string): Promise<void> {
  try {
    console.log(`Intentando terminar sesiones VPN para el usuario: ${userPrincipalName}`)

    // Extraer el nombre de usuario sin el dominio (FortiGate a menudo usa solo el nombre sin dominio)
    const username = userPrincipalName.split("@")[0]

    // Ejecutar el script Python
    const { stdout, stderr } = await execPromise(`python scripts/terminate_vpn_session.py terminate ${username}`)

    if (stderr) {
      console.error(`Error al ejecutar el script Python: ${stderr}`)
      throw new Error(stderr)
    }

    // Parsear la respuesta JSON del script
    const result = JSON.parse(stdout)

    if (!result.success) {
      console.error(`Error al terminar sesiones VPN: ${result.message}`)
      throw new Error(result.message)
    }

    console.log(`Resultado de terminación de sesión VPN para ${username}: ${result.message}`)

    // Registrar en logs de auditoría
    await logAction(
      1, // ID del sistema para acciones automáticas
      "auto_terminate_vpn",
      `Sesión VPN terminada automáticamente para el usuario eliminado ${userPrincipalName}`,
    )

    console.log(`Terminación de sesiones VPN completada para ${userPrincipalName}`)
  } catch (error) {
    console.error(`Error al terminar sesiones VPN para ${userPrincipalName}:`, error)
    throw error
  }
}

export async function getActiveVPNSessions(): Promise<any[]> {
  try {
    // Ejecutar el script Python para listar sesiones
    const { stdout, stderr } = await execPromise("python scripts/terminate_vpn_session.py list")

    if (stderr) {
      console.error(`Error al ejecutar el script Python: ${stderr}`)
      throw new Error(stderr)
    }

    // Parsear la respuesta JSON del script
    const result = JSON.parse(stdout)

    if (!result.success) {
      console.error(`Error al obtener sesiones VPN: ${result.message}`)
      throw new Error(result.message)
    }

    return result.sessions || []
  } catch (error) {
    console.error("Error al obtener sesiones VPN activas:", error)
    return []
  }
}

export async function terminateVPNSession(sessionId: string): Promise<void> {
  try {
    // Para terminar una sesión específica por ID, primero necesitamos obtener todas las sesiones
    const sessions = await getActiveVPNSessions()

    // Buscar la sesión con el ID especificado
    const session = sessions.find((s) => s.index === sessionId)

    if (!session) {
      throw new Error(`No se encontró la sesión VPN con ID ${sessionId}`)
    }

    // Terminar la sesión usando el nombre de usuario
    await terminateVPNSessionsForUser(session.username)

    console.log(`Sesión VPN ${sessionId} terminada.`)
  } catch (error) {
    console.error(`Error al terminar la sesión VPN ${sessionId}:`, error)
    throw error
  }
}
