"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, Filter } from "lucide-react"
import useSWR from "swr"

interface UserWithAccess {
  id: string
  displayName: string
  userPrincipalName: string
  server_count: number
  server_names: string
  radius_server_ids: number[]
}

interface RadiusServer {
  id: number
  name: string
  description: string | null
}

interface UsersWithAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function UsersWithAccessDialog({ open, onOpenChange }: UsersWithAccessDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedServer, setSelectedServer] = useState<string>("all")

  const {
    data: usersData,
    error: usersError,
    isLoading: usersLoading,
  } = useSWR<{
    users: UserWithAccess[]
    total: number
  }>(open ? "/api/users-with-access" : null, fetcher)

  const { data: serversData } = useSWR<{ servers: RadiusServer[] }>(open ? "/api/radius/servers" : null, fetcher)

  // Filter users based on search term and selected server
  const filteredUsers =
    usersData?.users.filter((user) => {
      const matchesSearch =
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userPrincipalName.toLowerCase().includes(searchTerm.toLowerCase())

      // If "all" is selected or the user has access to the selected server
      const matchesServer =
        selectedServer === "all" ||
        (user.radius_server_ids && user.radius_server_ids.includes(Number.parseInt(selectedServer)))

      return matchesSearch && matchesServer
    }) || []

  // Function to export data to CSV
  const exportToCSV = () => {
    if (!filteredUsers.length) return

    // Create CSV header
    const headers = ["Display Name", "Email", "Servers Count", "Server Names"]

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...filteredUsers.map((user) =>
        [
          `"${user.displayName.replace(/"/g, '""')}"`,
          `"${user.userPrincipalName.replace(/"/g, '""')}"`,
          user.server_count,
          `"${user.server_names.replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n")

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)

    // Create filename with current date
    const date = new Date().toISOString().split("T")[0]
    const serverFilter =
      selectedServer === "all"
        ? "all-servers"
        : `server-${selectedServer}-${serversData?.servers.find((s) => s.id === Number.parseInt(selectedServer))?.name || ""}`

    link.setAttribute("download", `vpn-users-${serverFilter}-${date}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Users with VPN Access</DialogTitle>
          <DialogDescription>{usersData?.total} users have access to VPN servers</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search users..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="w-48">
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by server" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Servers</SelectItem>
                  {serversData?.servers.map((server) => (
                    <SelectItem key={server.id} value={server.id.toString()}>
                      {server.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredUsers.length === 0}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow">
          {usersLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : usersError ? (
            <div className="text-center py-8 text-red-500">Error loading users</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Servers Count</TableHead>
                  <TableHead>Server Names</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.displayName}</TableCell>
                    <TableCell>{user.userPrincipalName}</TableCell>
                    <TableCell>{user.server_count}</TableCell>
                    <TableCell>{user.server_names}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {usersData?.total || 0} users
        </div>
      </DialogContent>
    </Dialog>
  )
}

