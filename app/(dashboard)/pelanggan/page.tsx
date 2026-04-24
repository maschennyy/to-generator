import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PelangganTable } from "@/components/pelanggan/pelanggan-table"

export default async function PelangganPage() {
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
          <h1 className="text-3xl font-bold">Data Pelanggan</h1>
          <p className="text-muted-foreground mt-1">
            Kelola data pelanggan listrik
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/pelanggan/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Pelanggan
          </Link>
        )}
      </div>

      {/* Table */}
      <PelangganTable isAdmin={isAdmin} />
    </div>
  )
}