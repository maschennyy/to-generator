import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { PemakaianTable } from "@/components/pemakaian/pemakaian-table"

export default async function PemakaianPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const isAdmin = session.user.role === "ADMIN"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Data Pemakaian</h1>
          <p className="text-muted-foreground mt-1">
            Rolling 12 bulan terakhir (tidak termasuk bulan berjalan)
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Link
              href="/pemakaian/import"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </Link>
            <Link
              href="/pemakaian/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Input Manual
            </Link>
          </div>
        )}
      </div>

      {/* Table */}
      <PemakaianTable isAdmin={isAdmin} />
    </div>
  )
}