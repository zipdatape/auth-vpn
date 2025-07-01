"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, Filter, ChevronLeft, ChevronRight } from "lucide-react"
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
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

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

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedServer])

  // Function to export data to Excel - exports ALL users with VPN access
  const exportToExcel = () => {
    if (!usersData?.users.length) return

    // Import XLSX library dynamically to avoid SSR issues
    import('xlsx').then((XLSX) => {
      // Prepare data for export - use ALL users, not filtered
      const exportData = usersData.users.map((user) => ({
        "Display Name": user.displayName,
        "Email": user.userPrincipalName,
        "Servers Count": user.server_count,
        "Server Names": user.server_names,
        "Radius Server IDs": user.radius_server_ids.join(", "),
      }))

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      
      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "VPN Users")

      // Create filename with current date
      const date = new Date().toISOString().split("T")[0]
      const filename = `vpn-users-complete-${date}.xlsx`

      // Save file
      XLSX.writeFile(workbook, filename)
    }).catch((error) => {
      console.error("Error exporting to Excel:", error)
    })
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
              onClick={exportToExcel}
              disabled={!usersData?.users.length}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
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
                {currentUsers.map((user) => (
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

        {/* Pagination controls */}
        {filteredUsers.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages} - Mostrando {currentUsers.length} de {filteredUsers.length} usuarios
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          Total de usuarios con acceso VPN: {usersData?.total || 0}
        </div>
      </DialogContent>
    </Dialog>
  )
}

