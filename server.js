const { createServer } = require("https")
const { parse } = require("url")
const next = require("next")
const fs = require("fs")
const path = require("path")
const mysql = require("mysql2/promise")
const { exec } = require("child_process")
const util = require("util")

const execPromise = util.promisify(exec)

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || path.join(process.cwd(), "server.key")),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || path.join(process.cwd(), "server.crt")),
}

// Función para verificar y inicializar la base de datos si es necesario
async function checkAndInitializeDatabase() {
  try {
    console.log("Verificando estado de la base de datos...")

    // Configuración de la conexión a la base de datos
    const dbConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number.parseInt(process.env.DB_PORT || "3306"),
    }

    // Intentar conectar a la base de datos
    const connection = await mysql.createConnection(dbConfig)

    // Verificar si la tabla users existe
    const [tables] = await connection.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'users'
    `,
      [process.env.DB_NAME],
    )

    // Si la tabla users no existe, inicializar la base de datos
    if (tables.length === 0) {
      console.log("La tabla 'users' no existe. Inicializando la base de datos...")

      // Ejecutar el script de inicialización de la base de datos
      try {
        const { stdout, stderr } = await execPromise("node scripts/init-db.js")
        console.log("Salida de init-db.js:", stdout)
        if (stderr) console.error("Error en init-db.js:", stderr)
        console.log("Base de datos inicializada correctamente.")
      } catch (error) {
        console.error("Error al ejecutar init-db.js:", error)
        throw error
      }
    } else {
      console.log("La base de datos ya está inicializada.")
    }

    // Verificar explícitamente si existe el usuario admin
    const [adminUsers] = await connection.query("SELECT COUNT(*) as count FROM users WHERE username = ?", ["admin"])

    // Si no existe el usuario admin, ejecutar el script para crearlo
    if (adminUsers[0].count === 0) {
      console.log("No se encontró el usuario admin. Ejecutando script para crear usuario admin...")

      try {
        const { stdout, stderr } = await execPromise("node scripts/create-admin.js")
        console.log("Salida de create-admin.js:", stdout)
        if (stderr) console.error("Error en create-admin.js:", stderr)
        console.log("Script de creación de usuario admin ejecutado.")
      } catch (error) {
        console.error("Error al ejecutar create-admin.js:", error)
        throw error
      }
    } else {
      console.log("El usuario admin ya existe.")
    }

    await connection.end()
  } catch (error) {
    console.error("Error al verificar/inicializar la base de datos:", error)
    // No detenemos el servidor en caso de error, solo registramos el problema
  }
}

app.prepare().then(async () => {
  // Verificar e inicializar la base de datos antes de iniciar el servidor
  await checkAndInitializeDatabase()

  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(process.env.PORT || 3000, "0.0.0.0", (err) => {
    if (err) throw err
    console.log(`> Ready on https://0.0.0.0:${process.env.PORT || 3000}`)
  })
})

