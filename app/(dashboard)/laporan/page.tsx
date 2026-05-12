import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { FileText } from "lucide-react"
import { LaporanClient } from "@/components/laporan/laporan-client"

export default async function LaporanPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="space-y-6" data-testid="laporan-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Laporan</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Ringkasan statistik, tren periode, dan laporan Target Operasi —
            siap diekspor ke PDF
          </p>
        </div>
      </div>

      <LaporanClient userName={session.user.nama || session.user.username} />
    </div>
  )
}
