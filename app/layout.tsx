import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { initializeSync } from "@/lib/syncOnStartup"
import { getSession } from "@/lib/auth"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "VPN Management Dashboard",
  description: "Manage your VPN portals and users",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // Iniciar la sincronización solo si hay una sesión activa
  if (session) {
    initializeSync()
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        {session ? (
          // Layout autenticado con sidebar
          <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </div>
        ) : (
          // Layout para páginas públicas (login)
          <div className="min-h-screen bg-gray-100">{children}</div>
        )}
      </body>
    </html>
  )
}

