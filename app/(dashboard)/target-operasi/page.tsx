import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Target } from "lucide-react"
import { TargetOperasiClient } from "@/components/target-operasi/target-operasi-client"

export default async function TargetOperasiPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const canGenerate =
    session.user.role === "ADMIN" || session.user.role === "SPV"
  const isAdmin = session.user.role === "ADMIN"

  return (
    <div className="space-y-6" data-testid="target-operasi-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Target Operasi</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Deteksi anomali pemakaian kWh secara otomatis berbasis pola TO
          </p>
        </div>
      </div>

      <TargetOperasiClient canGenerate={canGenerate} isAdmin={isAdmin} />
    </div>
  )
}
