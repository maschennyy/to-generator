import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { History } from "lucide-react"
import { LogAktivitasClient } from "@/components/log/log-aktivitas-client"

export default async function LogAktivitasPage() {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <History className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Log Aktivitas</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Audit trail seluruh aktivitas pengguna dalam sistem
        </p>
      </div>

      <LogAktivitasClient />
    </div>
  )
}
