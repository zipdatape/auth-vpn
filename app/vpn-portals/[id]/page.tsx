"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GroupDetailsDialog } from "@/components/ui/group-details-dialog"

interface Portal {
  id: string
  name: string
  status: string
  userCount: number
  groupCount: number
  settings: {
    realm?: string
    clientCert?: boolean
    cipher?: string
  }
  users: { name: string }[]
  groups: {
    id: string
    name: string
  }[]
}

export default function PortalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [portalData, setPortalData] = useState<Portal | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPortalData = useCallback(async () => {
    try {
      const response = await fetch(`/api/vpn-portals/${params.id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch portal details")
      }
      const data = await response.json()
      setPortalData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    }
  }, [params.id])

  useEffect(() => {
    fetchPortalData()
  }, [fetchPortalData])

  if (error) return <div>Failed to load portal details: {error}</div>
  if (!portalData) return <div>Loading...</div>

  return (
    <div>
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to VPN Portals
      </Button>
      <h1 className="text-3xl font-bold mb-6">{portalData.name}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Portal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2">
              <div>
                <dt className="font-medium">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      portalData.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {portalData.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-medium">Users</dt>
                <dd>{portalData.userCount}</dd>
              </div>
              <div>
                <dt className="font-medium">Groups</dt>
                <dd>{portalData.groupCount}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Portal Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2">
              <div>
                <dt className="font-medium">Realm</dt>
                <dd>{portalData.settings.realm || "None"}</dd>
              </div>
              <div>
                <dt className="font-medium">Client Certificate</dt>
                <dd>{portalData.settings.clientCert ? "Required" : "Not Required"}</dd>
              </div>
              <div>
                <dt className="font-medium">Cipher</dt>
                <dd>{portalData.settings.cipher}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Sección de Grupos */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Assigned Groups</CardTitle>
          <CardDescription>Groups with access to this VPN portal</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portalData.groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>
                    <GroupDetailsDialog
                      group={group}
                      portalId={params.id as string}
                      onAccessRevoked={fetchPortalData}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {portalData.groups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No groups assigned to this portal
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sección de Usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Users</CardTitle>
          <CardDescription>Users with direct access to this VPN portal</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portalData.users.map((user) => (
                <TableRow key={user.name}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const updatedUsers = portalData.users.filter((u) => u.name !== user.name)
                        await fetch(`/api/vpn-portals/${params.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            users: updatedUsers,
                            groups: portalData.groups,
                          }),
                        })
                        fetchPortalData()
                      }}
                    >
                      Remove Access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {portalData.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No users directly assigned to this portal
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

