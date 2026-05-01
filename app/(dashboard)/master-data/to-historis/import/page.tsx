import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ImportToHistorisForm } from "@/components/master-data/import-to-historis-form"

export default async function ImportToHistorisPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/master-data/to-historis")
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link
          href="/master-data/to-historis"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import TO Historis</h1>
          <p className="text-muted-foreground mt-1">
            Upload daftar pelanggan yang pernah menjadi Target Operasi
          </p>
        </div>
      </div>

      <ImportToHistorisForm />
    </div>
  )
}