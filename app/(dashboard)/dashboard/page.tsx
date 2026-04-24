import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Users, FileText, Activity, Shield, UserCog, User } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user

  // Fetch stats
  const [totalPelanggan, totalPemakaian, totalTO] = await Promise.all([
    prisma.pelanggan.count(),
    prisma.pemakaian.count(),
    prisma.targetOperasi.count(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Selamat datang, <span className="font-semibold">{user.nama}</span>! 👋
        </p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pelanggan
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalPelanggan}</div>
            <p className="text-xs text-muted-foreground">
              {totalPelanggan === 0 ? "Belum ada data" : "pelanggan terdaftar"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Target Operasi
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTO}</div>
            <p className="text-xs text-muted-foreground">
              {totalTO === 0 ? "Belum ada TO" : "total TO"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Data Pemakaian
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalPemakaian}</div>
            <p className="text-xs text-muted-foreground">
              {totalPemakaian === 0 ? "Belum ada data" : "record pemakaian"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role-based Panel */}
      {user.role === "ADMIN" && (
        <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Panel Administrator
            </CardTitle>
            <CardDescription>
              Akses penuh ke seluruh sistem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✅ Input & edit data pelanggan</li>
              <li>✅ Input data pemakaian bulanan</li>
              <li>✅ Generate Target Operasi otomatis</li>
              <li>✅ Export laporan Excel & PDF</li>
              <li>✅ Manajemen user & role</li>
              <li>✅ Lihat log aktivitas semua user</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {user.role === "SPV" && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Panel Supervisor
            </CardTitle>
            <CardDescription>Monitor & approve data</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✅ Monitoring data pelanggan & pemakaian</li>
              <li>✅ Review daftar Target Operasi</li>
              <li>✅ Approve/reject TO sebelum diproses</li>
              <li>✅ Export laporan</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {user.role === "USER" && (
        <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
              <User className="h-5 w-5" />
              Panel User
            </CardTitle>
            <CardDescription>View & download laporan</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✅ Lihat data pelanggan</li>
              <li>✅ Lihat Target Operasi yang sudah di-approve</li>
              <li>✅ Download laporan yang tersedia</li>
              <li>✅ Lihat grafik pemakaian pelanggan</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}