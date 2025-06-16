import { Client } from "@microsoft/microsoft-graph-client"
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials"
import { ClientSecretCredential } from "@azure/identity"

export interface AzureUser {
  id: string
  displayName: string
  userPrincipalName: string
}

export function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!,
  )

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  })

  return Client.initWithMiddleware({ authProvider })
}

// Dominios permitidos por defecto
const DEFAULT_DOMAIN_FILTERS = ["@1.com", "@2.com"]

export async function fetchAzureUsers(domainFilters: string[] = DEFAULT_DOMAIN_FILTERS): Promise<AzureUser[]> {
  const graphClient = getGraphClient()
  let allUsers: AzureUser[] = []
  let nextLink: string | null = null

  try {
    console.log(`📊 Consultando TODOS los usuarios de Azure AD (sin filtros)...`)
    console.log(`🔍 Dominios a filtrar: ${domainFilters.join(", ")}`)

    // Primera solicitud - sin filtros, obtenemos todos los usuarios
    let response = await graphClient
      .api("/users")
      .select("id,displayName,userPrincipalName")
      .top(999) // Máximo permitido por la API
      .get()

    // Procesar la primera página de resultados
    if (response && response.value) {
      // Filtrar manualmente para obtener solo usuarios con los dominios especificados
      const filteredUsers: AzureUser[] = response.value.filter((user: AzureUser) =>
        domainFilters.some((domain) => user.userPrincipalName.endsWith(domain)),
      )
      allUsers = allUsers.concat(filteredUsers)

      // Log detallado por dominio
      domainFilters.forEach((domain) => {
        const domainCount = filteredUsers.filter((user: AzureUser) => user.userPrincipalName.endsWith(domain)).length
        console.log(`📝 Obtenidos ${domainCount} usuarios con dominio ${domain}`)
      })

      console.log(
        `📝 Total obtenidos ${filteredUsers.length} usuarios con dominios permitidos (de ${response.value.length} totales, primera página)`,
      )

      // Verificar si hay más páginas
      nextLink = response["@odata.nextLink"] || null
    }

    // Procesar páginas adicionales si existen
    while (nextLink) {
      console.log(`📊 Obteniendo página adicional de usuarios...`)

      // Para páginas adicionales, usamos el nextLink directamente
      response = await graphClient.api(nextLink).get()

      if (response && response.value) {
        // Filtrar manualmente para obtener solo usuarios con los dominios especificados
        const filteredUsers: AzureUser[] = response.value.filter((user: AzureUser) =>
          domainFilters.some((domain) => user.userPrincipalName.endsWith(domain)),
        )
        allUsers = allUsers.concat(filteredUsers)

        // Log detallado por dominio
        domainFilters.forEach((domain) => {
          const domainCount = filteredUsers.filter((user: AzureUser) => user.userPrincipalName.endsWith(domain)).length
          console.log(`📝 Obtenidos ${domainCount} usuarios con dominio ${domain} (página adicional)`)
        })

        console.log(
          `📝 Total obtenidos ${filteredUsers.length} usuarios con dominios permitidos (de ${response.value.length} totales, página adicional)`,
        )

        // Actualizar nextLink para la siguiente iteración
        nextLink = response["@odata.nextLink"] || null
      } else {
        nextLink = null
      }
    }

    // Log final por dominio
    console.log(`✅ Resumen final por dominio:`)
    domainFilters.forEach((domain) => {
      const domainCount = allUsers.filter((user: AzureUser) => user.userPrincipalName.endsWith(domain)).length
      console.log(`   - ${domain}: ${domainCount} usuarios`)
    })
    console.log(`✅ Total final de usuarios obtenidos de Azure AD: ${allUsers.length}`)

    return allUsers
  } catch (error) {
    console.error("❌ Error fetching users from Azure AD:", error)
    throw error
  }
}
