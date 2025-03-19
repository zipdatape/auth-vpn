"use client"

import { useState, useCallback, useEffect } from "react"
import { Users, Shield, RefreshCw, Search, ChevronLeft, ChevronRight, Settings } from "lucide-react"
import useSWR from "swr"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserAccessManagement } from "@/components/UserAccessManagement"
import { UsersWithAccessDialog } from "@/components/UsersWithAccessDialog"

interface User {
  id: string
  displayName: string
  userPrincipalName: string
  hasVpnAccess: boolean
  vpnServers: number[]
}

interface RadiusServer {
  id: number
  name: string
  description: string | null
}

interface PaginationInfo {
  total: number
  page: number
  limit: number
  totalPages: number
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json())

export function DashboardClient() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false)
  const [isUsersWithAccessDialogOpen, setIsUsersWithAccessDialogOpen] = useState(false)
  const { toast } = useToast()

  // Dominio fijo para filtrar
  const domainFilter = "@yourdomain.com"

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1) // Reset to first page on new search
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const {
    data: usersData,
    error: usersError,
    mutate: mutateUsers,
    isLoading,
  } = useSWR<{ users: User[]; pagination: PaginationInfo }>(
    `/api/users?page=${page}&limit=${limit}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      dedupingInterval: 0,
    },
  )

  const { data: radiusServersData } = useSWR<{ servers: RadiusServer[] }>("/api/radius/servers", fetcher)

  const { data: usersWithAccessData } = useSWR<{ total: number }>("/api/users-with-access", fetcher)

  const { data: sessionData } = useSWR<{ user: { role: string } }>("/api/auth/me", fetcher)

  const users = usersData?.users || []
  const pagination = usersData?.pagination
  const radiusServers = radiusServersData?.servers || []
  const isAdmin = sessionData?.user?.role === "admin"
  const usersWithAccessCount = usersWithAccessData?.total || 0

  useEffect(() => {
    if (usersData) {
      console.log("Dashboard data updated:", usersData.users.length, "users")
    }
  }, [usersData])

  const syncUsers = async () => {
    if (!isAdmin) return
    setIsSyncing(true)
    try {
      const response = await fetch("/api/sync-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to synchronize users")
      }

      const data = await response.json()

      // Mensaje personalizado basado en si hubo cambios o no
      if (data.hasChanges) {
        toast({
          title: "Sincronización completada",
          description: `Se han sincronizado ${data.usersCount} usuarios con Azure AD. Cambios: ${data.usersAdded} añadidos, ${data.usersUpdated} actualizados, ${data.usersDeleted} eliminados.`,
        })
      } else {
        toast({
          title: "Sincronización completada",
          description: `No se detectaron cambios. Todos los ${data.usersCount} usuarios están actualizados.`,
        })
      }

      await mutateUsers()
    } catch (error) {
      console.error("Error syncing users:", error)
      toast({
        title: "Error",
        description: "No se pudo sincronizar los usuarios",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleManualRefresh = useCallback(async () => {
    try {
      await mutateUsers()
      toast({
        title: "Datos actualizados",
        description: "Los datos de usuarios se han actualizado correctamente.",
      })
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast({
        title: "Error",
        description: "No se pudieron actualizar los datos",
        variant: "destructive",
      })
    }
  }, [mutateUsers, toast])

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && (!pagination || newPage <= pagination.totalPages)) {
      setPage(newPage)
    }
  }

  const handleManageAccess = (user: User) => {
    setSelectedUser(user)
    setIsAccessDialogOpen(true)
  }

  const handleAccessUpdated = () => {
    mutateUsers()
  }

  if (usersError) {
    return <div>Error loading data</div>
  }

  return (
    <>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleManualRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Actualizar datos
              </Button>
              <Button onClick={syncUsers} disabled={isSyncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando..." : "Sincronizar con Azure AD"}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Total Users ({domainFilter})
              </CardTitle>
              <CardDescription>Total users with domain {domainFilter}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{pagination?.total || users.length}</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setIsUsersWithAccessDialogOpen(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-4 w-4" />
                VPN Access
              </CardTitle>
              <CardDescription>Users with VPN access (click to view details)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{usersWithAccessCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and pagination controls */}
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder={`Search users with domain ${domainFilter}...`}
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="border rounded p-2"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1) // Reset to first page when changing limit
              }}
            >
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="250">250 per page</option>
              <option value="500">500 per page</option>
            </select>
          </div>

          {pagination && (
            <div className="flex justify-between items-center">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total}{" "}
                users
              </div>

              {/* Paginación simplificada sin usar los componentes de pagination.tsx */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>

                {page > 1 && (
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(1)}>
                    1
                  </Button>
                )}

                {page > 3 && <span>...</span>}

                {page > 2 && (
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)}>
                    {page - 1}
                  </Button>
                )}

                <Button variant="default" size="sm">
                  {page}
                </Button>

                {page < pagination.totalPages - 1 && (
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)}>
                    {page + 1}
                  </Button>
                )}

                {page < pagination.totalPages - 2 && <span>...</span>}

                {page < pagination.totalPages && (
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.totalPages)}>
                    {pagination.totalPages}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Bienvenido</CardTitle>
              <CardDescription>You are logged in as a regular user.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Puede ver las estadísticas del panel, pero las acciones administrativas están restringidas.</p>
            </CardContent>
          </Card>
        )}

        {/* Tabla de usuarios */}
        {!isLoading && users.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>User List</CardTitle>
              <CardDescription>List of users with domain {domainFilter}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>VPN Access</TableHead>
                    <TableHead>VPN Servers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>{user.userPrincipalName}</TableCell>
                      <TableCell>{user.hasVpnAccess ? "Yes" : "No"}</TableCell>
                      <TableCell>{user.vpnServers?.length || 0} servers</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleManageAccess(user)} className="gap-1">
                          <Settings className="h-4 w-4" />
                          Manage Access
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!isLoading && users.length === 0 && (
          <Card className="mt-6">
            <CardContent className="text-center py-6">
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        )}

        {isLoading && <div className="text-center py-8">Loading users...</div>}
      </div>

      {/* Dialog para gestionar acceso VPN */}
      {selectedUser && (
        <UserAccessManagement
          user={selectedUser}
          radiusServers={radiusServers}
          open={isAccessDialogOpen}
          onOpenChange={setIsAccessDialogOpen}
          onAccessUpdated={handleAccessUpdated}
        />
      )}

      {/* Dialog para mostrar usuarios con acceso VPN */}
      <UsersWithAccessDialog open={isUsersWithAccessDialogOpen} onOpenChange={setIsUsersWithAccessDialogOpen} />

      <Toaster />
    </>
  )
}

