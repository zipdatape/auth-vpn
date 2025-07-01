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

    // Dividir el contenido SQL en statements individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`Executing ${statements.length} SQL statements...`)

    // Ejecutar cada statement individualmente
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          await connection.query(statement + ';')
          if (statement.toLowerCase().includes('create table')) {
            const tableName = statement.match(/create table (?:if not exists )?(\w+)/i)?.[1]
            console.log(`✅ Table '${tableName}' created/verified`)
          } else if (statement.toLowerCase().includes('create index')) {
            const indexName = statement.match(/create index (\w+)/i)?.[1]
            console.log(`✅ Index '${indexName}' created`)
          }
        } catch (error) {
          // Ignorar errores de índices duplicados
          if (error.code === 'ER_DUP_KEYNAME') {
            const indexName = statement.match(/create index (\w+)/i)?.[1]
            console.log(`ℹ️  Index '${indexName}' already exists, skipping`)
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, statement.substring(0, 100) + '...')
            console.error('Error details:', error.message)
            throw error
          }
        }
      }
    }

    console.log("Database initialization completed successfully")

    // Insertar algunos datos de ejemplo si es necesario
    try {
      await connection.query(`
        INSERT IGNORE INTO radius_servers (name, description) 
        VALUES 
        ('RADIUS Principal', 'Servidor RADIUS principal');
      `)
      console.log("Sample data inserted successfully")
    } catch (error) {
      console.log("Sample data insertion skipped:", error.message)
    }
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

