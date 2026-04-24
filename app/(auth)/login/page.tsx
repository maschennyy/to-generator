import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            TO Generator
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Sistem Target Operasi Pelanggan
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}