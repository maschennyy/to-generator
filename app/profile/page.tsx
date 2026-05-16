import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { ProfileClient } from "@/components/profile/profile-client"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <ProfileClient />
}