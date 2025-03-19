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

// GET: Obtener todos los portales VPN
export async function GET() {
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

    const portals = authRules.map((rule: any) => ({
      id: rule.id,
      name: rule.portal,
      userCount: rule.users?.length || 0,
      groupCount: rule.groups?.length || 0,
      status: "Active", // Asumimos que todos están activos, ajusta según sea necesario
    }))

    return NextResponse.json(portals)
  } catch (error) {
    console.error("Error fetching VPN portals:", error)

    if (axios.isAxiosError(error)) {
      console.error("Axios error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      })

      // Log the full error object for debugging
      console.error("Full error object:", JSON.stringify(error, null, 2))

      if (error.response?.status === 401) {
        console.error("Authentication failed. Please check your API token.")
      }

      return NextResponse.json(
        { error: "Error fetching VPN portals", details: error.message },
        { status: error.response?.status || 500 },
      )
    }

    // If it's not an Axios error, it's a generic error
    return NextResponse.json(
      { error: "Error fetching VPN portals", details: "An unexpected error occurred" },
      { status: 500 },
    )
  }
}

// POST: Crear un nuevo portal VPN
export async function POST(request: Request) {
  try {
    if (!FORTIGATE_API_URL || !FORTIGATE_API_TOKEN) {
      throw new Error("FortiGate API URL or token is not set in environment variables")
    }

    const { name, users, groups } = await request.json()

    const response = await axios.get(`${FORTIGATE_API_URL}/cmdb/vpn.ssl/settings`, {
      headers: {
        Authorization: `Bearer ${FORTIGATE_API_TOKEN}`,
        Accept: "application/json",
      },
      httpsAgent: createHttpsAgent(),
    })

    const settings = response.data.results
    const authRules = settings["authentication-rule"]

    // Crear una nueva regla de autenticación para el portal
    const newRule = {
      id: (Math.max(...authRules.map((r: any) => r.id)) + 1).toString(),
      portal: name,
      users: users || [],
      groups: groups ? groups.map((g: string) => ({ name: g })) : [],
      auth: "auth-portal", // Ajusta según sea necesario
    }

    authRules.push(newRule)

    // Actualizar la configuración en FortiGate
    await axios.put(
      `${FORTIGATE_API_URL}/cmdb/vpn.ssl/settings`,
      {
        "authentication-rule": authRules,
      },
      {
        headers: {
          Authorization: `Bearer ${FORTIGATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        httpsAgent: createHttpsAgent(),
      },
    )

    return NextResponse.json({ success: true, portal: newRule }, { status: 201 })
  } catch (error) {
    console.error("Error creating VPN portal:", error)

    if (axios.isAxiosError(error)) {
      console.error("Axios error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      })

      // Log the full error object for debugging
      console.error("Full error object:", JSON.stringify(error, null, 2))

      return NextResponse.json(
        { error: "Error creating VPN portal", details: error.message },
        { status: error.response?.status || 500 },
      )
    }

    // If it's not an Axios error, it's a generic error
    return NextResponse.json(
      { error: "Error creating VPN portal", details: "An unexpected error occurred" },
      { status: 500 },
    )
  }
}

