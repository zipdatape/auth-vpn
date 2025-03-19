"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Home, Users, Shield, Calendar, LogOut, FileText } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export const Sidebar = () => {
  const router = useRouter()
  const { toast } = useToast()
  const { data } = useSWR<{ user: { role: string } }>("/api/auth/me", fetcher)

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to logout")
      }

      router.push("/login")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      })
    }
  }

  const isAdmin = data?.user?.role === "admin"

  return (
    <aside className="bg-gray-800 text-white w-64 p-6">
      <h2 className="text-xl font-bold mb-4">VPN Management</h2>
      <nav className="space-y-2">
        <Link href="/" className="flex items-center hover:bg-gray-700 p-2 rounded">
          <Home className="mr-2 h-5 w-5" />
          Dashboard
        </Link>

        {isAdmin && (
          <>
            <Link href="/user-management" className="flex items-center hover:bg-gray-700 p-2 rounded">
              <Users className="mr-2 h-5 w-5" />
              User Management
            </Link>
            <Link href="/radius-management" className="flex items-center hover:bg-gray-700 p-2 rounded">
              <Shield className="mr-2 h-5 w-5" />
              RADIUS Server
            </Link>
            <Link href="/event-viewer" className="flex items-center hover:bg-gray-700 p-2 rounded">
              <Calendar className="mr-2 h-5 w-5" />
              Visor de Eventos
            </Link>
            <Link href="/audit-logs" className="flex items-center hover:bg-gray-700 p-2 rounded">
              <FileText className="mr-2 h-5 w-5" />
              Audit Logs
            </Link>
            <Link href="/vpn-portals" className="flex items-center hover:bg-gray-700 p-2 rounded">
              <FileText className="mr-2 h-5 w-5" />
              Portales VPN
            </Link>

          </>
        )}

        <button onClick={handleLogout} className="flex items-center hover:bg-gray-700 p-2 rounded w-full">
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </button>
      </nav>
    </aside>
  )
}

