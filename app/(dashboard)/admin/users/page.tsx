import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Users } from "lucide-react"
import { UserManagementClient } from "@/components/users/user-management-client"

export default async function UsersPage() {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Manajemen User</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Kelola akun pengguna aplikasi TO Generator
        </p>
      </div>

      <UserManagementClient currentUserId={session.user.id ?? ""} />
    </div>
  )
}
