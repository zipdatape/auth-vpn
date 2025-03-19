import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    const { groupName, username } = await request.json()

    if (!groupName || !username) {
      return NextResponse.json({ error: "Group name and username are required" }, { status: 400 })
    }

    console.log(`Attempting to revoke access for user ${username} from group ${groupName}`)

    const { stdout, stderr } = await execAsync(`python scripts/revoke_access.py "${groupName}" "${username}"`)

    if (stderr) {
      console.error("Python script error:", stderr)
      return NextResponse.json({ error: "Failed to revoke access", details: stderr }, { status: 500 })
    }

    console.log("Python script output:", stdout)

    try {
      const result = JSON.parse(stdout)
      if (result.success) {
        return NextResponse.json({ message: result.message })
      } else {
        return NextResponse.json({ error: result.message }, { status: 400 })
      }
    } catch (parseError) {
      console.error("Error parsing Python script output:", parseError)
      return NextResponse.json({ error: "Failed to parse script output", details: stdout }, { status: 500 })
    }
  } catch (error) {
    console.error("Error revoking access:", error)
    return NextResponse.json(
      { error: "Failed to revoke access", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

