import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { ImportProgressBanner } from "@/components/import-progress-banner"
import { prisma } from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const freshUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nama: true, username: true },
  })

  const displayName =
    freshUser?.nama || freshUser?.username || session.user.username || "User"

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar userRole={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar userName={displayName} userRole={session.user.role} />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
      <ImportProgressBanner />
    </div>
  )
}