import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar userRole={session.user.role} />
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}