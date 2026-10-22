# Tahap 8 — Penyempurnaan: Laporan & Panduan

## 1. Yang dikerjakan pada tahap ini

| Bagian | Hasil |
|---|---|
| **Halaman login** | Ilustrasi guru & siswa (gambar dari sekolah) tampil di panel kiri pada laptop dan sebagai banner di atas form pada HP. Gambar dikonversi ke WebP dalam dua ukuran (41 KB untuk HP, 86 KB untuk laptop) agar cepat dimuat. |
| **Audit keamanan RLS** | Skrip otomatis `supabase/tests/80_audit_keamanan.sql` (14 pemeriksaan) memastikan: semua tabel memakai RLS; semua fungsi `SECURITY DEFINER` mengunci `search_path`; pengguna tanpa login tidak bisa memanggil fungsi apa pun dan hanya bisa membaca identitas sekolah; tabel penting (audit log, jawaban kuis, notifikasi, badge, log aktivitas) tidak bisa ditulis langsung. Temuan yang diperbaiki: 3 fungsi utilitas masih bisa dipanggil tanpa login, dan hak default fungsi baru diperketat. |
| **Optimasi indeks** | 19 indeks baru pada kolom yang dipakai untuk filter, hak akses, dan penghapusan berantai, misalnya daftar kuis siswa, laporan, dan forum. Skrip audit juga memeriksa agar kunci asing penting selalu berindeks. |
| **Uji beban** | `supabase/tests/load_cbt.mjs` mensimulasikan ujian online serentak. Hasil di bawah. |
| **Aksesibilitas (WCAG 2.1 AA)** | 21 halaman dipindai otomatis dengan axe-core. Diperbaiki: kontras teks abu-abu kecil, tombol & avatar oranye/hijau, progress bar tanpa label, dan label tombol akun. Hasil akhir: **0 pelanggaran**. |
| **PWA** | Aplikasi bisa **dipasang di layar utama HP**, dengan ikon sekolah dan nama "LMS Baradatu". Hanya kerangka aplikasi yang diunduh di awal (±750 KB); halaman lain disimpan saat dibuka. Data sekolah **tidak** disimpan di HP; data selalu diambil dari server. Pembaruan aplikasi terpasang otomatis. |
| **Header keamanan hosting** | `Content-Security-Policy` (hanya skrip dari aplikasi sendiri; koneksi ke Supabase, YouTube, dan Google Fonts), HSTS, dan anti-clickjacking di `netlify.toml` & `vercel.json`. Kebijakan ini diuji dengan build produksi: unduh Excel/PDF, grafik, video YouTube, dan service worker semuanya berjalan **tanpa pelanggaran**. |
| **Hemat kuota Storage** | **Manajemen File → Bersihkan berkas jawaban semester lalu**. Hanya untuk semester yang sudah berakhir dan tidak aktif. Nilai, umpan balik, dan jawaban teks tetap tersimpan, dan tindakan ini tercatat di Audit Log. |
| **Panduan** | `docs/10-panduan-deploy.md` (deploy produksi ke Netlify + Supabase, perawatan, pemecahan masalah) dan `docs/11-panduan-pengguna.md` (admin, guru, wali kelas, siswa). |

---

## 2. Hasil uji beban (ujian online serentak)

Skenario: siswa menekan **Mulai** dalam rentang 3 detik, menjawab setiap soal (jeda 0,2–0,8 detik, lebih cepat daripada siswa sungguhan), lalu mengumpulkan dan membuka hasil.

| Skenario | Permintaan | Error | p95 simpan jawaban | p95 mulai ujian | Semua dinilai otomatis |
|---|---|---|---|---|---|
| 150 siswa × 20 soal | 3.750 | 0 | 5 ms | 9 ms | 150/150 ✅ |
| 400 siswa × 30 soal | 14.000 (659 permintaan/detik) | 0 | 10 ms | 24 ms | 400/400 ✅ |

> Catatan jujur: uji dilakukan di server lokal (tanpa jeda jaringan internet). Server Supabase **Free** memakai CPU bersama yang lebih kecil, jadi angka sebenarnya lebih lambat. Namun desain aplikasi ringan: 1 permintaan per jawaban, tanpa polling saat ujian, dan penilaian di server dalam satu transaksi. Rekomendasi untuk ujian serentak seluruh sekolah (±900 siswa):
> - Gunakan **Supabase Pro**.
> - Jadwalkan ujian **per sesi/kelas paralel** (misalnya 300 siswa per sesi), seperti ANBK.
> - Lakukan uji coba ujian kecil (1–2 kelas) sebelum PTS/PAS.

---

## 3. Pemasangan

1. **SQL Editor** → jalankan `supabase/migrations/0012_hardening_performance.sql`.
2. Aplikasi: `git pull` → **`npm install`** (ada plugin PWA baru) → `npm run dev`.
3. Untuk produksi, ikuti **`docs/10-panduan-deploy.md`**.

---

## 4. Checklist pengujian manual

- [ ] Halaman login: ilustrasi tampil di laptop (panel kiri) dan di HP (banner di atas form).
- [ ] Setelah deploy: di HP Android → **Instal aplikasi** → ikon "LMS Baradatu" muncul dan membuka LMS tanpa bilah alamat.
- [ ] **Manajemen File** → tabel "Bersihkan berkas jawaban semester lalu" tampil. Tombol **Bersihkan** hanya muncul untuk semester yang sudah berakhir.
- [ ] Coba buka LMS di dalam situs lain (iframe) → ditolak.
- [ ] Teks abu-abu kecil masih mudah dibaca di bawah sinar matahari (kontras sudah ditingkatkan).

---

## 5. Pengujian otomatis (seluruh tahap)

| Uji | Hasil |
|---|---|
| RLS & aturan data (SQL), Tahap 1–8 | **379/379 lolos** (22 baru: 14 audit keamanan + 8 pembersihan berkas) |
| Ujung-ke-ujung Tahap 1–7 (regresi) | **36 / 28 / 24 / 27 / 28 / 31 / 21 lolos** |
| Ujung-ke-ujung Tahap 8 (akses anonim + pembersihan berkas di Storage sungguhan) | **21/21 lolos** |
| Alur browser Tahap 5 / 6 / 7 (regresi setelah perubahan warna & aksesibilitas) | **22 / 18 / 13 langkah lolos** |
| Aksesibilitas axe-core, 21 halaman (admin, guru, siswa HP) | **0 pelanggaran WCAG 2.1 AA** |
| Build produksi + CSP: unduh Excel & PDF, grafik, YouTube, service worker | **Tanpa pelanggaran CSP & tanpa error** |
| Uji beban CBT | **400 siswa serentak, 0 error** |
