import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { ProfileClient } from "@/components/profile/profile-client"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-800">
      <ProfileClient />
    </div>
  )
}