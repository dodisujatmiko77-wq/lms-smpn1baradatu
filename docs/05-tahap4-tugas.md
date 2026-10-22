# Tahap 4 — Tugas: Panduan Pemasangan, Pemakaian & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Bagian | Fitur |
|---|---|
| **Membuat tugas** (guru) | Di ruang kelas, tab **Tugas** → **Buat tugas**. Isian tugas: judul, deskripsi singkat, **instruksi** (editor teks), **lampiran** (berkas, video YouTube, tautan), jenis pengumpulan (**teks / dokumen / gambar / tautan**), tanggal mulai, **tenggat**, nilai maksimum, dan pilihan *terima pengumpulan terlambat*. Tugas dimulai sebagai draf, lalu **Terbitkan**. |
| **Pemeriksaan** (guru) | Menu **Pemeriksaan** berisi antrean jawaban yang menunggu dinilai dari semua kelas. Di tab **Pengumpulan & Nilai**, siswa bisa difilter: semua, perlu dinilai, belum mengumpulkan, sudah dinilai. Guru melihat jawaban teks, tautan, dan berkas/foto, lalu memberi **nilai + umpan balik** (**Simpan & berikutnya** untuk lanjut ke siswa berikutnya). Siswa yang tidak mengumpulkan tetap bisa diberi nilai, misalnya 0. Nilai diterbitkan sekaligus dengan **Terbitkan nilai**. |
| **Tugas** (siswa) | Tab **Perlu dikerjakan / Terkumpul / Dinilai**, dengan hitung mundur tenggat dan warna peringatan saat tenggat mendekat. |
| **Mengerjakan tugas** | Siswa membaca instruksi dan lampiran, lalu menulis jawaban, menempel tautan, dan **mengunggah dokumen/foto** (foto dikompres otomatis; draf tersimpan setiap kali berkas diunggah). Tersedia **Simpan draf**, **Kumpulkan**, dan **Batalkan pengumpulan** (selama guru belum mulai menilai). |
| **Status tugas** | Belum dibuka · **Belum dikerjakan** · **Dikerjakan** (draf) · **Terkumpul** · **Terlambat** · Lewat tenggat · **Sudah dinilai** |
| **Nilai & Umpan Balik** (siswa) | Nilai yang sudah terbit, dikelompokkan per mapel beserta rata-ratanya, plus umpan balik guru. |
| **Dashboard** | Guru: kartu **Perlu dinilai**. Siswa: kartu **Tugas belum selesai** dan daftar **Tugas mendatang**. Ruang belajar siswa kini memiliki tab **Materi / Tugas**. |

### Aturan penting (ditegakkan di server, bukan hanya di tampilan)

- **Tenggat memakai waktu server.** Jam di HP siswa tidak berpengaruh. Pengumpulan setelah tenggat:
  - ditandai **Terlambat** bila tugas menerima keterlambatan,
  - **ditolak** bila tidak menerima keterlambatan.
- **Penulisan jawaban hanya lewat fungsi server** (`save_submission`). Siswa tidak bisa menulis langsung ke tabel, mengumpulkan untuk siswa lain, atau melampirkan berkas milik siswa lain.
- Jawaban yang sudah **terkumpul** tidak bisa diubah sebelum dibatalkan. Pembatalan tidak bisa dilakukan lagi setelah guru mulai menilai.
- Setelah **nilai terbit**, tugas **terkunci** bagi siswa.
- **Nilai hanya bisa diubah oleh guru pengampu (dan admin).** Wali kelas hanya bisa memantau. Nilai tidak bisa melebihi nilai maksimum dan hanya bisa diberikan kepada siswa di kelas tersebut.
- **Siswa hanya melihat nilainya sendiri, dan hanya setelah diterbitkan.**
- **Berkas di bucket privat `assignment-files`.** Setiap siswa punya folder sendiri, sehingga tidak bisa membuka atau menghapus berkas teman. Lampiran tugas draf tidak bisa dibuka siswa. Saat tugas dihapus, guru ikut membersihkan berkas jawaban siswa (bug ini ditemukan dan diperbaiki saat pengujian).
- **Audit Log** mencatat penerbitan/penarikan/penghapusan tugas, setiap pemberian dan perubahan nilai (nilai lama dan baru), serta penerbitan nilai.

### Catatan rancangan

- Nilai disimpan per (tugas, siswa) dan boleh ada tanpa pengumpulan, misalnya nilai 0 untuk yang tidak mengumpulkan.
- Lampiran tugas dan daftar berkas jawaban disimpan sebagai daftar (JSON) di baris tugas/pengumpulan, bukan tabel terpisah, agar lebih sederhana dan hemat query.
- **Notifikasi** "tugas baru", "tenggat mendekat", dan "nilai terbit" dijadwalkan di **Tahap 6**.

---

## 2. Pemasangan di Supabase

1. **SQL Editor** → jalankan `supabase/migrations/0007_assignments.sql`.
2. Buka **Storage** dan pastikan bucket baru **`assignment-files`** (Private) sudah ada.
3. Edge Function **tidak berubah**.
4. Aplikasi: `git pull` (atau unduh ZIP) → `npm install` → `npm run dev`.

---

## 3. Checklist pengujian manual

### Guru
- [ ] Ruang kelas → tab **Tugas** → **Buat tugas** → isi deskripsi, instruksi, dan lampiran → **Terbitkan**.
- [ ] Coba terbitkan tugas tanpa deskripsi, instruksi, maupun lampiran → ditolak dengan pesan.
- [ ] Tenggat sebelum tanggal mulai → ditolak.
- [ ] Menu **Pemeriksaan** menampilkan tugas yang memiliki jawaban baru.
- [ ] Beri nilai melebihi nilai maksimum → ditolak. Beri nilai valid + umpan balik → **Simpan & berikutnya**.
- [ ] **Terbitkan nilai** → jumlah nilai yang terbit sesuai.
- [ ] Ubah nilai yang sudah terbit → siswa melihat nilai baru, dan Audit Log mencatat perubahannya.
- [ ] Hapus tugas → tugas, jawaban, berkas, dan nilainya hilang.

### Siswa (sebaiknya dari HP)
- [ ] Tugas baru muncul di **Beranda** dan menu **Tugas** dengan hitung mundur tenggat.
- [ ] Tulis jawaban dan unggah foto dari kamera → foto mengecil, draf tersimpan.
- [ ] **Kumpulkan** → status **Terkumpul**. **Batalkan pengumpulan** → kembali menjadi draf.
- [ ] Tugas dengan tenggat lewat yang tidak menerima keterlambatan → tombol Kumpulkan tidak tersedia, dan server juga menolak.
- [ ] Setelah nilai terbit: nilai dan umpan balik tampil, tugas terkunci, dan menu **Nilai & Umpan Balik** menampilkan rata-rata mapel.
- [ ] Siswa lain di kelas yang sama tidak bisa melihat jawaban atau nilai temannya.

---

## 4. Pengujian otomatis

| Uji | Hasil |
|---|---|
| RLS & aturan data (SQL), Tahap 1–4 | **169/169 lolos** (51 baru) |
| Ujung-ke-ujung Tahap 1 / 2 / 3 (regresi) | **36 / 28 / 24 lolos** |
| Ujung-ke-ujung Tahap 4, dengan Supabase Storage sungguhan | **27/27 lolos** |
| Alur browser: guru membuat & menerbitkan tugas → siswa HP mengerjakan & mengumpulkan → guru menilai lewat Pemeriksaan → siswa melihat nilai | **12/12 lolos** |
