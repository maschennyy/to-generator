"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        username: formData.username,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Login Gagal", {
          description: "Username atau password salah",
        })
        setIsLoading(false)
        return
      }

      toast.success("Login Berhasil", {
        description: "Mengarahkan ke dashboard...",
      })

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Terjadi kesalahan", {
        description: "Silakan coba lagi",
      })
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Masuk</CardTitle>
        <CardDescription>
          Masuk dengan username dan password Anda
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="admin / user / spv"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sedang masuk...
              </>
            ) : (
              "Masuk"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
          <p className="font-semibold mb-2">Akun Testing:</p>
          <ul className="space-y-1 text-xs">
            <li>• Admin → admin / admin123</li>
            <li>• SPV → spv / spv123</li>
            <li>• User → user / user123</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}