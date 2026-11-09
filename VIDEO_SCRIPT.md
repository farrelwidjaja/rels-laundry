# Skrip Rekaman Video Demo YouTube (Durasi 3–5 Menit)

> **Mata Kuliah**: COMP6991031 – Cloud Services (Kelas LA75)  
> **Nama Mahasiswa**: Farrel Widjaja  
> **NIM**: 2602179884 / [Isi NIM Anda]  
> **Judul Projek**: Rels Laundry — Smart Cloud-Native Laundry Management System & WhatsApp Bot Automation  
> **Durasi Target**: 3 Menit 30 Detik – 4 Menit (Sesuai ketentuan soal: 3–5 menit, visibilitas Public/Unlisted)  
> **Ketentuan Wajib**: Menggunakan suara Anda sendiri (bukan suara robot AI / text-to-speech). Rekaman layar sederhana dengan OBS Studio atau tombol Windows `Win + G`.

---

## Rangkuman Alur & Visual Rekaman

| Menit | Bagian Video | Apa yang Ditampilkan di Layar? |
|---|---|---|
| **0:00 – 0:45** | **Perkenalan Diri & Latar Belakang** | Halaman depan web Rels Laundry ([https://rels-laundry.vercel.app/](https://rels-laundry.vercel.app/) atau `localhost:3000`) |
| **0:45 – 2:00** | **Bedah Kode Dockerfile & Compose** | VS Code membuka file `Dockerfile` dan `docker-compose.yml` |
| **2:00 – 3:30** | **Demo POS, Bot WA, & Uji Persistensi** | Browser `http://localhost:3000` + Terminal menjalankan `docker compose down` & `up` |
| **3:30 – 4:00** | **Kesimpulan & Penutup** | Halaman GitHub Repo `farrelwidjaja/rels-laundry` |

---

## Skrip Kata-per-Kata (Verbatim Speech)

### BAGIAN 1: PERKENALAN & LATAR BELAKANG PROJEK (Menit 0:00 – 0:45)
*(Tampilkan layar browser yang membuka antarmuka web Rels Laundry)*

> *"Halo, selamat pagi/siang bapak/ibu dosen penguji dan rekan-rekan sekalian.  
> Perkenalkan, nama saya **Farrel Widjaja**, mahasiswa Computer Science BINUS University kelas **LA75**, dengan mata kuliah **Cloud Services (COMP6991031)**.  
> 
> Pada kesempatan kali ini, saya mempresentasikan projek UTS saya yang berjudul **Rels Laundry: Smart Cloud-Native Laundry Management System & WhatsApp Bot Automation**.  
> 
> Projek ini berawal dari permasalahan nyata pada UMKM laundry kiloan rumahan:  
> Pertama, label kertas sering luntur dan sobek saat dicuci, sehingga baju rawan tertukar.  
> Kedua, pemilik laundry kelelahan membalas chat pelanggan yang berulang kali menanyakan status cucian.  
> 
> Untuk menyelesaikan masalah tersebut, saya merancang sistem kasir Point of Sale modern yang langsung menerbitkan **E-Receipt ber-QR Code**, terintegrasi dengan **Bot WhatsApp Cerdas 24/7**, dan diorkestrasi secara penuh menggunakan **Docker Compose multi-tier**."*

---

### BAGIAN 2: BEDAH DOCKERFILE & DOCKER-COMPOSE (Menit 0:45 – 2:00)
*(Pindahkan rekaman layar ke VS Code, buka file `Dockerfile`)*

> *"Sekarang mari kita masuk ke bedah konfigurasi containerization-nya.  
> 
> Pertama, pada file **Dockerfile**, saya menerapkan **Multi-Stage Build** yang dibagi menjadi dua tahap:  
> 1. Stage pertama adalah `builder`, menggunakan base image spesifik `node:22.11.0-alpine3.20`—bukan tag `latest`—agar proses build deterministik. Di sini, saya menyalin `package.json` terlebih dahulu sebelum kode sumber untuk mengoptimalkan layer caching Docker saat `npm ci`.  
> 2. Stage kedua adalah `runtime`. Di tahap ini, kita hanya menyalin folder `node_modules` produksi dan file yang dibutuhkan saja dari builder. Kami menambahkan paket minimal `curl` untuk healthcheck probe.  
> 
> Untuk alasan keamanan, saya menerapkan **Principle of Least Privilege** dengan berpindah dari user root ke unprivileged `USER node`. Port 3000 di-expose, dan perintah dijalankan menggunakan **exec form** `CMD ["node", "src/server.js"]` agar aplikasi Node.js dapat menerima sinyal `SIGTERM` secara langsung untuk graceful shutdown.  
> Saya juga menggunakan direktif `COPY` alih-alih `ADD` karena `COPY` lebih aman dan terprediksi, tanpa risiko ekstraksi tarball otomatis yang tidak diinginkan.  
> Berkat multi-stage ini, ukuran image akhir sangat ramping, hanya sekitar **184 MB**."*

*(Buka file `docker-compose.yml` di VS Code)*

> *"Selanjutnya, pada **docker-compose.yml**, arsitektur sistem dipecah menjadi arsitektur multi-tier sejati:  
> 1. Service pertama adalah **`app`**, yaitu backend Express dan frontend POS.  
> 2. Service kedua adalah **`db`**, menggunakan database relasional **PostgreSQL 16 Alpine**. Aplikasi terhubung ke database bukan via localhost atau IP, melainkan melalui nama service internal `db` pada user-defined bridge network `laundry_network`.  
> 3. Database dilengkapi healthcheck `pg_isready`, dan service `app` memiliki klausul `depends_on: db: condition: service_healthy` sehingga backend tidak akan menyala sebelum database siap.  
> 4. Seluruh data transaksi disimpan pada **named volume** `postgres_data` dan `laundry_data` agar data bersifat persisten.  
> 5. Sebagai nilai bonus, saya juga menambahkan service **`cache`** menggunakan **Redis 7.2** dengan healthcheck `redis-cli ping` untuk meng-cache query pesanan, serta service **`adminer`** di bawah profile `tools` pada port 8080."*

---

### BAGIAN 3: DEMO APLIKASI & UJI PERSISTENSI DATA (Menit 2:00 – 3:30)
*(Buka browser di `http://localhost:3000`)*

> *"Sekarang mari kita uji aplikasinya yang sedang berjalan di localhost.  
> 
> Pertama, kita coba input order baru di menu Kasir & POS:  
> Misal kita masukkan nama pelanggan: **Kak Budi**, nomor WhatsApp: **081234567890**, paket **Express 3 Jam Kilat**, dengan berat **3.5 Kg**.  
> Sistem otomatis menghitung total tagihan Rp 52.500. Saat tombol 'Simpan Order & Buat QR Code' kita klik, sistem langsung memunculkan **E-Receipt resmi** lengkap dengan barcode transaksi dan **QR Code scannable**. Pelanggan cukup scan QR ini dari ponsel untuk melacak status pakaian mereka.  
> 
> Kedua, kita buka tab **Bot WhatsApp**:  
> Pelanggan bisa bertanya misalnya: *'Cek status cucian WASH-1002'* atau *'Berapa harga cuci komplit?'*. Bot WhatsApp otomatis membaca database secara real-time dan membalas detail status pengerjaan pakaian beserta total biaya.  
> 
> Ketiga, mari kita buka Terminal untuk membuktikan **Uji Persistensi Data**:  
> Di terminal, saat saya jalankan perintah:*  
> `docker compose ps`  
> *(Tunjukkan semua service statusnya Up and Healthy)*  
> 
> *Sekarang, saya matikan seluruh container dengan:*  
> `docker compose down`  
> *(Tunjukkan container berhasil di-stop dan di-remove)*  
> 
> *Lalu kita nyalakan kembali dengan:*  
> `docker compose up -d`  
> 
> *Saat kita refresh browser di `http://localhost:3000`, perhatikan bahwa seluruh data pesanan Kak Budi dan nota-nota sebelumnya **masih ada secara utuh**.  
> Hal ini membuktikan named volume `postgres_data` dan `laundry_data` berhasil menyimpan data di storage host OS.  
> Jika kita menggunakan `docker compose down -v` dengan flag minus v, barulah seluruh named volume akan dihapus permanen dan data ter-reset."*

---

### BAGIAN 4: KESIMPULAN & PENUTUP (Menit 3:30 – 4:00)
*(Tampilkan halaman repositori GitHub `farrelwidjaja/rels-laundry`)*

> *"Seluruh kode program, Dockerfile, docker-compose, dan dokumentasi lengkap telah saya push ke repositori GitHub publik di **github.com/farrelwidjaja/rels-laundry** dengan riwayat 6 commit bertahap tanpa mengekspos file rahasia `.env`.  
> 
> Aplikasi ini juga aktif live di cloud platform Vercel di **rels-laundry.vercel.app**.  
> 
> Pelajaran berharga yang saya dapatkan adalah bagaimana containerization mempermudah portabilitas aplikasi dari localhost ke cloud dengan jaminan reliabilitas, isolasi jaringan, dan persistensi data yang kuat.  
> 
> Sekian presentasi UTS Cloud Services dari saya. Terima kasih atas perhatian bapak/ibu dosen. Selamat pagi/siang!"*

---

## Checklist Deskripsi Video YouTube
Saat mengunggah video ke YouTube (visibilitas **Public** atau **Unlisted**), cantumkan teks berikut di kolom deskripsi video:

```text
UTS Cloud Services (COMP6991031) - Kelas LA75
BINUS University - Computer Science
Nama: Farrel Widjaja
Judul Projek: Rels Laundry — Smart Cloud-Native Laundry Management System & WhatsApp Bot Automation

Tautan Projek:
- Repository GitHub: https://github.com/farrelwidjaja/rels-laundry
- Live Demo Website: https://rels-laundry.vercel.app/
- Artikel Publik: https://dev.to/farrelwidjaja/building-a-cloud-native-laundry-pos-with-docker-compose-whatsapp-bot-and-qr-e-receipts
```
