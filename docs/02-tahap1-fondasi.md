# Tahap 1 — Fondasi: Panduan Setup & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Bagian | Isi | Status |
|---|---|---|
| Proyek | React 19 + Vite, Tailwind CSS 4, React Router 7, TanStack Query, Recharts, ESLint, konfigurasi Netlify & Vercel | ✅ |
| Desain | Token warna (biru/oranye/hijau), Poppins + Inter, komponen reusable: Button, Input, Select, Textarea, Switch, Card, StatCard, Badge, Avatar, Modal, ConfirmDialog, Dropdown, Pagination, Skeleton, EmptyState, ErrorState, toast | ✅ |
| Layout | Sidebar per role (penuh di desktop, ikon di tablet, drawer di HP), header (judul, breadcrumb, cari menu `Ctrl K`, notifikasi, menu akun), navigasi bawah untuk siswa | ✅ |
| Login | Login NISN/NIP/username, pesan error berbahasa Indonesia, lupa password, reset password via email, **wajib ganti password** setelah akun dibuat/direset | ✅ |
| Keamanan | Guard rute per role, cek akun aktif, RLS di semua tabel, Edge Function `admin-users` (buat akun, reset password, aktif/nonaktif, ubah role), audit log | ✅ |
| Admin | Dashboard (statistik akun asli + grafik penggunaan + aktivitas terkini + checklist kesiapan), Akun Pengguna, Pengaturan Sekolah, Audit Log | ✅ |
| Guru & siswa | Dashboard awal + profil (ubah nomor HP, ganti password) | ✅ |
| Menu tahap berikutnya | Tampil dengan label `T2`–`T7` dan membuka halaman "Segera hadir" (tanpa data palsu) | ✅ |

### Perubahan kecil terhadap rancangan (mohon dicatat)

1. **Satu Edge Function `admin-users`** dengan beberapa aksi (`create`, `reset_password`, `set_status`, `set_roles`), bukan beberapa function terpisah. Alasannya: verifikasi admin dan audit cukup ditulis sekali, dan deploy lebih sederhana.
2. **Tabel `audit_logs` dibuat sekarang** (rancangan awal menaruhnya kemudian), karena pembuatan akun dan reset password sudah harus tercatat sejak Tahap 1.
3. **Manajemen akun versi awal** (buat, ubah, reset, aktif/nonaktif, role) sudah tersedia agar Tahap 1 bisa diuji dengan guru dan siswa sungguhan. Impor Excel massal tetap di Tahap 2.

### Batasan yang disengaja

- Unggah logo sekolah: Tahap 3 (bersama modul penyimpanan file). Saat ini memakai ikon bawaan.
- Kolom pencarian header saat ini mencari **menu**. Pencarian global materi/tugas: Tahap 6.
- Ikon notifikasi menampilkan keadaan kosong. Pusat notifikasi: Tahap 6.
- Menu **Wali Kelas** otomatis muncul setelah tabel `class_guardians` dibuat di Tahap 2.

---

## 2. Menyiapkan Supabase (sekali saja)

### 2.1 Buat proyek

1. Buka <https://supabase.com/dashboard> → **New project**.
2. Region: **Southeast Asia (Singapore)**, yang paling dekat dengan Lampung.
3. Simpan password database di tempat aman.

### 2.2 Pengaturan Auth

Buka **Authentication → Sign In / Providers**:

- Matikan **Allow new users to sign up**. Akun hanya dibuat oleh admin.
- Email provider tetap aktif.

Buka **Authentication → URL Configuration**:

- Site URL: `http://localhost:5173` (ganti dengan domain Netlify/Vercel saat produksi).
- Redirect URLs: tambahkan `http://localhost:5173/reset-password` dan `https://<domain-anda>/reset-password`.

### 2.3 Jalankan migrasi

**Cara A: SQL Editor (paling mudah).** Buka **SQL Editor**, lalu tempel dan jalankan isi file berikut satu per satu, **berurutan**:

1. `supabase/migrations/0001_extensions_enums_helpers.sql`
2. `supabase/migrations/0002_profiles_roles_settings.sql`

