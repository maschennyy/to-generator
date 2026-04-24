import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PelangganForm } from "@/components/pelanggan/pelanggan-form"
import { prisma } from "@/lib/prisma"

interface EditPelangganPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPelangganPage({
  params,
}: EditPelangganPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Hanya admin yang bisa edit
  if (session.user.role !== "ADMIN") {
    redirect("/pelanggan")
  }

  const { id } = await params

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id },
  })

  if (!pelanggan) {
    notFound()
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
          <h1 className="text-3xl font-bold">Edit Pelanggan</h1>
          <p className="text-muted-foreground mt-1">
            Update data pelanggan: <strong>{pelanggan.nama}</strong>
          </p>
        </div>
      </div>

      {/* Form */}
      <PelangganForm
        mode="edit"
        initialData={{
          id: pelanggan.id,
          idPelanggan: pelanggan.idPelanggan,
          nama: pelanggan.nama,
          tarif: pelanggan.tarif,
          daya: pelanggan.daya,
          lokasi: pelanggan.lokasi,
        }}
      />
    </div>
  )
}