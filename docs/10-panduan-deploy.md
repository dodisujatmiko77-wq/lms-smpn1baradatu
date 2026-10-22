# Panduan Deploy (Produksi) — LMS Digital UPT SMP Negeri 1 Baradatu

Panduan ini untuk memindahkan LMS dari komputer ke internet agar bisa dipakai seluruh sekolah.
Ikuti langkah-langkah ini secara berurutan. Perkiraan waktu: ±1 jam.

---

## 0. Ringkasan arsitektur

```
HP / laptop siswa & guru
        │  HTTPS
        ▼
Netlify (aplikasi web: HTML/JS, gratis)  ──►  Supabase (database, login, file, realtime)
```

- **Netlify** hanya menyimpan tampilan aplikasi. Semua data ada di **Supabase**.
- Tidak ada server lain yang perlu dirawat.

---

## 1. Pilih paket Supabase

| Kebutuhan | Paket |
|---|---|
| Uji coba 1–2 kelas | **Free**: database 500 MB, storage 1 GB. Proyek **dijeda otomatis** bila 7 hari tidak dipakai (misalnya saat libur). |
| Dipakai seluruh sekolah (±900 siswa) | **Pro** (±US$25/bulan): database 8 GB, storage 100 GB, tanpa jeda otomatis, ada **backup harian**. |

> Rekomendasi: mulai dengan Free untuk uji coba. Naikkan ke **Pro** sebelum dipakai serentak oleh semua kelas, terutama sebelum ujian online (PTS/PAS).

---

## 2. Siapkan proyek Supabase produksi

Jika proyek yang Anda pakai selama uji coba akan dijadikan produksi, lewati 2.1 dan 2.2 (migrasi yang sudah dijalankan tidak perlu diulang).

### 2.1 Buat proyek
1. <https://supabase.com/dashboard> → **New project**.
2. Region: **Southeast Asia (Singapore)**.
3. Simpan **database password** di tempat aman.

### 2.2 Jalankan migrasi (SQL Editor)
Jalankan berkas di `supabase/migrations/` **berurutan**, satu per satu, dengan cara: buka berkas → salin seluruh isi → **SQL Editor** → **Run**.

| No | Berkas | Isi |
|---|---|---|
| 1 | `0001_extensions_enums_helpers.sql` | Dasar |
| 2 | `0002_profiles_roles_settings.sql` | Akun, role, pengaturan sekolah, audit log |
| 3 | `0003_academic_master.sql` | Tahun pelajaran, kelas, mapel, guru, siswa |
| 4 | `0004_master_rls_rpc.sql` | Hak akses data master |
| 5 | `0005_classroom_lessons.sql` | Ruang kelas & materi |
| 6 | `0006_storage.sql` | Penyimpanan berkas materi |
| 7 | `0007_assignments.sql` | Tugas & nilai |
| 8 | `0008_quizzes.sql` | Kuis & ujian online |
| 9 | `0009_interactions.sql` | Notifikasi, pengumuman, forum, kalender |
| 10 | `0010_achievements.sql` | Badge |
| 11 | `0011_reports.sql` | Monitoring & laporan |
| 12 | `0012_hardening_performance.sql` | Pengerasan keamanan, indeks, pembersihan berkas |

Setiap berkas harus selesai dengan pesan **Success**. Jika ada error, berhenti dan catat pesannya.

### 2.3 Pengaturan Auth (Authentication → Sign In / Providers)
- **Email**: aktif. **Confirm email**: matikan (akun dibuat admin).
- **Allow new users to sign up**: **MATIKAN**. Akun hanya dibuat admin lewat aplikasi.

### 2.4 Realtime
**Database → Publications → `supabase_realtime`**: pastikan tabel **`notifications`** tercentang.

### 2.5 Edge Function `admin-users`
Ikuti `docs/02-tahap1-fondasi.md` bagian 2.4: buat function bernama **`admin-users`** dan tempel isi `supabase/functions/admin-users/index.ts`.

Isi secrets berikut:

| Secret | Nilai |
|---|---|
| `LOGIN_EMAIL_DOMAIN` | `lms.smpn1baradatu.sch.id` |
| `ALLOWED_ORIGINS` | alamat aplikasi, misalnya `https://lms-smpn1baradatu.netlify.app` (bisa lebih dari satu, pisahkan dengan koma) |

Pastikan **Verify JWT** dalam keadaan **OFF** untuk function ini (function memeriksa admin sendiri).

### 2.6 Admin pertama
Ikuti `docs/02-tahap1-fondasi.md` bagian 2.5 (`supabase/scripts/bootstrap_admin.sql`).

---

## 3. Deploy aplikasi ke Netlify

