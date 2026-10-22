# Tahap 6 — Interaksi: Panduan Pemasangan, Pemakaian & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Bagian | Fitur |
|---|---|
| **Notifikasi** (semua) | Lonceng di kanan atas menampilkan jumlah belum dibaca. Klik notifikasi untuk langsung membuka materi/tugas/kuis/pengumuman/diskusi terkait. Ada halaman **Notifikasi** lengkap dengan tombol **Tandai semua dibaca**. Notifikasi masuk **seketika** (Supabase Realtime); bila koneksi realtime tidak tersedia, aplikasi memeriksa ulang tiap 60 detik. |
| **Isi notifikasi** | Materi baru · Tugas baru · Kuis/ujian baru · **Pengingat H-1** (tugas belum dikumpulkan & kuis yang segera ditutup) · Nilai tugas terbit · Nilai kuis lengkap (esai dinilai) · Pengumuman · Topik & balasan diskusi · Badge baru. Admin bisa menyalakan/mematikan tiap jenis di **Pengaturan Sekolah → Notifikasi**. |
| **Pengumuman** | Admin → **Pengumuman Sekolah** (seluruh sekolah atau kelas tertentu). Wali kelas → pengumuman untuk **kelas binaannya**. Guru → pengumuman untuk **kelas-mapel yang diajar** (menu **Pengumuman** atau tab **Pengumuman** di ruang kelas). Isi berformat (editor teks), bisa **dijadwalkan**, diberi **batas tayang**, dan **disematkan**. Tampil di beranda semua peran dan di ruang belajar siswa. |
| **Forum diskusi** | Tab **Diskusi** di setiap ruang kelas (guru & siswa). Siswa dan guru bisa membuat topik dan membalas, termasuk menanggapi balasan tertentu (satu tingkat). Tautan dalam tulisan otomatis bisa diklik. Penulis bisa mengubah atau menghapus tulisannya. |
| **Moderasi** (guru pengampu) | **Sematkan**, **kunci** topik (tidak bisa dibalas lagi), **sembunyikan/tampilkan** topik atau balasan, dan hapus. Tulisan yang disembunyikan hanya terlihat oleh guru dan penulisnya. |
| **Kalender** | Menggabungkan **agenda sekolah** (libur, ujian, kegiatan), **agenda kelas**, **tenggat tugas**, dan **jadwal kuis**. Tampil sebagai kalender bulanan (titik warna di HP) dengan daftar agenda per tanggal. Tugas yang sudah dikumpulkan dicoret. Admin menambah agenda sekolah/kelas lewat menu baru **Kalender Sekolah**; wali kelas bisa menambah agenda kelas binaannya. |
| **Badge** (siswa) | Menu **Badge Saya** dan kartu di beranda. Ada 7 badge per semester: Langkah Pertama, Rajin Belajar, Materi Tuntas, Tepat Waktu, Pejuang Kuis, Nilai Sempurna, Aktif Berdiskusi. Setiap badge menampilkan progres. Badge dihitung otomatis dari data nyata; siswa tidak bisa memberi badge sendiri. |

### Aturan penting (ditegakkan di server)

- **Notifikasi dibuat oleh server** (trigger database), bukan oleh pengguna. Setiap orang hanya bisa membaca notifikasinya sendiri. Siswa kelas lain tidak menerima notifikasi kelas ini.
- **Pengumuman terjadwal dan pengumuman yang sudah lewat batas tayang tidak terlihat oleh siswa.** Notifikasinya baru muncul saat jadwal tayang tiba.
- **Hak pengumuman:** sekolah → hanya admin; kelas → admin dan wali kelas tersebut; mapel → guru pengampu.
- **Forum:**
  - Hanya anggota ruang kelas (siswa kelas, guru pengampu, wali kelas, admin) yang bisa membaca dan menulis.
  - Siswa tidak bisa menyematkan, mengunci, atau menyembunyikan tulisan.
  - Topik yang sudah dibalas tidak bisa dihapus penulisnya.
  - Ada **batas 6 tulisan per menit** untuk mencegah spam.
  - Isi forum disimpan sebagai teks biasa, sehingga aman dari skrip berbahaya.
