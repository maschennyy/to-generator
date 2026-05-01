import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { DashboardWarning } from "@/components/dashboard/dashboard-warning"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Selamat datang, {session.user.nama || session.user.username}!
        </p>
      </div>

      {/* Warning untuk data tidak lengkap */}
      <DashboardWarning />

      {/* Stats Cards */}
      <DashboardStats />
    </div>
  )
}