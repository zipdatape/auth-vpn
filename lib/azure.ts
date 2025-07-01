import { Client } from "@microsoft/microsoft-graph-client"
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials"
import { ClientSecretCredential } from "@azure/identity"
import { getAllowedDomains, filterUsersByAllowedDomains, getDomainsDisplayText } from "./domains"

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

export async function fetchAzureUsers(): Promise<AzureUser[]> {
  const graphClient = getGraphClient()
  let allUsers: AzureUser[] = []
  let nextLink: string | null = null
  const allowedDomains = getAllowedDomains()
  const domainsText = getDomainsDisplayText()

  try {
    console.log(`📊 Consultando TODOS los usuarios de Azure AD (sin filtros)...`)

    // Primera solicitud - sin filtros, obtenemos todos los usuarios
    let response = await graphClient
      .api("/users")
      .select("id,displayName,userPrincipalName")
      .top(999) // Máximo permitido por la API
      .get()

    // Procesar la primera página de resultados
    if (response && response.value) {
      // Filtrar manualmente para obtener solo usuarios con los dominios permitidos
      const filteredUsers = filterUsersByAllowedDomains(response.value as AzureUser[])
      allUsers = allUsers.concat(filteredUsers)
      console.log(
        `📝 Obtenidos ${filteredUsers.length} usuarios con dominios permitidos ${domainsText} (de ${response.value.length} totales, primera página)`,
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
        // Filtrar manualmente para obtener solo usuarios con los dominios permitidos
        const filteredUsers = filterUsersByAllowedDomains(response.value as AzureUser[])
        allUsers = allUsers.concat(filteredUsers)
        console.log(
          `📝 Obtenidos ${filteredUsers.length} usuarios con dominios permitidos ${domainsText} (de ${response.value.length} totales, página adicional)`,
        )

        // Actualizar nextLink para la siguiente iteración
        nextLink = response["@odata.nextLink"] || null
      } else {
        nextLink = null
      }
    }

    console.log(`✅ Total final de usuarios obtenidos de Azure AD con dominios permitidos ${domainsText}: ${allUsers.length}`)
    return allUsers
  } catch (error) {
    console.error("❌ Error fetching users from Azure AD:", error)
    throw error
  }
}

