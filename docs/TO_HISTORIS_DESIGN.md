# Desain TOHistoris — Tidak Ada Relasi ke Pelanggan (By Design)

## Mengapa tidak ada foreign key?

`TOHistoris` menyimpan daftar IDPEL yang **pernah** masuk Target Operasi di
sistem lama (sebelum aplikasi ini dibuat). Data ini diimport dari file Excel
eksternal yang berasal dari sistem PLN legacy.

Masalahnya: tidak semua IDPEL di TOHistoris ada di tabel `pelanggan`. Data
historis bisa mencakup pelanggan yang sudah tidak aktif, sudah pindah, atau
belum diimport ke aplikasi ini. Kalau ada foreign key, import TOHistoris akan
gagal setiap kali ada IDPEL yang tidak cocok.

## Cara kerjanya sekarang

```
TOHistoris              Pelanggan
-----------             ----------
idPelanggan (String) ←→ idPelanggan (String, @unique)
                         isToHistory (Boolean)
```

Sinkronisasi dilakukan **satu arah** saat import pelanggan:

```typescript
// Di app/api/import-jobs/route.ts — processPelanggan()
const allTO = await prisma.tOHistoris.findMany({ select: { idPelanggan: true } })
const toSet = new Set(allTO.map((t) => t.idPelanggan))

// Saat upsert pelanggan:
isToHistory: toSet.has(cleanId)
```

Artinya: field `pelanggan.isToHistory` di-set `true` jika IDPEL pelanggan
tersebut ditemukan di tabel `TOHistoris`. Query untuk detector anomali dan
tampilan UI menggunakan `pelanggan.isToHistory`, bukan join langsung ke
`TOHistoris`.

## Yang TIDAK boleh dilakukan

❌ Jangan tambahkan relasi foreign key antara `TOHistoris` dan `Pelanggan`  
❌ Jangan ubah `TOHistoris.idPelanggan` menjadi `pelangganId` yang merujuk ke `Pelanggan.id`  
❌ Jangan hapus tabel `TOHistoris` dan pindahkan datanya ke field di `Pelanggan`

## Yang boleh dilakukan

✅ Tambah kolom baru di `TOHistoris` (misal: `namaPerugas`, `hasilTemuan`)  
✅ Query `TOHistoris` secara terpisah untuk fitur laporan historis  
✅ Join secara manual di query jika dibutuhkan:

```typescript
// Contoh join manual yang aman:
const result = await prisma.pelanggan.findMany({
  where: {
    idPelanggan: { in: await prisma.tOHistoris.findMany({ select: { idPelanggan: true } })
                            .then(rows => rows.map(r => r.idPelanggan)) }
  }
})
```