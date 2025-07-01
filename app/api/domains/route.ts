import { NextResponse } from "next/server"
import { getAllowedDomains, getDomainsDisplayText } from "@/lib/domains"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const domains = getAllowedDomains()
    const displayText = getDomainsDisplayText()

    return NextResponse.json(
      {
        domains,
        displayText,
        count: domains.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("❌ API: Error fetching domains:", error)
    return NextResponse.json({ error: "Failed to fetch domains" }, { status: 500 })
  }
} 