import { redirect } from "next/navigation"
import { Brain } from "lucide-react"

import { auth } from "@/auth"
import { MlDashboardClient } from "@/components/admin/ml-dashboard-client"

export default async function MlDashboardPage() {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">NALAR Dashboard</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Monitoring feedback loop, performa model NALAR, dan fitur yang memengaruhi skor risiko.
        </p>
      </div>

      <MlDashboardClient />
    </div>
  )
}
