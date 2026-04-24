import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LogOut, User, Shield, UserCog, Users, FileText, Activity } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user

  const roleIcon = {
    ADMIN: <Shield className="h-5 w-5 text-red-500" />,
    SPV: <UserCog className="h-5 w-5 text-blue-500" />,
    USER: <User className="h-5 w-5 text-green-500" />,
  }

  const roleColor = {
    ADMIN: "text-red-500",
    SPV: "text-blue-500",
    USER: "text-green-500",
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">TO Generator Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Selamat datang, <span className="font-semibold">{user.nama}</span>!
            </p>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button type="submit" variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>

        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Informasi User</CardTitle>
            <CardDescription>Detail akun yang sedang login</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              {roleIcon[user.role]}
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className={`font-semibold ${roleColor[user.role]}`}>
                  {user.role}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nama Lengkap</p>
              <p className="font-semibold">{user.nama}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-semibold">{user.username}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-xs truncate">{user.id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pelanggan
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Belum ada data</p>
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
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Belum ada TO</p>
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
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Belum ada data</p>
            </CardContent>
          </Card>
        </div>

        {/* Role-based Info Panel */}
        {user.role === "ADMIN" && (
          <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Panel Administrator
              </CardTitle>
              <CardDescription>
                Anda memiliki akses penuh ke seluruh sistem
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
              <CardDescription>
                Anda dapat memantau & menyetujui data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✅ Monitoring data pelanggan & pemakaian</li>
                <li>✅ Review daftar Target Operasi</li>
                <li>✅ Approve/reject TO sebelum diproses</li>
                <li>✅ Export laporan</li>
                <li>✅ Lihat statistik & analytics</li>
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
              <CardDescription>
                Akses untuk melihat data & laporan
              </CardDescription>
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
    </div>
  )
}