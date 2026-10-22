# Tahap 3 — Pembelajaran: Panduan Pemasangan, Pemakaian & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Bagian | Fitur |
|---|---|
| **Ruang kelas digital** (guru) | Menu **Kelas Saya** → satu ruang kelas per kelas × mapel. Susun **Bab**: tambah, ubah, urutkan naik/turun, hapus. Susun **Pertemuan**: nomor, judul, bab. Setiap pertemuan menampilkan status Draf/Terbit, jumlah materi, dan "x/y siswa selesai". |
| **Editor pertemuan** | Ringkasan/tujuan pembelajaran dan **editor teks** (judul, tebal, miring, garis bawah, daftar, kutipan, blok kode, tautan). Lampiran: **unggah banyak berkas sekaligus** (PDF, gambar, PPT, DOC, XLS), **video YouTube**, dan **tautan**. Tombol **Pratinjau** (tampilan siswa) dan **Publikasikan / Tarik ke draf**. Ada peringatan bila meninggalkan halaman sebelum menyimpan. |
| **Progress siswa** (guru) | Tab **Progress Siswa**: penyelesaian per siswa, rata-rata kelas, siswa yang belum membuka materi, dan waktu terakhir belajar. |
| **Mata Pelajaran** (siswa) | Kartu mapel dengan cincin progress, materi terbaru, dan kapan terakhir dibuka. |
| **Ruang belajar** (siswa) | Daftar pertemuan per bab dengan status **Belum dimulai / Sedang dipelajari / Selesai**, progress bar, dan tombol **Mulai/Lanjutkan belajar**. |
| **Halaman baca materi** | Nyaman dibaca di HP: isi materi, gambar tampil langsung, video YouTube (thumbnail dulu, video baru dimuat saat diputar), PDF bisa dibaca tanpa mengunduh, tombol **Tandai Selesai**, navigasi sebelumnya/berikutnya. |
| **Dashboard siswa** | Progress keseluruhan, pertemuan selesai, materi terbaru, dan progress per mapel. |
| **Manajemen File** (admin) | Pemakaian penyimpanan dibandingkan kuota paket Free (1 GB), rincian per mapel, dan 20 berkas terbesar. |
| **Logo sekolah** | Logo LMS bawaan sudah terpasang di halaman login, sidebar, favicon, dan ikon HP. Admin bisa mengganti logo di **Pengaturan Sekolah** atau kembali ke logo bawaan. |

### Keamanan & hemat kuota

- **Bucket `materials` bersifat privat.** Berkas dibuka lewat *signed URL* yang berlaku 1 jam.
  - Siswa hanya bisa membuka berkas pertemuan yang **sudah terbit** di **kelasnya sendiri**.
  - Berkas pertemuan draf tidak bisa dibuka siswa, sekalipun mereka mengetahui alamatnya.
- **Hanya guru pengampu (dan admin) yang bisa mengunggah atau menghapus materi.** Wali kelas hanya bisa *melihat* materi guru lain, tidak bisa mengubahnya.
- **Jenis berkas dibatasi di dua lapis.** Bucket Supabase hanya menerima PDF, gambar, dan dokumen Office/ODF; HTML/JS/EXE ditolak. Aplikasi menerapkan daftar jenis dan batas ukuran dari **Pengaturan Sekolah**.
- **Gambar otomatis dikompres** di browser (maks. 1600 px, WebP). Contoh hasil uji: 357 KB → 14 KB.
- **Isi materi disanitasi** (DOMPurify) sebelum ditampilkan ke siswa, sehingga skrip berbahaya tidak bisa disisipkan.
- **Progress hanya bisa ditulis lewat fungsi server.** Siswa tidak bisa mengubah progress teman atau menandai pertemuan yang belum terbit.
- **Video wajib lewat YouTube**, sehingga tidak memakai kuota penyimpanan.
- Menghapus pertemuan atau materi **ikut menghapus berkasnya** dari storage. Publikasi dan penghapusan pertemuan tercatat di **Audit Log**.

### Catatan rancangan

- Fitur **"hak akses khusus"** (admin memberi guru lain izin mengubah ruang kelas) belum dibuat, karena belum ada kebutuhan nyata. Saat ini hanya guru pengampu dan admin yang bisa mengubah konten.
- Admin belum memiliki tampilan untuk membuka ruang kelas guru. Pemantauan lintas kelas dijadwalkan di **Tahap 7**, bersama menu Wali Kelas.

---

## 2. Pemasangan di Supabase

### 2.1 Jalankan 2 migrasi baru (SQL Editor, berurutan)

1. `supabase/migrations/0005_classroom_lessons.sql`
2. `supabase/migrations/0006_storage.sql`, yang membuat bucket `materials` & `public-assets` beserta kebijakan aksesnya

