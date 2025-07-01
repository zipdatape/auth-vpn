import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, logAction } from "@/lib/auth"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = Number.parseInt(params.id)

    // Obtener información del usuario antes de eliminarlo
    const users = await query<{ username: string }>("SELECT username FROM users WHERE id = ?", [userId])

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // No permitir eliminar al usuario admin
    if (users[0].username === "admin") {
      return NextResponse.json({ error: "Cannot delete admin user" }, { status: 403 })
    }

    // Registrar la acción ANTES de eliminar el usuario
    await logAction(session.id, "delete_user", `Admin ${session.username} deleted user ${users[0].username}`)

    // Verificar y asegurar que la restricción de clave foránea permita SET NULL
    console.log("Verificando restricciones de clave foránea...")
    
    try {
      // Verificar si existe la restricción problemática
      const constraintCheck = await query<{ CONSTRAINT_NAME: string }>(
        `SELECT CONSTRAINT_NAME 
         FROM information_schema.REFERENTIAL_CONSTRAINTS 
         WHERE CONSTRAINT_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'audit_logs' 
         AND REFERENCED_TABLE_NAME = 'users'`
      )
      
      if (constraintCheck.length > 0) {
        const constraintName = constraintCheck[0].CONSTRAINT_NAME
        console.log(`Encontrada restricción: ${constraintName}`)
        
        // Eliminar la restricción existente
        await query(`ALTER TABLE audit_logs DROP FOREIGN KEY ${constraintName}`)
        console.log("Restricción antigua eliminada")
        
        // Asegurar que la columna user_id permita NULL
        await query("ALTER TABLE audit_logs MODIFY COLUMN user_id INT NULL")
        console.log("Columna user_id modificada para permitir NULL")
        
        // Agregar nueva restricción con ON DELETE SET NULL
        await query(`
          ALTER TABLE audit_logs 
          ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (user_id) REFERENCES users(id) 
          ON DELETE SET NULL ON UPDATE CASCADE
        `)
        console.log("Nueva restricción agregada con ON DELETE SET NULL")
      }
      
    } catch (constraintError) {
      console.log("Error manejando restricciones o ya están configuradas correctamente:", constraintError)
    }
    
    // Ahora intentar eliminar el usuario
    await query("DELETE FROM users WHERE id = ?", [userId])
    console.log(`Usuario ${users[0].username} eliminado exitosamente`)

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

