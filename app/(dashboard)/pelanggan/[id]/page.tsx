import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { PelangganDetailClient } from "@/components/pelanggan/pelanggan-detail-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PelangganDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const isAdmin = session.user.role === "ADMIN"

  return <PelangganDetailClient id={id} isAdmin={isAdmin} />
}
