# SIGTARI
### Sistem Informasi Generate Target Operasi Ritel

Aplikasi web untuk mendeteksi anomali pemakaian kWh pelanggan PLN secara otomatis dan menghasilkan daftar Target Operasi (TO) yang siap ditindaklanjuti petugas lapangan.

---

## Fitur Utama

- **Deteksi Anomali Otomatis** — 5 pola: Turun Drastis, Stagnan, Nol Pemakaian, Lonjakan, Pola Tidak Wajar (zigzag, meter statis, penurunan bertahap)
- **Background Processing** — Import 500.000+ pelanggan & generate TO berjalan di latar belakang, UI tidak terkunci
- **Tabel Pemakaian Pivot** — tampilan pemakaian per bulan dengan filter rentang waktu kustom
- **Laporan & Export** — Export PDF dan Excel untuk laporan TO, pemakaian, dan detail analisis
- **Manajemen User** — 3 role (Admin, SPV, User) dengan audit trail lengkap
- **Dark Mode** — tema gelap soft dengan toggle di topbar
- **Dashboard Analytics** — grafik tren TO bulanan dan distribusi tipe anomali

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Auth | NextAuth v5 (JWT) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Excel | xlsx (SheetJS) |
| PDF | jsPDF + autotable |
| Rate Limiting | Upstash Redis |
| Validasi | Zod + React Hook Form |

---

## Prasyarat

- Node.js 18+
- PostgreSQL 14+
- Akun Upstash (gratis) untuk rate limiting

---

## Instalasi

### 1. Clone repository

```bash
git clone https://github.com/maschennyy/to-generator.git
cd to-generator
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

```bash
cp .env.example .env
```

Isi semua variabel di file `.env` (lihat bagian [Environment Variables](#environment-variables)).

### 4. Setup database

```bash
# Jalankan migrasi
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 5. Seed data awal

```bash
npm run seed
```

Perintah ini membuat:
- 3 akun user (admin, spv, user)
- 5 pola temuan anomali
- 20 pelanggan dummy dengan berbagai pola pemakaian
- Data TO historis dan Target Operasi contoh

### 6. Jalankan aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Buat file `.env` di root project berdasarkan `.env.example`:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/to_app_db"

# NextAuth
AUTH_SECRET="your-secret-key-min-32-chars"

# Upstash Redis (rate limiting login)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

### Cara mendapatkan Upstash credentials

1. Daftar di [upstash.com](https://upstash.com) (gratis)
2. Buat database Redis baru
3. Salin **REST URL** dan **REST Token** dari dashboard

> **Catatan:** Jika tidak ingin menggunakan rate limiting, hapus import `loginRatelimit` di `auth.ts` dan `lib/ratelimit.ts`.

---

## Akun Default (setelah seed)

| Username | Password | Role | Akses |
|---|---|---|---|
| `admin` | `admin123` | Admin | Penuh — import, generate, kelola user |
| `spv` | `spv123` | Supervisor | Generate TO, update status |
| `user` | `user123` | User | Hanya lihat data |

> **Penting:** Ganti password setelah login pertama kali melalui halaman Profil.

---

## Struktur Halaman

```
/dashboard              Dashboard utama dengan statistik & grafik
/pelanggan              Daftar master data pelanggan
/pelanggan/[id]         Detail pelanggan + grafik pemakaian + riwayat TO
/pemakaian              Tabel pivot pemakaian kWh per bulan
/target-operasi         Daftar & manajemen Target Operasi
/laporan                Laporan periode dengan export PDF/Excel
/master-data/to-historis Data pelanggan yang pernah TO
/profile                Profil & ganti password user aktif
/admin/users            Manajemen akun pengguna (Admin only)
/admin/log              Audit trail aktivitas sistem (Admin only)
```

---

## Alur Kerja Utama

```
1. Import data pelanggan (Excel dari DIL)
       ↓
2. Import data pemakaian kWh bulanan
       ↓
3. Import TO Historis (opsional)
       ↓
4. Generate TO — sistem analisis 5 pola anomali otomatis
       ↓
5. Review daftar TO yang dihasilkan
       ↓
6. Update status TO (PENDING → DIPROSES → SELESAI)
       ↓
7. Export laporan Excel/PDF
```

---

## Database Schema

Model utama:

```
User          — akun pengguna sistem
Pelanggan     — master data pelanggan PLN
Pemakaian     — histori pemakaian kWh bulanan
TargetOperasi — hasil deteksi anomali
TOHistoris    — referensi pelanggan yang pernah TO
ImportJob     — queue background import & generate TO
LogAktivitas  — audit trail semua aksi user
Temuan        — pola anomali yang didefinisikan
```

---

## Background Job System

Import data besar dan Generate TO berjalan secara asinkron:

1. Request POST ke API → langsung return `202 Accepted` + `jobId`
2. Proses berjalan di server background
3. Frontend polling `/api/import-jobs` setiap 5 detik
4. Banner progress muncul di pojok kanan bawah semua halaman
5. Toast notification saat selesai

---

## Scripts

```bash
npm run dev      # Development server
npm run build    # Build production
npm run start    # Jalankan production build
npm run lint     # ESLint
npm run seed     # Seed database dengan data awal
```

---

## Catatan Pengembangan

- `proxy.ts` digunakan sebagai middleware (Next.js 16+, bukan `middleware.ts`)
- `TOHistoris` tidak memiliki foreign key ke `Pelanggan` — by design, lihat `docs/TO_HISTORIS_DESIGN.md`
- Prisma Client di-generate ke `lib/generated/prisma` (bukan default `node_modules`)
- Rate limiting hanya aktif di endpoint login (5 percobaan per 15 menit per IP)

---

## Lisensi

Dikembangkan untuk keperluan akademik — Capstone Project 2026.  
PT PLN (Persero) Unit Pelaksana Transmisi Tangerang.