**Cara B: Supabase CLI.**

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push
```

### 2.4 Deploy Edge Function `admin-users` (lewat Dashboard, tanpa CLI)

1. Di Dashboard Supabase, buka menu **Edge Functions** di sidebar kiri.
2. Klik **Deploy a new function**, lalu pilih **Via Editor**.
3. Isi nama function persis: `admin-users`.
4. Hapus seluruh contoh kode di editor. Buka file `supabase/functions/admin-users/index.ts` di VS Code, salin **seluruh isinya** (Ctrl+A, Ctrl+C), lalu tempel ke editor.
5. Klik **Deploy function** dan tunggu sampai selesai.
6. Buka function `admin-users` → tab **Details**. Matikan **Enforce JWT Verification** lalu simpan. Ini aman, karena function sendiri memeriksa token dan memastikan pemanggil adalah admin aktif.
7. Buka **Edge Functions → Secrets** dan tambahkan:

| Name | Value |
|---|---|
| `LOGIN_EMAIL_DOMAIN` | `lms.smpn1baradatu.sch.id` |
| `ALLOWED_ORIGINS` | `http://localhost:5173` (tambahkan domain Netlify/Vercel nanti, dipisah koma) |

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sudah tersedia otomatis. **Jangan** ditambahkan, dan jangan disalin ke frontend.

**Alternatif lewat CLI:**

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase secrets set LOGIN_EMAIL_DOMAIN=lms.smpn1baradatu.sch.id ALLOWED_ORIGINS=http://localhost:5173
npm run functions:deploy
```

### 2.5 Buat administrator pertama

1. **Authentication → Users → Add user → Create new user**
   - Email: `admin@lms.smpn1baradatu.sch.id`
   - Password: password kuat (minimal 8 karakter, berisi huruf dan angka)
   - Centang **Auto Confirm User**, lalu klik **Create user**.
2. **SQL Editor → New query**. Tempel isi `supabase/scripts/bootstrap_admin.sql`, ubah `v_full_name` bila perlu, lalu klik **Run**. Hasil yang benar: `Admin pertama siap: admin (...)`.
3. Periksa hasilnya dengan query berikut:

```sql
select p.username, p.full_name, p.is_active, r.role
from public.profiles p left join public.user_roles r on r.user_id = p.id;
```

Harus muncul baris `admin | ... | true | admin`.

### 2.6 Jalankan aplikasi di komputer

1. Instal **Node.js LTS** dari <https://nodejs.org>. Cek di terminal: `node -v` (minimal v20).
2. Ekstrak zip proyek, lalu buka foldernya di VS Code (**File → Open Folder** → `lms-baradatu`).
3. Buka terminal VS Code (**Terminal → New Terminal**), lalu jalankan `npm install`.
4. Buat file `.env.local` di folder utama proyek (sejajar dengan `package.json`), isinya:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable atau anon key>
VITE_LOGIN_EMAIL_DOMAIN=lms.smpn1baradatu.sch.id
```

   URL dan key bisa diambil dari tombol **Connect** di bagian atas dashboard, atau dari **Project Settings → API Keys**. Gunakan **Publishable key** (`sb_publishable_…`) atau **anon public** (tab *Legacy API Keys*). **Jangan** memakai *secret* atau *service_role* key.
5. Jalankan `npm run dev`, lalu buka <http://localhost:5173>. Login dengan username `admin`.

> Bila PowerShell menampilkan `running scripts is disabled on this system`, ganti terminal ke **Command Prompt** (tanda ˅ di samping tombol + terminal), atau jalankan sekali: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

> Domain `LOGIN_EMAIL_DOMAIN` adalah email **internal** untuk login berbasis NISN/NIP. Tidak ada email yang dikirim ke alamat ini. Nilainya harus sama di `.env.local` dan di secret Edge Function.

### 2.7 Pemecahan masalah Edge Function

Buka `https://<project-ref>.supabase.co/functions/v1/admin-users` langsung di browser:

| Respons | Arti | Solusi |
|---|---|---|
| `{"error":"Metode tidak didukung."}` | Function sehat | — |
| `Requested function was not found` | Nama function salah (editor memberi nama acak) atau beda proyek | Buat ulang dengan nama persis `admin-users` |
| `Missing authorization header` / `Invalid JWT` | Verifikasi JWT gateway masih aktif, preflight CORS ditolak | Matikan **Enforce JWT Verification** |
| `BOOT_ERROR` / 500 | Kode tertempel tidak utuh | Tempel ulang `index.ts`, cek tab **Logs** |

Di aplikasi, gejala semua kasus di atas sama: *"Server akun (Edge Function admin-users) tidak dapat dihubungi"*. Di Console browser (F12) muncul *"blocked by CORS policy"*.

---