- **Audit Log** mencatat penghapusan pengumuman, serta penyembunyian dan penghapusan tulisan forum oleh guru.

### Catatan rancangan

- Pengingat H-1 dan badge dihitung saat siswa membuka aplikasi, jadi **tidak memerlukan pg_cron** (sesuai paket Supabase Free).
- Notifikasi lama yang sudah dibaca dihapus otomatis setelah 4 bulan agar database tetap ringan.
- Rekap keaktifan forum dan badge per kelas untuk wali kelas/guru dijadwalkan di **Tahap 7**.

---

## 2. Pemasangan di Supabase

1. **SQL Editor** → jalankan `supabase/migrations/0009_interactions.sql`, lalu `supabase/migrations/0010_achievements.sql`.
2. **Realtime:** migrasi otomatis mendaftarkan tabel `notifications` ke Realtime. Cek di **Database → Publications → supabase_realtime**: tabel `notifications` harus tercentang. Bila belum, centang secara manual.
3. Edge Function dan Storage **tidak berubah**.
4. Aplikasi: `git pull` → `npm install` → `npm run dev`.

---

## 3. Checklist pengujian manual

### Admin
- [ ] **Pengumuman Sekolah** → buat pengumuman untuk seluruh sekolah (disematkan) → muncul di beranda semua akun, dan lonceng mereka bertambah.
- [ ] Buat pengumuman terjadwal (besok) → siswa belum melihatnya.
- [ ] **Kalender Sekolah** → tambah agenda "Libur" dan "Ujian" → muncul di kalender guru & siswa.
- [ ] **Pengaturan Sekolah → Notifikasi** → matikan "Materi baru" → guru menerbitkan materi → siswa tidak menerima notifikasi.

### Guru
- [ ] Ruang kelas → tab **Pengumuman** → buat pengumuman → siswa kelas menerima notifikasi.
- [ ] Tab **Diskusi** → buat topik → siswa menerima notifikasi.
- [ ] Pada balasan siswa: **Sembunyikan** → siswa lain tidak melihatnya. Pada menu ⋮ topik: **Kunci topik** → siswa tidak bisa membalas.
- [ ] Wali kelas: buat pengumuman & agenda untuk kelas binaan.

### Siswa (sebaiknya dari HP)
- [ ] Lonceng menampilkan angka. Klik notifikasi → halaman yang benar terbuka, dan angka berkurang.
- [ ] Biarkan aplikasi terbuka, lalu minta guru membuat pengumuman → notifikasi muncul tanpa memuat ulang halaman (realtime).
- [ ] Mapel → tab **Diskusi** → buat topik & balas topik guru.
- [ ] **Kalender**: agenda sekolah, tenggat tugas, dan jadwal kuis tampil di tanggalnya.
- [ ] Selesaikan satu pertemuan → **Badge Saya** menampilkan "Langkah Pertama" (Baru!).

---

## 4. Pengujian otomatis

| Uji | Hasil |
|---|---|
| RLS & aturan data (SQL), Tahap 1–6 | **306/306 lolos** (72 baru) |
| Ujung-ke-ujung Tahap 1–5 (regresi) | **36 / 28 / 24 / 27 / 28 lolos** |
| Ujung-ke-ujung Tahap 6 | **31/31 lolos** |
| Alur browser: admin (pengumuman & agenda) → guru (lonceng, pengumuman kelas, topik) → siswa HP (notifikasi, balas, topik, kalender, badge) → guru memoderasi → siswa melihat topik terkunci | **18/18 lolos**, tanpa error konsol/HTTP |

> Catatan: stack uji lokal tidak menjalankan server Realtime, sehingga yang teruji di sana adalah jalur cadangan (pemeriksaan berkala). Uji realtime dilakukan di proyek Supabase sungguhan (langkah siswa ke-2 di atas).
