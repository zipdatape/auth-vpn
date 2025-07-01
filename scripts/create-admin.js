const mysql = require("mysql2/promise")
const bcrypt = require("bcryptjs")
require("dotenv").config()

async function createAdmin(username, password) {
  // Configuración de la conexión a la base de datos
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number.parseInt(process.env.DB_PORT || "3306"),
  }

  let connection
  try {
    // Crear conexión
    connection = await mysql.createConnection(dbConfig)
    console.log("Connected to database successfully.")

    // Verificar si el usuario ya existe
    const [rows] = await connection.query("SELECT COUNT(*) as count FROM users WHERE username = ?", [username])

    if (rows[0].count > 0) {
      console.log(`User '${username}' already exists.`)
      return
    }

    // Hashear la contraseña
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Insertar el nuevo usuario admin
    await connection.query("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, NOW())", [
      username,
      hashedPassword,
      "admin",
    ])

    console.log(`Admin user '${username}' created successfully.`)
  } catch (error) {
    console.error("Error creating admin user:", error)
    throw error
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// Ejecutar la función con los parámetros deseados
// Puedes cambiar estos valores según tus necesidades
createAdmin("admin", "r0m4n0s").catch((error) => {
  console.error("Failed to create admin user:", error)
  process.exit(1)
})

