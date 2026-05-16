"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  User,
  Mail,
  CreditCard,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ShieldCheck,
  Shield,
  CalendarDays,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface ProfileData {
  id: string
  username: string
  nama: string
  nip: string | null
  jabatan: string | null
  email: string | null
  role: string
  createdAt: string
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof User; className: string }> = {
  ADMIN: {
    label: "Administrator",
    icon: ShieldCheck,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  SPV: {
    label: "Supervisor",
    icon: Shield,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  USER: {
    label: "Pengguna",
    icon: User,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
}

export function ProfileClient() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [nama, setNama] = useState("")
  const [nip, setNip] = useState("")
  const [jabatan, setJabatan] = useState("")
  const [email, setEmail] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile")
        if (!res.ok) throw new Error("Gagal memuat profil")
        const data: ProfileData = await res.json()
        setProfile(data)
        setNama(data.nama || "")
        setNip(data.nip || "")
        setJabatan(data.jabatan || "")
        setEmail(data.email || "")
      } catch {
        toast.error("Gagal memuat data profil")
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  async function handleSaveProfile() {
    if (!nama.trim()) {
      toast.error("Nama tidak boleh kosong")
      return
    }

    setIsSavingProfile(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, nip, jabatan, email }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      setProfile((prev) => prev ? { ...prev, ...result } : result)
      toast.success("Profil berhasil disimpan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil")
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError("")

    if (!currentPassword) {
      setPasswordError("Password lama wajib diisi")
      return
    }
    if (!newPassword) {
      setPasswordError("Password baru wajib diisi")
      return
    }
    if (newPassword.length < 6) {
      setPasswordError("Password baru minimal 6 karakter")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password tidak cocok")
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError("Password baru tidak boleh sama dengan password lama")
      return
    }

    setIsSavingPassword(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password berhasil diubah")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah password"
      setPasswordError(msg)
      toast.error(msg)
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!profile) return null

  const roleConf = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.USER
  const RoleIcon = roleConf.icon

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* HEADER PROFIL - ELEGAN & KOMPAK */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-slate-700/30">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-4 ring-white dark:ring-slate-800">
          {(profile.nama || "U").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {profile.nama}
          </h2>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
            <span>@{profile.username}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleConf.className}`}>
              <RoleIcon className="h-3 w-3" />
              {roleConf.label}
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Terdaftar {new Date(profile.createdAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {/* KONTEN UTAMA: GRID 2 KOLOM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KOLOM KIRI - DATA DIRI (LEBAR) */}
        <Card className="lg:col-span-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-0 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-gray-200 dark:border-slate-700">
            <CardTitle className="text-xl font-semibold">Data Diri</CardTitle>
            <CardDescription>Perbarui informasi pribadi Anda</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="nama" className="font-medium">
                  Nama Lengkap <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="nama"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="pl-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Nama lengkap"
                    disabled={isSavingProfile}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nip" className="font-medium">NIP</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="nip"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    className="pl-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Nomor Induk Pegawai"
                    disabled={isSavingProfile}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jabatan" className="font-medium">Jabatan</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="jabatan"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="pl-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Jabatan / posisi"
                    disabled={isSavingProfile}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="alamat@email.com"
                    disabled={isSavingProfile}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 transition-all"
              >
                {isSavingProfile ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Simpan Perubahan</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KOLOM KANAN - INFO AKUN + GANTI PASSWORD */}
        <div className="space-y-6">
          {/* Info Akun */}
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-0 shadow-2xl rounded-2xl">
            <CardHeader className="pb-2 border-b border-gray-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold">Informasi Akun</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Username</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profile.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                  <p className="font-medium text-gray-900 dark:text-white">{roleConf.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Terdaftar</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(profile.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ganti Password */}
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-amber-200 dark:border-amber-900/50 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 border-b border-amber-200 dark:border-amber-900/50">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Ganti Password
              </CardTitle>
              <CardDescription>Kosongkan jika tidak ingin mengganti</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="font-medium">Password Lama</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password lama"
                    className="pr-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700"
                    disabled={isSavingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="font-medium">Password Baru</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="pr-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700"
                    disabled={isSavingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="font-medium">Konfirmasi Password Baru</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-700"
                  disabled={isSavingPassword}
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={isSavingPassword || (!currentPassword && !newPassword && !confirmPassword)}
                  className="bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-amber-900/50"
                >
                  {isSavingPassword ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                  ) : (
                    <><Lock className="mr-2 h-4 w-4" />Ganti Password</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}