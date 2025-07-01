// "use client"

// import { useState, useEffect, useMemo, useCallback } from "react"
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { Users, ChevronLeft, ChevronRight, Search } from "lucide-react"
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// interface Group {
//   id: string
//   name: string
// }

// interface GroupDetailsDialogProps {
//   group: Group
//   portalId: string
//   onAccessRevoked: () => void
// }

// export function GroupDetailsDialog({ group, portalId, onAccessRevoked }: GroupDetailsDialogProps) {
//   const [open, setOpen] = useState(false)
//   const [loading, setLoading] = useState<string | null>(null)
//   const [members, setMembers] = useState<string[]>([])
//   const [error, setError] = useState<string | null>(null)
//   const [currentPage, setCurrentPage] = useState(1)
//   const [searchTerm, setSearchTerm] = useState("")
//   const itemsPerPage = 5

//   useEffect(() => {
//     if (open) {
//       fetchGroupMembers()
//     }
//   }, [open])

//   const fetchGroupMembers = async () => {
//     setError(null)
//     setLoading("fetching")
//     try {
//       const response = await fetch("/api/fortigate-ssh", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ groupName: group.name }),
//       })

//       if (!response.ok) {
//         throw new Error("Failed to fetch group members")
//       }

//       const data = await response.json()
//       console.log("SSH response:", data)
//       if (data.error) {
//         setError(`Error: ${data.error}`)
//         setMembers([])
//       } else {
//         setMembers(data.members || [])
//       }
//     } catch (error) {
//       console.error("Error fetching group members:", error)
//       setError("Failed to fetch group members. Please try again.")
//       setMembers([])
//     } finally {
//       setLoading(null)
//     }
//   }

//   const handleRevokeAccess = async (username: string) => {
//     setLoading(username)
//     try {
//       const response = await fetch(`/api/vpn-portals/${portalId}`, {
//         method: "PUT",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           groups: [
//             {
//               ...group,
//               members: members.filter((member) => member !== username),
//             },
//           ],
//         }),
//       })

//       if (!response.ok) {
//         throw new Error("Failed to revoke access")
//       }

//       setMembers(members.filter((member) => member !== username))
//       onAccessRevoked()
//     } catch (error) {
//       console.error("Error revoking access:", error)
//       setError("Failed to revoke access. Please try again.")
//     } finally {
//       setLoading(null)
//     }
//   }

//   const filteredMembers = useMemo(() => {
//     return members.filter((member) => member.toLowerCase().includes(searchTerm.toLowerCase()))
//   }, [members, searchTerm])

//   const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)

//   const handleSearch = useCallback((value: string) => {
//     setSearchTerm(value)
//     setCurrentPage(1) // Reset to first page on search
//   }, [])

//   const currentMembers = useMemo(() => {
//     const startIndex = (currentPage - 1) * itemsPerPage
//     const endIndex = startIndex + itemsPerPage
//     return filteredMembers.slice(startIndex, endIndex)
//   }, [filteredMembers, currentPage]) // Removed itemsPerPage from dependencies

