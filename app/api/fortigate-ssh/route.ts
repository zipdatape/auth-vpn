import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function POST(request: Request) {
  const { groupName } = await request.json()

  console.log(`Received request for group: ${groupName}`)

  try {
    console.log(`Executing Python script with group: ${groupName}`)
    const { stdout, stderr } = await execAsync(`python3 scripts/fortigate_ssh.py "${groupName}"`)

    if (stderr) {
      console.error("Script error:", stderr)
      return NextResponse.json({ error: "Error executing Python script" }, { status: 500 })
    }

    console.log("Python script output:", stdout)

    try {
      const result = JSON.parse(stdout)
      return NextResponse.json(result)
    } catch (parseError) {
      console.error("Error parsing script output:", parseError)
      return NextResponse.json({ error: "Failed to parse script output" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error executing script:", error)
    return NextResponse.json({ error: "Failed to execute Python script" }, { status: 500 })
  }
}

