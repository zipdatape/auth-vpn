"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { UserX, UserCheck } from "lucide-react"
import useSWR from "swr"

interface User {
  id: number
  username: string
  role: string
  is_blocked: boolean
  blocked_at: string | null
  blocked_by: string | null
  blocked_reason: string | null
  created_at: string
  last_login: string | null
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function UserManagement() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [userToBlock, setUserToBlock] = useState<User | null>(null)
  const [blockReason, setBlockReason] = useState("")
  const [isBlocking, setIsBlocking] = useState(false)
  const { toast } = useToast()

  const { data, error, mutate } = useSWR<{ users: User[] }>("/api/system-users", fetcher)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch("/api/system-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
          role: formData.get("role"),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user")
      }

      toast({
        title: "Success",
        description: "User created successfully",
      })

      setIsOpen(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteUser(id: number) {
    try {
      const response = await fetch(`/api/system-users/${id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user")
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      })

      mutate()
    } catch (error) {
      console.error("Delete user error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      })
    }
  }

  const handleBlockUser = (user: User) => {
    setUserToBlock(user)
    setBlockReason("")
    setIsBlockDialogOpen(true)
  }

  const handleConfirmBlock = async () => {
    if (!userToBlock) return

    setIsBlocking(true)
    try {
      const action = userToBlock.is_blocked ? "unblock" : "block"
      const response = await fetch("/api/system-users/block", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userToBlock.id,
          action,
          reason: action === "block" ? blockReason : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} user`)
      }

      toast({
        title: "Success",
        description: data.message,
      })

      // Refresh users data
      await mutate()
      
      // Close dialog
      setIsBlockDialogOpen(false)
      setUserToBlock(null)
      setBlockReason("")
    } catch (error) {
      console.error("Error blocking/unblocking user:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user status",
        variant: "destructive",
      })
    } finally {
      setIsBlocking(false)
    }
  }

  if (error) {
    return <div>Error loading users</div>
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>User Management</CardTitle>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>Create User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                  <Input name="username" placeholder="Username" required />
                  <Input name="password" type="password" placeholder="Password" required />
                  <Select name="role" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create User"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>Manage system users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.map((user) => (
                <TableRow key={user.id} className={user.is_blocked ? "opacity-60 bg-red-50" : ""}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.is_blocked ? (
                        <>
                          <UserX className="h-4 w-4 text-red-500" />
                          <span className="text-red-600 font-medium">Blocked</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 font-medium">Active</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                  <TableCell>{user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant={user.is_blocked ? "default" : "destructive"}
                        size="sm"
                        onClick={() => handleBlockUser(user)}
                        disabled={user.username === "admin"}
                      >
                        {user.is_blocked ? (
                          <>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Unblock
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 mr-1" />
                            Block
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteUser(user.id)}
                        disabled={user.username === "admin"}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para bloquear/desbloquear usuario */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userToBlock?.is_blocked ? "Unblock User" : "Block User"}
            </DialogTitle>
            <DialogDescription>
              {userToBlock?.is_blocked 
                ? `Are you sure you want to unblock ${userToBlock?.username}? This will allow them to log in again.`
                : `Are you sure you want to block ${userToBlock?.username}? This will prevent them from logging in.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!userToBlock?.is_blocked && (
              <div className="space-y-2">
                <Label htmlFor="blockReason">Reason for blocking (optional)</Label>
                <Textarea
                  id="blockReason"
                  placeholder="Enter the reason for blocking this user..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {userToBlock?.is_blocked && userToBlock.blocked_reason && (
              <div className="space-y-2">
                <Label>Previous block reason:</Label>
                <div className="p-3 bg-gray-100 rounded-md text-sm">
                  <p><strong>Reason:</strong> {userToBlock.blocked_reason}</p>
                  <p><strong>Blocked by:</strong> {userToBlock.blocked_by}</p>
                  <p><strong>Blocked at:</strong> {userToBlock.blocked_at ? new Date(userToBlock.blocked_at).toLocaleString() : "Unknown"}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsBlockDialogOpen(false)}
              disabled={isBlocking}
            >
              Cancel
            </Button>
            <Button
              variant={userToBlock?.is_blocked ? "default" : "destructive"}
              onClick={handleConfirmBlock}
              disabled={isBlocking}
            >
              {isBlocking 
                ? (userToBlock?.is_blocked ? "Unblocking..." : "Blocking...") 
                : (userToBlock?.is_blocked ? "Unblock User" : "Block User")
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