//   return (
//     <Dialog open={open} onOpenChange={setOpen}>
//       <DialogTrigger asChild>
//         <Button variant="outline" size="sm">
//           <Users className="w-4 h-4 mr-2" />
//           Ver Miembros
//         </Button>
//       </DialogTrigger>
//       <DialogContent className="max-w-2xl">
//         <DialogHeader>
//           <DialogTitle>Detalles del Grupo: {group.name}</DialogTitle>
//           <DialogDescription>Miembros del grupo y gestión de accesos</DialogDescription>
//         </DialogHeader>
//         <div className="mt-4">
//           {error && (
//             <Alert variant="destructive" className="mb-4">
//               <AlertTitle>Error</AlertTitle>
//               <AlertDescription>{error}</AlertDescription>
//             </Alert>
//           )}
//           {loading === "fetching" ? (
//             <div className="text-center">Cargando miembros del grupo...</div>
//           ) : (
//             <>
//               <div className="mb-4">
//                 <div className="relative">
//                   <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
//                   <Input
//                     type="text"
//                     placeholder="Buscar usuario..."
//                     value={searchTerm}
//                     onChange={(e) => handleSearch(e.target.value)}
//                     className="pl-8"
//                   />
//                 </div>
//               </div>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Usuario</TableHead>
//                     <TableHead className="text-right">Acciones</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {currentMembers.map((member) => (
//                     <TableRow key={member}>
//                       <TableCell>{member}</TableCell>
//                       <TableCell className="text-right">
//                         <Button
//                           variant="destructive"
//                           size="sm"
//                           onClick={() => handleRevokeAccess(member)}
//                           disabled={loading === member}
//                         >
//                           {loading === member ? "Revocando..." : "Revocar Acceso"}
//                         </Button>
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                   {currentMembers.length === 0 && (
//                     <TableRow>
//                       <TableCell colSpan={2} className="text-center text-muted-foreground">
//                         {searchTerm ? "No se encontraron usuarios" : "No hay usuarios en este grupo"}
//                       </TableCell>
//                     </TableRow>
//                   )}
//                 </TableBody>
//               </Table>
//               {filteredMembers.length > itemsPerPage && (
//                 <div className="flex items-center justify-between mt-4">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
//                     disabled={currentPage === 1}
//                   >
//                     <ChevronLeft className="w-4 h-4 mr-2" />
//                     Anterior
//                   </Button>
//                   <span>
//                     Página {currentPage} de {totalPages}
//                   </span>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
//                     disabled={currentPage === totalPages}
//                   >
//                     Siguiente
//                     <ChevronRight className="w-4 h-4 ml-2" />
//                   </Button>
//                 </div>
//               )}
//             </>
//           )}
//         </div>
//       </DialogContent>
//     </Dialog>
//   )
// }

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

interface Group {
  id: string
  name: string
}

interface GroupDetailsDialogProps {
  group: Group
  portalId: string
  onAccessRevoked: () => void
}

export function GroupDetailsDialog({ group, portalId, onAccessRevoked }: GroupDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [members, setMembers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const itemsPerPage = 5
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchGroupMembers()
    }
  }, [open])

  const fetchGroupMembers = async () => {
    setError(null)
    setLoading("fetching")
    try {
      const response = await fetch("/api/fortigate-ssh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groupName: group.name }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch group members")
      }

      const data = await response.json()
      console.log("SSH response:", data)
      if (data.error) {
        setError(`Error: ${data.error}`)
        setMembers([])
      } else {
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching group members:", error)
      setError("Failed to fetch group members. Please try again.")
      setMembers([])
    } finally {
      setLoading(null)
    }
  }

  const handleRevokeAccess = async (username: string) => {
    setLoading(username)
    try {
      const response = await fetch("/api/revoke-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupName: group.name,
          username: username,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to revoke access")
      }

      const result = await response.json()
      setMembers(members.filter((member) => member !== username))
      onAccessRevoked()
      toast({
        title: "Success",
        description: result.message,
      })
    } catch (error) {
      console.error("Error revoking access:", error)
      setError("Failed to revoke access. Please try again.")
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke access",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  const filteredMembers = useMemo(() => {
    return members.filter((member) => member.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [members, searchTerm])

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page on search
  }, [])

  const currentMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredMembers.slice(startIndex, endIndex)
  }, [filteredMembers, currentPage])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="w-4 h-4 mr-2" />
          Ver Miembros
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles del Grupo: {group.name}</DialogTitle>
          <DialogDescription>Miembros del grupo y gestión de accesos</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {loading === "fetching" ? (
            <div className="text-center">Cargando miembros del grupo...</div>
          ) : (
            <>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar usuario..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMembers.map((member) => (
                    <TableRow key={member}>
                      <TableCell>{member}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeAccess(member)}
                          disabled={loading === member}
                        >
                          {loading === member ? "Revocando..." : "Revocar Acceso"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        {searchTerm ? "No se encontraron usuarios" : "No hay usuarios en este grupo"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredMembers.length > itemsPerPage && (
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
                  <span>
                    Página {currentPage} de {totalPages}
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

