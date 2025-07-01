import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession } from "./lib/auth"

export async function middleware(request: NextRequest) {
  const session = await getSession()
  const isLoginPage = request.nextUrl.pathname === "/login"

  // Si no está logueado y trata de acceder a una ruta protegida
  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Si está logueado y trata de acceder a la página de login
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Rutas solo para admin
  if (
    session?.role !== "admin" &&
    (request.nextUrl.pathname === "/user-management" || request.nextUrl.pathname.startsWith("/api/system-users"))
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login", "/user-management", "/api/system-users/:path*", "/radius-management", "/event-viewer", "/vpn-portals"],
}

