# LMS Digital — UPT SMP Negeri 1 Baradatu

Learning Management System untuk UPT SMP Negeri 1 Baradatu, Kabupaten Way Kanan, Lampung.

**Stack:** React 19 + Vite · Tailwind CSS 4 · React Router 7 · TanStack Query · Recharts · Lucide · Supabase (PostgreSQL, Auth, Storage, Edge Functions, RLS)

**Status:** Tahap 1 — Fondasi ✅ · Tahap 2 — Data Master ✅ · Tahap 3 — Pembelajaran ✅ · Tahap 4 — Tugas ✅ · Tahap 5 — Kuis & CBT ✅

| Dokumen | Isi |
|---|---|
| [`docs/01-rancangan-sistem.md`](docs/01-rancangan-sistem.md) | Rancangan sistem yang disetujui |
| [`docs/02-tahap1-fondasi.md`](docs/02-tahap1-fondasi.md) | Setup Supabase, Edge Function, admin pertama |
| [`docs/03-tahap2-data-master.md`](docs/03-tahap2-data-master.md) | Migrasi 0003–0004, urutan menyiapkan data sekolah, impor Excel |
| [`docs/04-tahap3-pembelajaran.md`](docs/04-tahap3-pembelajaran.md) | Migrasi 0005–0006 (ruang kelas & Storage), cara guru menyusun materi |
| [`docs/05-tahap4-tugas.md`](docs/05-tahap4-tugas.md) | Migrasi 0007 (tugas, pengumpulan, nilai), alur pemeriksaan |
| [`docs/06-tahap5-kuis.md`](docs/06-tahap5-kuis.md) | Migrasi 0008 (bank soal, kuis, ujian online/CBT), aturan keamanan ujian |

## Menjalankan secara lokal (VS Code)

```bash
npm install
cp .env.example .env.local    # isi URL & anon key proyek Supabase
npm run dev                   # http://localhost:5173
```

Langkah lengkap menyiapkan proyek Supabase (migrasi, Edge Function, admin pertama) ada di [`docs/02-tahap1-fondasi.md`](docs/02-tahap1-fondasi.md).

## Struktur folder

```
docs/                     rancangan & panduan per tahap
supabase/
  migrations/             migrasi SQL bernomor (jangan diedit setelah dijalankan di produksi)
  functions/admin-users/  Edge Function manajemen akun, satu file (service_role hanya di sini)
  scripts/                skrip sekali jalan (admin pertama)
  tests/                  uji RLS (SQL) & uji ujung-ke-ujung (Node)
src/
  app/                    router, providers (auth, pengaturan), guard rute
  components/ui/          komponen reusable (Button, Input, Card, Modal, ...)
  components/layout/      sidebar, header, navigasi HP
  config/                 menu per role & nilai cadangan sekolah
  features/<modul>/       halaman, komponen, dan API per modul
  lib/                    klien Supabase, util, validasi, pesan error
```

## Keamanan singkat

- Frontend hanya memakai **anon key**. `service_role` hanya ada di secrets Edge Function.
- Semua tabel memakai **RLS**. Pemeriksaan role di frontend hanya untuk tampilan.
- Password tidak pernah disimpan di tabel aplikasi; akun dikelola Supabase Auth.
- Tindakan sensitif tercatat di `audit_logs` (hanya-baca, tidak bisa dihapus).

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi ke `dist/` |
| `npm run lint` | ESLint |
| `npm run db:push` | Menjalankan migrasi ke proyek Supabase yang di-link |
| `npm run functions:deploy` | Deploy Edge Function `admin-users` |
| `npm run test:e2e` | Uji ujung-ke-ujung Tahap 1–4 (lihat panduan; jangan ke produksi) |
