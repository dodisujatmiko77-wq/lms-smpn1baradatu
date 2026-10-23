# Pembaruan: Foto Profil, Mode Gelap/Terang, dan Informasi Pengembang

Versi aplikasi: **1.0.0** · Pengembang: **Dodi Sujatmiko**

## Yang baru

| Fitur | Keterangan |
|---|---|
| **Foto profil** | Profil Saya → ikon kamera pada foto. Foto dipotong persegi dan diperkecil ke 320 px WebP (±20–40 KB) di HP pengguna sebelum diunggah. Tampil di header dan halaman profil. |
| **Mode gelap/terang** | Ikon bulan/matahari di header (di HP: menu akun), tombol di halaman login, dan pilihan **Terang / Gelap / Ikuti perangkat** di Profil Saya. Pilihan disimpan per perangkat. |
| **Informasi pengembang** | "Dikembangkan oleh Dodi Sujatmiko" di halaman login, bagian bawah menu samping, dan kartu **Tentang aplikasi** di Profil Saya. |

## Migrasi database

Jalankan **sekali** di Supabase → **SQL Editor**: `supabase/migrations/0013_avatars.sql` → **Run** → harus **Success**.

Migrasi ini:
- Membuat bucket **privat** `avatars` (maks. 1 MB per berkas, hanya JPG/PNG/WebP).
- Kebijakan akses: setiap pengguna hanya bisa mengunggah, mengganti, dan menghapus foto di foldernya sendiri (`<id pengguna>/…`). Foto hanya bisa dibuka (signed URL) oleh pemiliknya dan admin.
- Menambah aturan bahwa `profiles.avatar_path` harus menunjuk ke folder pemilik profil (berlaku untuk perubahan baru; data lama tidak disentuh).
- Aman dijalankan ulang dan tidak menghapus data.

## Cara kerja mode gelap

- `public/theme-init.js` memasang kelas `dark` pada `<html>` sebelum halaman tampil (tanpa kedip). Berkas terpisah karena Content-Security-Policy melarang skrip inline.
- `src/styles/dark.css` membalik skala abu-abu (slate) lewat variabel warna, mengubah permukaan putih menjadi biru gelap, dan mencerahkan teks berwarna agar kontras ≥ 4,5:1. Tombol dan spanduk berwarna solid tidak berubah.
- Komponen baru tidak perlu kelas `dark:` tambahan selama memakai warna slate/putih dan warna tema seperti biasa. Bila menambah keluarga warna baru, jalankan `node scripts/gen-dark-colors.mjs` dan perbarui bloknya di `dark.css`.

## Pengujian yang sudah dijalankan

| Uji | Hasil |
|---|---|
| `supabase/tests/e2e_foto_profil.mjs` (unggah, batas folder, batas ukuran & jenis, akses admin/anon, hapus) | 17/17 lolos |
| Uji SQL RLS & audit keamanan (`10_…` s.d. `85_…`) | 379/379 lolos |
| Aksesibilitas axe (WCAG 2.1 AA) mode gelap & terang, 22 halaman admin/guru/siswa | 0 pelanggaran |
| Uji tampilan Playwright: login, dashboard, profil (unggah/hapus foto), menu HP, modal | sesuai |

## Cara menguji setelah deploy

1. Halaman login: tekan ikon bulan di kanan atas → tampilan menjadi gelap; muat ulang halaman → tetap gelap.
2. Masuk → Profil Saya → ikon kamera → pilih foto → muncul "Foto profil diperbarui." dan foto tampil di kanan atas.
3. Profil Saya → Tampilan → **Ikuti perangkat** → ubah mode gelap di pengaturan HP → LMS ikut berubah.
4. Bagian bawah menu samping menampilkan "Dikembangkan oleh Dodi Sujatmiko".
