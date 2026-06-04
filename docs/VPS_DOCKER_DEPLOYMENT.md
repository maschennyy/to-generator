# Checklist Deployment VPS Ubuntu

Panduan ini menjalankan aplikasi Next.js dan Python NALAR service di server Ubuntu yang sama menggunakan Docker Compose.

## 1. Siapkan server

1. Login ke VPS lewat SSH.
2. Install Docker dan plugin Compose:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

3. Logout SSH, lalu login lagi agar akses Docker aktif.
4. Cek instalasi:

```bash
docker --version
docker compose version
```

## 2. Ambil kode aplikasi

```bash
sudo mkdir -p /opt/to-generator
sudo chown -R $USER:$USER /opt/to-generator
git clone <URL_REPOSITORY_GITHUB_ANDA> /opt/to-generator
cd /opt/to-generator
```

Jika repo sudah ada:

```bash
cd /opt/to-generator
git pull
```

## 3. Buat file environment

```bash
cp env.example .env
nano .env
```

Isi minimal:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
AUTH_SECRET="isi-dengan-hasil-openssl-rand-base64-32"
NEXTAUTH_URL="https://domain-anda.com"
NALAR_SERVICE_URL="http://ml-service:8000"
NALAR_SERVICE_TOKEN="isi-dengan-token-panjang-dan-acak"
# Alias lama masih didukung:
ML_SERVICE_URL="http://ml-service:8000"
ML_SERVICE_TOKEN="isi-dengan-token-panjang-dan-acak"
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Generate `NALAR_SERVICE_TOKEN`:

```bash
openssl rand -hex 32
```

Catatan: untuk Docker Compose, `NALAR_SERVICE_URL` harus `http://ml-service:8000` agar Next.js berbicara ke NALAR service lewat jaringan internal Docker. `NALAR_SERVICE_TOKEN` dipakai sebagai token internal antara Next.js dan NALAR service.

## 4. Jalankan database migration

```bash
docker compose run --rm migrate
```

Jika perlu membuat admin awal, jalankan seed atau script admin yang sudah ada di project.

## 5. Build dan start aplikasi

```bash
docker compose up -d --build
```

Cek status:

```bash
docker compose ps
docker compose logs -f next-app
docker compose logs -f ml-service
```

Aplikasi Next.js tersedia di:

```text
http://IP_SERVER:3000
```

NALAR service tidak diexpose ke internet. Ia hanya bisa diakses oleh container Next.js lewat:

```text
http://ml-service:8000
```

## 6. Latih model pertama kali

```bash
docker compose exec -T ml-service sh -c 'curl -fsS -X POST -H "X-ML-Service-Token: ${NALAR_SERVICE_TOKEN:-$ML_SERVICE_TOKEN}" http://127.0.0.1:8000/train'
```

Training berjalan di background. Pantau log:

```bash
docker compose logs -f ml-service
```

Model tersimpan di volume Docker `ml_models`, jadi tidak hilang saat container restart.

## 7. Pasang cron training mingguan

Pastikan script bisa dieksekusi:

```bash
chmod +x /opt/to-generator/update-ml.sh
chmod +x /opt/to-generator/scripts/train-ml-weekly.sh
```

Buka crontab:

```bash
crontab -e
```

Tambahkan baris ini:

```cron
0 2 * * 0 APP_DIR=/opt/to-generator /opt/to-generator/scripts/train-ml-weekly.sh >> /opt/to-generator/ml-training.log 2>&1
```

Artinya: setiap Minggu pukul 02.00 waktu server, model dilatih ulang dengan data terbaru.

## 8. Update NALAR service setelah ada perubahan kode

```bash
cd /opt/to-generator
./update-ml.sh
```

Script ini akan:

1. Menarik kode terbaru dari Git.
2. Build ulang image NALAR service.
3. Restart NALAR service.
4. Menunggu service sehat.
5. Trigger training ulang model.

## 9. Jika Next.js tetap di Vercel

Konfigurasi Docker Compose ini paling cocok jika Next.js dan NALAR service sama-sama berjalan di VPS.

Jika Next.js tetap di Vercel, maka Vercel tidak bisa mengakses `http://ml-service:8000` karena alamat itu hanya ada di jaringan internal Docker. Anda perlu salah satu opsi berikut:

1. Deploy NALAR service secara publik dengan proteksi token/API key.
2. Pakai VPN/private network antara Vercel dan VPS.
3. Jalankan Next.js juga di VPS seperti compose ini.

Untuk fase awal, opsi paling sederhana adalah menjalankan Next.js dan NALAR service bersama di VPS.
