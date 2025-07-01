"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface SyncEvent {
  id: number
  timestamp: string
  users_added: number
  users_updated: number
  users_deleted: number
  total_users: number
}

export function EventViewer() {
  const [events, setEvents] = useState<SyncEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchEvents = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/sync-events")
      if (!response.ok) {
        throw new Error("Failed to fetch events")
      }
      const data = await response.json()
      setEvents(data.events)
    } catch (error) {
      console.error("Error fetching events:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los eventos de sincronización",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Visor de Eventos de Sincronización</CardTitle>
            <Button onClick={fetchEvents} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
          <CardDescription>Historial de las últimas sincronizaciones con Azure AD</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Usuarios Añadidos</TableHead>
                <TableHead>Usuarios Actualizados</TableHead>
                <TableHead>Usuarios Eliminados</TableHead>
                <TableHead>Total de Usuarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{event.users_added}</TableCell>
                  <TableCell>{event.users_updated}</TableCell>
                  <TableCell>{event.users_deleted}</TableCell>
                  <TableCell>{event.total_users}</TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    No hay eventos de sincronización registrados
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

