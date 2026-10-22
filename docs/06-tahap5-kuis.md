# Tahap 5 — Kuis & CBT: Panduan Pemasangan, Pemakaian & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Bagian | Fitur |
|---|---|
| **Bank Soal** (guru) | Menu **Bank Soal**: kumpulan soal per bab/materi, per mapel & tingkat kelas. Jenis soal: **pilihan ganda** (2–6 pilihan), **benar/salah**, **isian singkat** (boleh beberapa kunci, satu per baris), dan **esai/uraian** (dengan pedoman penilaian khusus guru). Setiap soal bisa diberi **skor** dan **pembahasan**. Soal bisa diubah, diduplikasi, dan dihapus. |
| **Membuat kuis/ujian** (guru) | Di ruang kelas, tab **Kuis** → **Buat kuis**. Atur judul, jenis (Kuis / Ujian), petunjuk, **waktu buka & tutup**, **durasi**, **batas percobaan**, **acak soal**, **acak pilihan**, **tampilkan nilai**, dan **kapan kunci/pembahasan boleh dilihat** (setelah mengumpulkan / setelah kuis ditutup / tidak ditampilkan). Soal diambil dari bank soal; urutan dan skor per soal bisa diatur. |
| **Mengerjakan** (siswa) | Menu **Kuis & Ujian** (juga di navigasi bawah HP, tab **Kuis** di ruang belajar, dan kartu **Kuis & ujian aktif** di Beranda). Halaman ujian dibuat **mode fokus** tanpa menu, dengan: **timer** yang mengikuti jam server, **jawaban tersimpan otomatis** (dan dicoba ulang bila sinyal putus), tombol **Ragu-ragu**, **daftar nomor soal**, ringkasan sebelum mengumpulkan, serta **pengumpulan otomatis saat waktu habis**. |
| **Hasil** (siswa) | Nilai (skala 0–100 dan skor mentah), jumlah soal dijawab, status "esai sedang dinilai", lalu **pembahasan** (jawabanku, kunci, penjelasan) bila guru mengizinkan. |
| **Hasil & Penilaian** (guru) | Rekap kelas: sudah mengumpulkan, rata-rata, tertinggi/terendah. Daftar siswa dengan status, nilai terbaik, jumlah percobaan, **berapa kali keluar dari halaman ujian**, dan waktu kumpul. Klik siswa untuk melihat jawabannya, **menilai esai**, atau **mengizinkan mengulang** (menghapus percobaan, misalnya karena HP mati). Nilai bisa **diunduh ke Excel**. |
| **Pemeriksaan & Dashboard** | Menu **Pemeriksaan** kini juga menampilkan **Esai kuis** yang menunggu nilai. Kartu **Perlu dinilai** di dashboard guru ikut menghitungnya. |

### Aturan penting (ditegakkan di server, bukan hanya di tampilan)

- **Kunci jawaban tidak pernah dikirim ke HP siswa sebelum diizinkan.** Siswa tidak punya akses baca ke tabel soal, pilihan, maupun jawaban. Soal dikirim lewat fungsi server yang membuang kunci. Kunci & pembahasan baru dikirim sesuai pengaturan guru.
- **Waktu mengikuti server.** Batas waktu dihitung server saat siswa menekan **Mulai** (durasi, dan tidak melewati waktu tutup). Mengubah jam HP tidak berpengaruh. Jawaban yang dikirim lebih dari 30 detik setelah batas waktu **ditolak**. Percobaan yang waktunya habis ditutup otomatis walaupun HP siswa mati.
- **Penilaian otomatis di server.** Pilihan ganda, benar/salah, dan isian dinilai otomatis. Untuk isian, huruf besar/kecil dan spasi berlebih diabaikan. Esai dinilai guru; **esai kosong otomatis bernilai 0**.
- **Batas percobaan** dan **urutan acak per siswa** disimpan di server. Membuka di dua tab tidak membuat dua percobaan.
- **Soal terkunci setelah ada siswa yang mengerjakan.** Susunan soal kuis tidak bisa diubah, dan kunci/opsi/skor soal di bank tidak bisa diubah, supaya penilaian adil. Perbaikan salah ketik pada teks soal tetap boleh. Soal yang masih dipakai kuis tidak bisa dihapus dari bank.
- **Hanya guru pengampu (dan admin) yang menilai esai dan mereset percobaan.** Wali kelas hanya bisa memantau hasil.
- **Keluar dari halaman ujian dicatat** (pindah aplikasi/tab, atau memuat ulang halaman). Ini **informasi** bagi guru, bukan hukuman otomatis.
- **Audit Log** mencatat penerbitan/penarikan/penghapusan kuis, setiap penilaian esai (nilai lama dan baru), dan reset percobaan.

