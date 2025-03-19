-- Crear las tablas si no existen
CREATE TABLE IF NOT EXISTS allowed_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userPrincipalName VARCHAR(255) NOT NULL UNIQUE,
    displayName VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS radius_servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_radius_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_principal_name VARCHAR(255) NOT NULL,
    radius_server_id INT NOT NULL,
    FOREIGN KEY (radius_server_id) REFERENCES radius_servers(id) ON DELETE CASCADE,
    UNIQUE KEY user_server_unique (user_principal_name, radius_server_id)
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS users_azure (
    id VARCHAR(255) PRIMARY KEY,
    displayName VARCHAR(255) NOT NULL,
    userPrincipalName VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sync_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    users_added INT NOT NULL DEFAULT 0,
    users_updated INT NOT NULL DEFAULT 0,
    users_deleted INT NOT NULL DEFAULT 0,
    total_users INT NOT NULL DEFAULT 0
);

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_user_principal_name ON allowed_users(userPrincipalName);
CREATE INDEX IF NOT EXISTS idx_radius_server_name ON radius_servers(name);
CREATE INDEX IF NOT EXISTS idx_user_radius_access_user ON user_radius_access(user_principal_name);
CREATE INDEX IF NOT EXISTS idx_user_radius_access_server ON user_radius_access(radius_server_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_users_azure_upn ON users_azure(userPrincipalName);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);