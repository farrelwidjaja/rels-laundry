# Panduan Presentasi 10 Menit: WashFlow Cloud Laundry POS & WA Bot

> **Mata Kuliah**: Infrastruktur TI, Jaringan, dan Layanan Cloud  
> **Judul Proyek**: WashFlow Cloud — Smart Laundry POS & WhatsApp Bot Automation Platform  
> **Durasi**: 10 Menit (4 menit materi + 5 menit live demo + 1 menit tanya jawab)

---

## Susunan Slide & Skrip Presenter

### Slide 1: Judul & Latar Belakang (1 Menit)
* **Poin Utama**:
  - Digitalisasi Usaha Laundry Rumahan Menggunakan Konsep Cloud Services.
  - Mengintegrasikan Sistem Kasir (*Point of Sale*) dengan Bot Otomatisasi WhatsApp.
* **Skrip**:
  > *"Selamat pagi/siang bapak/ibu dosen dan teman-teman. Hari ini saya mempresentasikan proyek Cloud Services saya: **WashFlow Cloud**. Masalah nyata yang sering dialami laundry rumahan adalah: pakaian pelanggan sering tertukar karena label spidol luntur, pemilik lelah membalas chat pelanggan yang bertanya status cucian tiap jam, dan rak penuh karena cucian lupa diambil. WashFlow hadir sebagai solusi cloud native untuk menyelesaikan masalah tersebut."*

---

### Slide 2: Arsitektur Cloud & Standar DevOps (1 Menit)
* **Poin Utama**:
  - **Arsitektur 3-Tier**: Frontend SPA (HTML5, Tailwind CSS) + Backend Express.js REST API + Database SQLite Persisten.
  - **Containerization**: Dockerfile berbasis Alpine Linux yang di-harden dengan non-root user (`USER node`).
  - **Data Persistence**: Docker Named Volume (`laundry_data:/app/data`) yang menjamin data tidak hilang saat container restart.
  - **Health Monitoring**: Endpoint `/health` yang aktif memonitor koneksi database dan penggunaan memori.

---

### Slide 3: Fitur Utama Platform (1 Menit)
1. **Penimbangan & Pelabelan Cepat**: Setiap cucian ditimbang, harga otomatis dihitung, dan sistem mencetak label nomor unik (`#WASH-xxxx`).
2. **Bot WhatsApp Otomatis**: Pelanggan cukup bertanya via WhatsApp (*"Kak, WASH-1002 udah selesai belum?"*), dan bot otomatis memeriksa database lalu membalas status terkini.
3. **Notifikasi Otomatis Pas Cucian Beres**: Mengubah status ke "Selesai" memicu pesan WhatsApp otomatis ke pelanggan.
4. **Analitik Hari Paling Ramai**: Memetakan volume cucian per hari (Senin - Minggu) untuk mengoptimalkan operasional dan kurir.

---

## Skenario Live Demo di Depan Dosen (5 Menit)

Buka aplikasi di browser (bisa versi Vercel di `https://noc-infrastructure-dashboard.vercel.app` atau versi lokal di `http://localhost:3000`):

### 1. Demonstrasi Kasir & Penimbangan Baru (1 Menit)
1. Pada form sebelah kiri, masukkan:
   - Nama: `Ibu Nurul`
   - No WhatsApp: `081234567890`
   - Paket: `Cuci Komplit (Rp 8.000/kg)`
   - Berat: `4.5` Kg
2. Tunjukkan estimasi total harga dihitung otomatis: `Rp 36.000`.
3. Klik tombol **"Simpan & Buat Label Nomor"**.
4. Nota baru (misal `#WASH-1007`) langsung muncul di tabel transaksi bawah.

---

### 2. Demonstrasi Bot WhatsApp Cerdas (1.5 Menit)
1. Buka kotak **"Bot WhatsApp Laundry"** di tengah halaman.
2. Ketik pertanyaan:
   > *"Kak, cucian nomor WASH-1002 atas nama Budi udah selesai belum?"*
3. Tunjukkan bahwa bot **mengecek langsung ke database SQLite** dan menjawab status pesanan dengan ramah:
   > *"Halo Kak Budi Santoso! Status cucian Anda [#WASH-1002]: ✅ SUDAH SELESAI & WANGI. Total: Rp 45.000..."*
4. Coba ketik: *"Daftar harga paket dong"*, bot langsung membalas daftar tarif kiloan dan satuan.

---

### 3. Demonstrasi Notifikasi Otomatis Pas Cucian Beres (45 Detik)
1. Pada tabel transaksi, cari nota yang masih berstatus `Proses Cuci` atau `Setrika`.
2. Ubah dropdown statusnya menjadi **"Selesai (Kirim WA)"**.
3. Tunjukkan notifikasi pop-up hijau: sistem otomatis mengirimkan pesan WhatsApp ke pelanggan bahwa cucian sudah selesai dan siap diambil/diantar.

---

### 4. Demonstrasi Uji Validasi Input Negatif (HTTP 400) (45 Detik)
1. Masuk ke tab **"DevOps & Cloud Lab"**.
2. Klik tombol **"Kirim Input Tidak Valid (Trigger HTTP 400)"**.
3. Perlihatkan output di layar:
   - Status code: `HTTP 400 Bad Request`.
   - Error: `VALIDATION_FAILED` (karena berat negatif `-5.0 Kg` dan nomor telepon salah).
   - *Penjelasan ke dosen*: *"Ini membuktikan sistem memvalidasi data di layer API sebelum disimpan ke database."*

---

### 5. Demonstrasi Uji Gangguan Layanan (HTTP 503) & Persistensi (45 Detik)
1. Di tab yang sama, klik **"Simulasi Database Putus"**.
2. Tunjukkan bahwa `/health` merespons `HTTP 503 DOWN` secara graceful tanpa membuat aplikasi crash.
3. Klik **"Pulihkan Database"**: status kembali `HTTP 200 UP`.
4. *Persistensi Data*: Jika menggunakan Docker, jalankan `docker compose restart`, lalu refresh browser untuk membuktikan seluruh nota cucian tetap utuh berkat volume `laundry_data`.

---

## Antisipasi Tanya-Jawab (Q&A)

* **Dosen**: *"Mengapa menggunakan WhatsApp bukan membuat aplikasi mobile khusus untuk pelanggan?"*  
  **Jawaban**: *"Sesuai dengan survei UMKM, pelanggan enggan mendownload aplikasi baru hanya untuk laundry kiloan. Menggunakan WhatsApp memanfaatkan platform yang sudah 100% terpasang di ponsel pelanggan sehingga tingkat adopsinya maksimal."*

* **Dosen**: *"Bagaimana cara Docker memastikan data cucian tidak hilang?"*  
  **Jawaban**: *"Kami mendefinisikan named volume `laundry_data:/app/data` di `docker-compose.yml`. File database `laundry.db` disimpan di storage host OS, sehingga meskipun container di-stop, di-restart, atau di-rebuild, seluruh data transaksi tetap persisten."*
