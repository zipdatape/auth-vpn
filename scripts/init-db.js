const mysql = require("mysql2/promise")
const fs = require("fs").promises
const path = require("path")
require("dotenv").config()

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number.parseInt(process.env.DB_PORT || "3306"),
  multipleStatements: true,
}

async function initDatabase() {
  let connection
  try {
    // Crear conexión
    connection = await mysql.createConnection(dbConfig)
    console.log("Connected to database successfully.")

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, "init-db.sql")
    const sqlContent = await fs.readFile(sqlPath, "utf8")

    // Ejecutar los statements SQL
    await connection.query(sqlContent)
    console.log("Database initialization completed successfully")

    // Insertar algunos datos de ejemplo si es necesario
    await connection.query(`
      INSERT IGNORE INTO radius_servers (name, description, host, port, users_table) 
      VALUES 
      ('RADIUS Principal', 'Servidor RADIUS principal', 'localhost', 1812, 'allowed_users');
    `)
    console.log("Sample data inserted successfully")
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// Ejecutar la inicialización
initDatabase().catch(console.error)

