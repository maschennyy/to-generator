import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Upload, AlertTriangle } from "lucide-react"
import { ToHistorisTable } from "@/components/master-data/to-historis-table"

export default async function MasterToHistorisPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const isAdmin = session.user.role === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <h1 className="text-3xl font-bold">TO Historis</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Data pelanggan yang pernah menjadi Target Operasi
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/master-data/to-historis/import"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import TO Historis
          </Link>
        )}
      </div>

      <ToHistorisTable isAdmin={isAdmin} />
    </div>
  )
}