### Catatan rancangan

- Nilai yang dipakai bila siswa mengerjakan lebih dari sekali adalah **nilai tertinggi**.
- Kuis tanpa soal tidak bisa diterbitkan.
- Notifikasi "kuis baru" dan "kuis segera ditutup" dijadwalkan di **Tahap 6**. Rekap nilai lintas mapel ada di **Tahap 7**.

---

## 2. Pemasangan di Supabase

1. **SQL Editor** → jalankan `supabase/migrations/0008_quizzes.sql`.
2. Tidak ada bucket Storage baru, dan Edge Function **tidak berubah**.
3. Aplikasi: `git pull` (atau unduh ZIP) → `npm install` → `npm run dev`.

---

## 3. Checklist pengujian manual

### Guru
- [ ] **Bank Soal** → **Bank soal baru** → tambahkan 1 soal dari setiap jenis.
- [ ] Simpan soal pilihan ganda tanpa menandai jawaban benar → ditolak dengan pesan.
- [ ] Ruang kelas → tab **Kuis** → **Buat kuis** → coba **Terbitkan** tanpa soal → ditolak.
- [ ] **Ambil dari bank soal** → **Pilih semua** → atur urutan/skor → tab **Pengaturan** → atur jadwal (buka = sekarang) → **Terbitkan**.
- [ ] Setelah ada siswa yang mengerjakan: susunan soal terkunci, dan kunci soal di bank tidak bisa diubah.
- [ ] **Hasil & Penilaian** → klik siswa → nilai esai → total berubah. Coba nilai melebihi skor soal → ditolak.
- [ ] **Izinkan mengulang** → siswa bisa mengerjakan lagi. Tercatat di Audit Log.
- [ ] **Unduh nilai (Excel)**.

### Siswa (sebaiknya dari HP)
- [ ] Beranda menampilkan **Kuis & ujian aktif**. Buka → **Mulai mengerjakan**.
- [ ] Jawab soal → muncul "Jawaban tersimpan". Matikan data sebentar → muncul "Belum tersimpan — mencoba lagi", lalu tersimpan lagi setelah data dinyalakan.
- [ ] Tutup aplikasi lalu buka lagi → **Lanjutkan mengerjakan**: jawaban masih ada, timer tetap berjalan.
- [ ] Pindah ke aplikasi lain lalu kembali → muncul peringatan. Guru melihat jumlah "keluar halaman".
- [ ] Biarkan waktu habis → jawaban dikumpulkan otomatis.
- [ ] Hasil: nilai, "esai sedang dinilai", dan pembahasan sesuai pengaturan guru.
- [ ] Siswa kelas lain tidak melihat kuis ini.

---

## 4. Pengujian otomatis

| Uji | Hasil |
|---|---|
| RLS & aturan data (SQL), Tahap 1–5 | **234/234 lolos** (65 baru) |
| Ujung-ke-ujung Tahap 1 / 2 / 3 / 4 (regresi) | **36 / 28 / 24 / 27 lolos** |
| Ujung-ke-ujung Tahap 5 (bank soal, kuis, CBT, penilaian) | **28/28 lolos** |
| Alur browser: guru menyusun bank soal & kuis → siswa HP mengerjakan → siswa laptop pindah tab, muat ulang, waktu habis → guru menilai esai → siswa melihat nilai akhir | **22/22 lolos**, tanpa error konsol/HTTP |
