/**
 * Configuración de dominios permitidos para el filtrado de usuarios
 */

/**
 * Obtiene la lista de dominios permitidos desde las variables de entorno
 * @returns Array de dominios permitidos
 */
export function getAllowedDomains(): string[] {
  const domainsEnv = process.env.ALLOWED_DOMAINS || "@globalhitss.com,@hitss.com"
  
  return domainsEnv
    .split(",")
    .map(domain => domain.trim())
    .filter(domain => domain.length > 0)
}

/**
 * Verifica si un email pertenece a alguno de los dominios permitidos
 * @param email - Email a verificar
 * @returns true si el email pertenece a un dominio permitido
 */
export function isEmailFromAllowedDomain(email: string): boolean {
  const allowedDomains = getAllowedDomains()
  return allowedDomains.some(domain => email.endsWith(domain))
}

/**
 * Obtiene una representación legible de los dominios permitidos
 * @returns String con los dominios separados por comas
 */
export function getDomainsDisplayText(): string {
  return getAllowedDomains().join(", ")
}

/**
 * Filtra una lista de usuarios por dominios permitidos
 * @param users - Lista de usuarios con userPrincipalName
 * @returns Lista filtrada de usuarios
 */
export function filterUsersByAllowedDomains<T extends { userPrincipalName: string }>(users: T[]): T[] {
  return users.filter(user => isEmailFromAllowedDomain(user.userPrincipalName))
} 