1. Daftar/masuk di <https://app.netlify.com> (bisa memakai akun GitHub).
2. **Add new site → Import an existing project → GitHub** → pilih repositori `lms-smpn1baradatu`.
3. Branch: **main**. Build command dan folder publish otomatis terbaca dari `netlify.toml` (`npm run build` → `dist`).
4. **Site configuration → Environment variables**, isi:

   | Nama | Nilai (Supabase → Project Settings → API) |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL, misalnya `https://abcd.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | kunci **anon / publishable** (BUKAN service_role) |
   | `VITE_LOGIN_EMAIL_DOMAIN` | `lms.smpn1baradatu.sch.id` |

5. **Deploy site**. Tunggu ±2 menit sampai statusnya **Published**.
6. (Opsional) **Domain management → Options → Edit site name** → ganti, misalnya `lms-smpn1baradatu` → alamat menjadi `https://lms-smpn1baradatu.netlify.app`.
7. Kembali ke Supabase:
   - **Authentication → URL Configuration → Site URL**: isi alamat Netlify.
   - Edge Function secret **`ALLOWED_ORIGINS`**: tambahkan alamat Netlify.

> Setiap kali Anda menggabungkan perubahan ke `main` di GitHub, Netlify otomatis membangun ulang aplikasi.
> Aplikasi yang sudah terpasang di HP siswa ikut diperbarui saat aplikasi dibuka berikutnya.

### Keamanan yang sudah aktif otomatis (dari `netlify.toml`)
- **HTTPS** wajib (HSTS).
- **Content-Security-Policy**: hanya skrip dari aplikasi sendiri yang boleh berjalan. Koneksi hanya ke Supabase, video YouTube, dan Google Fonts.
- Aplikasi tidak bisa disematkan di situs lain (anti-clickjacking).

> Jika nanti memakai **domain sendiri** untuk Supabase (custom domain), tambahkan domain itu ke `Content-Security-Policy` di `netlify.toml`.

### Alternatif: Vercel
`vercel.json` sudah tersedia dengan pengaturan yang sama. Langkahnya serupa: Import Git Repository, lalu isi environment variables yang sama.

---

## 4. Uji setelah deploy (15 menit)

- [ ] Buka alamat aplikasi di HP → halaman login tampil dengan ilustrasi & logo sekolah.
- [ ] Login sebagai admin → buat satu akun guru & satu akun siswa uji.
- [ ] Login sebagai siswa di HP lain → wajib ganti password → beranda tampil.
- [ ] Guru membuat pengumuman → notifikasi muncul di HP siswa **tanpa memuat ulang** (realtime).
- [ ] Di HP Android (Chrome): menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi** → ikon "LMS Baradatu" muncul.
- [ ] Unduh satu laporan Excel & PDF dari menu Laporan.

---

## 5. Perawatan rutin

| Kapan | Tindakan |
|---|---|
| Awal tahun pelajaran | Buat tahun pelajaran baru → tempatkan siswa ke kelas baru → penugasan mengajar → wali kelas → jadwal. |
| Awal semester | **Tahun Pelajaran → Aktifkan semester** yang baru. |
| Akhir semester | Unduh rekap nilai (Excel/PDF) dari **Laporan**. Setelah itu, bila kuota penyimpanan menipis: **Manajemen File → Bersihkan berkas jawaban semester lalu**. |
| Setiap bulan | Cek **Manajemen File** (kuota) dan **Audit Log**. |
| Paket Free | Buka aplikasi minimal sekali seminggu saat libur agar proyek tidak dijeda. |
| Backup | Paket Pro: backup harian otomatis. Paket Free: **Database → Backups** tidak tersedia, jadi unduh rekap nilai secara berkala. |

---

## 6. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Halaman "Konfigurasi belum lengkap" | Environment variable Netlify belum diisi. Isi, lalu **Deploys → Trigger deploy**. |
| Gagal membuat akun ("Server akun tidak dapat dihubungi") | Alamat Netlify belum ada di secret `ALLOWED_ORIGINS`, atau nama function bukan `admin-users`. |
| Notifikasi baru muncul setelah ±1 menit | Realtime belum aktif untuk tabel `notifications` (langkah 2.4). Aplikasi tetap berjalan dengan pemeriksaan berkala. |
| Video YouTube tidak tampil | Gunakan tautan YouTube biasa; aplikasi otomatis memakai mode privasi (`youtube-nocookie`). |
| Proyek Supabase "Paused" | Paket Free dijeda setelah 7 hari tanpa aktivitas. Buka dashboard Supabase → **Restore project**. |
| Setelah update, tampilan masih versi lama | Tutup lalu buka lagi aplikasinya (pembaruan dipasang saat dibuka berikutnya). |
