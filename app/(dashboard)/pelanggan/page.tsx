import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Upload, Users } from "lucide-react"
import { PelangganTable } from "@/components/pelanggan/pelanggan-table"
import { Button } from "@/components/ui/button"

export default async function PelangganPage() {
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
            <Users className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Pelanggan</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Kelola data pelanggan dan import massal dari file DIL
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/pelanggan/import">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import Pelanggan
              </Button>
            </Link>
            <Link href="/pelanggan/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Pelanggan
              </Button>
            </Link>
          </div>
        )}
      </div>

      <PelangganTable isAdmin={isAdmin} />
    </div>
  )
}