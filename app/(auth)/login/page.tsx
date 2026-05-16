import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid background sangat subtle */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Glow netral sangat redup (tidak biru) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neutral-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[350px] h-[250px] bg-neutral-700/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Card utama */}
      <div className="relative w-full max-w-md">
        {/* Header & Form dalam satu card */}
        <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          {/* Logo sederhana */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-neutral-800 border border-neutral-700">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path
                  d="M16 4L28 10V22L16 28L4 22V10L16 4Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="16" r="3" fill="white" />
              </svg>
            </div>
          </div>

          {/* Nama sistem */}
          <h1 className="text-2xl font-bold tracking-tight text-white text-center">
            NALAR
          </h1>
          <p className="text-xs font-medium tracking-[0.2em] text-neutral-400 uppercase text-center mt-1">
            Deteksi Cerdas, Respons Tepat
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-xs text-neutral-600 font-medium">PT PLN (Persero)</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Form */}
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-600 mt-6">
          PT PLN (Persero) &nbsp;·&nbsp; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}