Untuk memeriksa hasilnya, buka **Storage** di dashboard Supabase. Harus ada bucket `materials` (Private) dan `public-assets` (Public).

### 2.2 Edge Function

**Tidak ada perubahan** pada Edge Function di tahap ini.

### 2.3 Perbarui kode aplikasi

```bash
git pull                 # atau unduh ZIP branch terbaru
npm install              # WAJIB: ada library baru (editor teks TipTap & DOMPurify)
npm run dev
```

---

## 3. Cara memakai (untuk guru)

1. **Kelas Saya** → pilih kelas.
2. **Tambah bab**, misalnya "Bab 1: Bilangan Bulat".
3. **Tambah pertemuan** → isi judul → **Buat & isi materi**.
4. Di editor:
   - isi ringkasan dan materi,
   - **Tambah** lampiran (berkas, video YouTube, atau tautan),
   - **Simpan**.
5. Klik **Pratinjau** untuk melihat tampilan siswa, lalu **Publikasikan**.
6. Pantau tab **Progress Siswa**.

> Pertemuan baru selalu tersimpan sebagai **Draf**, dan siswa baru bisa melihatnya setelah dipublikasikan. Untuk menyembunyikannya lagi, gunakan **Tarik ke draf**.

---

## 4. Checklist pengujian manual

### Guru
- [ ] Kelas Saya menampilkan kartu kelas × mapel. Klik kartu untuk membuka ruang kelas.
- [ ] Tambah 2 bab, ubah urutannya, lalu hapus satu. Pertemuan di bab yang dihapus pindah ke "Tanpa bab".
- [ ] Buat pertemuan, isi materi dengan judul, teks tebal, dan daftar berbutir, lalu **Simpan**.
- [ ] Unggah PDF dan foto dari HP/kamera. Foto otomatis mengecil.
- [ ] Unggah berkas yang melebihi batas ukuran atau jenis yang tidak diizinkan → muncul pesan penolakan per berkas.
- [ ] Tambah video YouTube dan tautan. Tautan yang bukan YouTube ditolak di tab Video.
- [ ] Coba **Publikasikan** tanpa isi dan tanpa lampiran → ditolak dengan pesan.
- [ ] Publikasikan, lalu cek **Pratinjau**.
- [ ] Ubah judul, lalu klik menu lain tanpa menyimpan → muncul peringatan "Tinggalkan tanpa menyimpan?".
- [ ] Hapus satu lampiran dan satu pertemuan.

### Siswa (sebaiknya dari HP)
- [ ] **Mapel** menampilkan mapel kelasnya beserta progress 0%.
- [ ] Pertemuan **draf tidak terlihat**. Setelah guru mempublikasikan, pertemuan muncul.
- [ ] Buka pertemuan → status menjadi **Sedang dipelajari**. Gambar tampil, video bisa diputar, dan PDF bisa dibuka.
- [ ] **Tandai Selesai** → status **Selesai**, dan progress mapel serta beranda bertambah.
- [ ] Siswa kelas lain tidak melihat mapel atau materi kelas ini.

### Admin
- [ ] **Manajemen File** menampilkan pemakaian penyimpanan dan berkas terbesar.
- [ ] **Pengaturan Sekolah** → unggah logo → logo berubah di login dan sidebar. **Pakai logo bawaan** mengembalikan logo LMS.
- [ ] **Audit Log** mencatat publikasi dan penghapusan pertemuan.

---

## 5. Pengujian otomatis

| Uji | Hasil |
|---|---|
| RLS & aturan data (SQL), Tahap 1–3 | **118/118 lolos** (40 baru) |
| Ujung-ke-ujung Tahap 1 / 2 (regresi) | **36/36**, **28/28 lolos** |
| Ujung-ke-ujung Tahap 3, dengan **Supabase Storage sungguhan** | **24/24 lolos** |
| Alur browser: guru menyusun materi → siswa HP membaca & menyelesaikan → guru memantau → admin file & logo | **18/18 lolos** |

Cakupan Tahap 3 antara lain:
- unggah dan unduh berkas lewat signed URL,
- berkas HTML ditolak bucket,
- berkas pertemuan draf tidak bisa diunduh siswa,
- siswa kelas lain tidak bisa mengunduh,
- siswa tidak bisa mengunggah atau menghapus berkas,
- path berkas lintas ruang kelas ditolak,
- wali kelas tidak bisa mengubah materi guru lain,
- progress hanya lewat RPC,
- logo hanya bisa diunggah admin,
- berkas ikut terhapus bersama pertemuan,
- audit log.

Pengujian juga menemukan dan memperbaiki satu bug: editor teks bisa macet di mode pengembangan (React StrictMode).
