import { NextResponse } from "next/server"
import axios from "axios"
import https from "https"

const FORTIGATE_API_URL = process.env.FORTIGATE_API_URL
const FORTIGATE_API_TOKEN = process.env.FORTIGATE_API_TOKEN

// Helper function to create HTTPS agent
const createHttpsAgent = () => {
  return new https.Agent({
    rejectUnauthorized: false, // Only use this in development/testing. For production, use proper SSL certificates.
  })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!FORTIGATE_API_URL || !FORTIGATE_API_TOKEN) {
      throw new Error("FortiGate API URL or token is not set in environment variables")
    }

    console.log(`Attempting to connect to FortiGate API at: ${FORTIGATE_API_URL}`)

    const response = await axios.get(`${FORTIGATE_API_URL}/cmdb/vpn.ssl/settings`, {
      headers: {
        Authorization: `Bearer ${FORTIGATE_API_TOKEN}`,
        Accept: "application/json",
      },
      httpsAgent: createHttpsAgent(),
    })

    console.log("Successfully fetched VPN portal settings")

    const authRules = response.data.results["authentication-rule"]
    const rule = authRules.find((r: any) => r.id.toString() === params.id)

    if (!rule) {
      console.error(`Portal with ID ${params.id} not found`)
      return NextResponse.json({ error: "Portal not found" }, { status: 404 })
    }

    console.log(`Fetching details for portal: ${rule.portal}`)

    // Obtener detalles de cada grupo
    const groupDetails = await Promise.all(
      (rule.groups || []).map(async (group: any) => {
        try {
          const groupResponse = await axios.get(`${FORTIGATE_API_URL}/cmdb/user/group/${group.name}`, {
            headers: {
              Authorization: `Bearer ${FORTIGATE_API_TOKEN}`,
              Accept: "application/json",
            },
            httpsAgent: createHttpsAgent(),
          })

          return {
            name: group.name,
            members: groupResponse.data.results.member || [],
            id: group.name,
          }
        } catch (error) {
          console.error(`Error fetching group details for ${group.name}:`, error)
          return {
            name: group.name,
            members: [],
            id: group.name,
            error: "Failed to fetch group details",
          }
        }
      }),
    )

    const portalDetails = {
      id: rule.id,
      name: rule.portal,
      status: "Active", // Asumimos que está activo, ajusta según sea necesario
      userCount: rule.users?.length || 0,
      groupCount: rule.groups?.length || 0,
      settings: {
        realm: rule.realm || "",
        clientCert: rule.client_cert === "enable",
        cipher: rule.cipher,
      },
      users: rule.users || [],
      groups: groupDetails,
    }

    console.log(`Successfully fetched details for portal: ${rule.portal}`)
    return NextResponse.json(portalDetails)
  } catch (error) {
    console.error("Error fetching portal details:", error)

    if (axios.isAxiosError(error)) {
      console.error("Axios error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      })

      if (error.response?.status === 401) {
        console.error("Authentication failed. Please check your API token.")
        return NextResponse.json({ error: "Authentication failed. Please check your API token." }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: "Error fetching portal details", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { users, groups } = await request.json()

    const response = await axios.get(`${FORTIGATE_API_URL}/api/v2/cmdb/vpn.ssl/settings`, {
      headers: {
        Authorization: `Bearer ${process.env.FORTIGATE_API_TOKEN}`,
      },
      httpsAgent: new (require("https").Agent)({
        rejectUnauthorized: false,
      }),
    })

    const settings = response.data.results
    const authRules = settings["authentication-rule"]
    const ruleIndex = authRules.findIndex((r: any) => r.id.toString() === params.id)

    if (ruleIndex === -1) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 })
    }

    // Actualizar usuarios y grupos
    authRules[ruleIndex].users = users
    authRules[ruleIndex].groups = groups.map((group: any) => ({ name: group.name }))

    // Actualizar configuración en FortiGate
    await axios.put(
      `${FORTIGATE_API_URL}/api/v2/cmdb/vpn.ssl/settings`,
      {
        "authentication-rule": authRules,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FORTIGATE_API_TOKEN}`,
        },
        httpsAgent: new (require("https").Agent)({
          rejectUnauthorized: false,
        }),
      },
    )

    // Actualizar miembros de los grupos
    for (const group of groups) {
      await axios.put(
        `${FORTIGATE_API_URL}/api/v2/cmdb/user/group/${group.name}`,
        {
          member: group.members,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.FORTIGATE_API_TOKEN}`,
          },
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }),
        },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating VPN portal:", error)
    return NextResponse.json({ error: "Error updating VPN portal" }, { status: 500 })
  }
}