## 3. Deploy ke Netlify / Vercel

1. Hubungkan repositori ke Netlify atau Vercel. `netlify.toml` dan `vercel.json` sudah berisi build command, redirect SPA, dan header keamanan.
2. Isi environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LOGIN_EMAIL_DOMAIN`.
3. Tambahkan domain produksi ke **Site URL / Redirect URLs** Supabase dan ke secret `ALLOWED_ORIGINS`.

---

## 4. Checklist pengujian manual

Siapkan: 1 akun admin, lalu dari menu **Akun Pengguna** buat 1 guru dan 1 siswa.

### Login & sesi
- [ ] Membuka `/admin` tanpa login diarahkan ke `/login`.
- [ ] Password salah → pesan "Username atau password salah."
- [ ] Admin login dengan username `admin` → diarahkan ke dashboard admin.
- [ ] Refresh halaman → tetap login.
- [ ] Logout → muncul konfirmasi → kembali ke halaman login.

### Manajemen akun (admin)
- [ ] Buat akun siswa tanpa mengisi password → muncul password sementara 10 karakter + tombol salin.
- [ ] Username yang sama tidak bisa dipakai dua kali.
- [ ] Cari akun berdasarkan nama atau NISN; filter Siswa/Guru/Admin dan status.
- [ ] Ubah nama/HP/role akun → tersimpan.
- [ ] Reset password → password sementara baru muncul; password lama tidak berlaku.
- [ ] Nonaktifkan akun → pengguna tidak bisa login ("Akun Anda sedang dinonaktifkan"). Aktifkan kembali → bisa login.
- [ ] Admin tidak bisa menonaktifkan akunnya sendiri.
- [ ] Semua tindakan di atas muncul di **Audit Log**.

### Siswa & guru
- [ ] Login pertama siswa → wajib ganti password; tidak bisa membuka halaman lain sebelum mengganti.
- [ ] Setelah ganti password → beranda siswa; di HP muncul navigasi bawah.
- [ ] Siswa membuka `/admin` atau `/guru` → "Akses ditolak".
- [ ] Guru login → dashboard guru; membuka `/admin` → "Akses ditolak".
- [ ] Profil: ubah nomor HP; ganti password (password saat ini salah → ditolak).

### Pengaturan sekolah
- [ ] Ubah nama singkat/tagline → tampil di sidebar dan halaman login setelah refresh.
- [ ] Isi NPSN bukan 8 digit → pesan validasi.

### Tampilan
- [ ] Desktop (≥1280px): sidebar penuh, bisa diciutkan.
- [ ] Tablet (768–1279px): sidebar ikon.
- [ ] HP (<768px): menu drawer; tabel akun berubah menjadi kartu.

---

## 5. Pengujian otomatis

| Uji | Lokasi | Cakupan |
|---|---|---|
| RLS (SQL) | `supabase/tests/10_rls_tahap1.sql` | 23 pemeriksaan: isolasi profil, kolom terlarang, role, pengaturan, audit log, akun nonaktif |
| Ujung-ke-ujung | `supabase/tests/e2e_tahap1.mjs` | 36 pemeriksaan lewat API sungguhan: login, Edge Function, reset, nonaktif, role, RLS, audit |

Jalankan uji ujung-ke-ujung **hanya ke proyek uji/staging**, karena uji ini membuat akun sungguhan:

```bash
SUPABASE_URL=https://xxxx.supabase.co ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... npm run test:e2e
```

Hasil saat pengembangan (Supabase Auth v2.197 + PostgREST v16 + Edge Runtime v1.77 + PostgreSQL 16): **RLS 23/23 lolos, ujung-ke-ujung 36/36 lolos, alur browser 14/14 lolos** (desktop, tablet, HP).

---

## 6. Catatan paket Supabase Free

- Proyek **dijeda otomatis setelah 7 hari tanpa aktivitas**, misalnya saat libur panjang. Buka dashboard Supabase untuk mengaktifkannya kembali. Tahap 8 akan menambahkan backup terjadwal yang sekaligus menjaga proyek tetap aktif.
- Belum ada backup otomatis di paket Free. Sebelum Tahap 3 (mulai ada konten pembelajaran), lakukan **Database → Backups** manual atau `pg_dump` berkala.
- Kuota yang paling cepat habis adalah penyimpanan file (1 GB) dan egress (5 GB/bulan). Batas unggah di **Pengaturan Sekolah** sudah disiapkan untuk menjaganya.
