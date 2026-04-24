import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PelangganForm } from "@/components/pelanggan/pelanggan-form"

export default async function NewPelangganPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Hanya admin yang bisa akses
  if (session.user.role !== "ADMIN") {
    redirect("/pelanggan")
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pelanggan"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Tambah Pelanggan</h1>
          <p className="text-muted-foreground mt-1">
            Tambah data pelanggan listrik baru
          </p>
        </div>
      </div>

      {/* Form */}
      <PelangganForm mode="create" />
    </div>
  )
}