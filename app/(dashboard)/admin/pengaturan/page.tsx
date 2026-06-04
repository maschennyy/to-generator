import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Settings } from "lucide-react"
import { MlSettingsClient } from "@/components/admin/ml-settings-client"

export default async function AdminPengaturanPage() {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Pengaturan</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Pengaturan NALAR Risk Engine dan sistem.
        </p>
      </div>

      <MlSettingsClient />
    </div>
  )
}
