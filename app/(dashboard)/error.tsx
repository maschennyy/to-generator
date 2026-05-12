"use client"

export default function Error({ error }: { error: Error }) {
  return (
    <div className="p-6 text-red-500">
      Terjadi kesalahan: {error.message}
    </div>
  )
}