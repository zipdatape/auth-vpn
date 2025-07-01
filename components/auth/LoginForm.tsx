"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, Info, Lock, User } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const router = useRouter()
  const { toast } = useToast()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      })

      // Intentar obtener el mensaje de error del servidor
      let errorMessage = "Credenciales incorrectas. Por favor, verifica tu usuario y contraseña."

      try {
        const data = await response.json()
        // Si el servidor devuelve un mensaje de error específico, úsalo
        if (data.error) {
          errorMessage = data.error
        }
      } catch (e) {
        // Si no se puede parsear la respuesta como JSON, usar el mensaje predeterminado
        console.error("Error parsing response:", e)
      }

      if (!response.ok) {
        // Incrementar contador de intentos fallidos
        setAttemptCount((prev) => prev + 1)

        // Para errores 401, mostrar mensaje de credenciales incorrectas
        if (response.status === 401) {
          throw new Error(errorMessage)
        }
        // Para otros errores, mostrar un mensaje genérico
        throw new Error("Error al iniciar sesión. Por favor, intenta de nuevo más tarde.")
      }

      // Login exitoso
      toast({
        title: "Inicio de sesión exitoso",
        description: "Redirigiendo al dashboard...",
      })

      router.push("/")
      router.refresh()
    } catch (error) {
      // Mostrar el mensaje de error en un toast Y en el formulario
      const errorMsg = error instanceof Error ? error.message : "Error al iniciar sesión"

      // Mostrar toast
      toast({
        title: "Error de autenticación",
        description: errorMsg,
        variant: "destructive",
      })

      // Guardar error en el estado para mostrarlo en el formulario
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  // Determinar si mostrar mensaje adicional basado en intentos fallidos
  const showHelpMessage = attemptCount >= 2

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Ingrese sus credenciales para acceder al panel de control</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert
            variant="destructive"
            className="mb-4 animate-in fade-in slide-in-from-top-5 duration-300 border-l-4 border-l-destructive"
          >
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <AlertTitle className="text-sm font-medium">Error de autenticación</AlertTitle>
                <AlertDescription className="text-sm">{error}</AlertDescription>

                {showHelpMessage && (
                  <div className="mt-2 pt-2 border-t border-destructive/20 text-xs flex items-start text-destructive/80">
                    <Info className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                    <span>
                      Si has olvidado tus credenciales, contacta al administrador del sistema o utiliza la opción de
                      recuperación de contraseña.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Username"
                required
                disabled={isLoading}
                className={`pl-10 ${error ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                required
                disabled={isLoading}
                className={`pl-10 ${error ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

