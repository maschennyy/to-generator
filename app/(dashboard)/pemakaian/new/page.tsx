import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PemakaianForm } from "@/components/pemakaian/pemakaian-form"

export default async function NewPemakaianPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/pemakaian")
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pemakaian"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Input Pemakaian</h1>
          <p className="text-muted-foreground mt-1">
            Input data pemakaian kWh per pelanggan
          </p>
        </div>
      </div>

      {/* Form */}
      <PemakaianForm />
    </div>
  )
}