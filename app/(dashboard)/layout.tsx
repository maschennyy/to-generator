import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { ImportProgressBanner } from "@/components/import-progress-banner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar userRole={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userName={session.user.nama || session.user.username || "User"}
          userRole={session.user.role}
        />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
      {/* Banner progress import — muncul di pojok kanan bawah di semua halaman */}
      <ImportProgressBanner />
    </div>
  )
}
