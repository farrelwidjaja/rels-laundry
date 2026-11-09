# Rels Laundry — Smart Cloud-Native Laundry Management System & WhatsApp Bot Automation

[![Node.js CI](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose%20v3.8-blue.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org/)
[![Redis Cache](https://img.shields.io/badge/Cache-Redis%207.2-dc382d.svg)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Frontend-TailwindCSS%203.4-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Mata Kuliah**: COMP6991031 – Cloud Services (Kelas LA75)  
> **Institusi**: Computer Science / School of Computer Science, BINUS University  
> **Mahasiswa**: Farrel Widjaja  
> **Topik Projek**: Multi-Tier Containerized Cloud Application (Frontend + Backend + PostgreSQL + Redis Cache) with QR Code E-Receipt & WhatsApp Bot Automation  
> **Live Demo Vercel**: [https://rels-laundry.vercel.app](https://rels-laundry.vercel.app)

---

## 1. Deskripsi & Alasan Pemilihan Projek

### Deskripsi Projek
**Rels Laundry** adalah aplikasi Point of Sale (POS) dan manajemen operasional laundry kiloan berbasis *cloud-native*. Sistem ini mengintegrasikan kasir digital cepat dengan kalkulasi tarif otomatis, pembuatan **E-Receipt berbasis QR Code** unik yang dapat discan secara langsung oleh pelanggan untuk melacak status pengerjaan pakaian secara real-time, serta **Bot WhatsApp Cerdas** yang melayani pertanyaan status pesanan dan daftar tarif secara otomatis 24/7.

### Alasan & Masalah yang Diselesaikan
Usaha laundry rumahan dan UMKM sering mengalami kendala operasional nyata:
1. **Pakaian Tertukar atau Hilang**: Label kertas konvensional sering rusak atau luntur saat dicuci. Rels Laundry memberikan ID transaksi unik (`#WASH-xxxx`) dengan QR Code digital.
2. **Beban Chat Manual**: Pemilik usaha lelah menjawab pesan berulang dari pelanggan yang menanyakan *"Cucian saya sudah beres belum?"*. Rels Laundry menyediakan asisten bot WhatsApp interaktif yang mengecek langsung status pesanan ke database secara instan.
3. **Penumpukan Rak Cucian**: Pelanggan sering lupa mengambil pakaian tepat waktu. Sistem menyediakan fitur notifikasi otomatis ketika status pakaian diubah menjadi *Selesai*.

---

## 2. Arsitektur Multi-Tier & Containerization

Sistem dibangun dengan arsitektur 3-tier cloud-native yang diisolasi menggunakan Docker container:

```text
                     +-------------------------------------------------+
                     |                 USER / BROWSER                  |
                     |         (Kasir, Pelanggan, & WhatsApp)          |
                     +-------------------------------------------------+
                                              |
                                      HTTP Port 3000
                                              v
+-----------------------------------------------------------------------------------------------+
| DOCKER BRIDGE NETWORK: rels_laundry_network                                                    |
|                                                                                               |
|  +-------------------------------------+           +---------------------------------------+  |
|  | SERVICE 1: app (rels-laundry-app)   |           | SERVICE 3: cache (rels-laundry-cache) |  |
|  | - Node.js 22 Express REST API       |           | - Redis 7.2 In-Memory Store           |  |
|  | - Tailwind CSS Static SPA           | <=======> | - Port: 6379 (Internal Cache DNS)     |  |
|  | - Port: 3000:3000                   |           | - Healthcheck: redis-cli ping         |  |
|  | - User: node (Non-Root Hardened)    |           +---------------------------------------+  |
|  | - Healthcheck: GET /health          |                                                      |
|  +-------------------------------------+                                                      |
|                     |                                                                         |
|         Internal DNS Connection ("db:5432")                                                   |
|                     v                                                                         |
|  +-------------------------------------+           +---------------------------------------+  |
|  | SERVICE 2: db (rels-laundry-db)     |           | SERVICE 4: adminer [Profile: tools]   |  |
|  | - PostgreSQL 16 Alpine              |           | - Web Database Management GUI         |  |
|  | - Port: 5432:5432                   |           | - Port: 8080:8080                     |  |
|  | - Healthcheck: pg_isready           |           | - Accessible via --profile tools      |  |
|  +-------------------------------------+           +---------------------------------------+  |
|                     |                                                                         |
+---------------------|-------------------------------------------------------------------------+
                      v
       +------------------------------+
       | DOCKER NAMED VOLUMES         |
       | - postgres_data (DB State)   |
       | - laundry_data (Local State) |
       +------------------------------+
```

---

## 3. Cara Menjalankan di Localhost

Sesuai kriteria Soal 2e, orang lain dapat menjalankan seluruh aplikasi dan database cukup dengan 3 langkah sederhana:

### Langkah 1: Clone Repository
```bash
git clone https://github.com/farrelwidjaja/rels-laundry.git
cd rels-laundry
```

### Langkah 2: Siapkan Environment Variables
```bash
cp .env.example .env
```

### Langkah 3: Jalankan dengan Docker Compose
```bash
docker compose up -d --build
```

Setelah perintah di atas selesai:
- **Web App Rels Laundry**: Buka browser di [http://localhost:3000](http://localhost:3000)
- **Healthcheck Endpoint**: Buka di [http://localhost:3000/health](http://localhost:3000/health)
- **API Orders**: Buka di [http://localhost:3000/api/orders](http://localhost:3000/api/orders)

*(Opsional)* Jika ingin membuka Adminer Database GUI (Profile `tools`):
```bash
docker compose --profile tools up -d
```
Lalu buka di browser [http://localhost:8080](http://localhost:8080).

---

## 4. Fitur Utama & Bukti Pengujian

1. **Kasir POS & QR E-Receipt**: Input order pakaian, kalkulasi berat otomatis, dan langsung generate nota ber-QR Code yang dapat dicetak (*print-ready*) atau dibagikan ke WhatsApp pelanggan.
2. **Lacak Status via QR Code**: Masukkan kode nota (misal `WASH-1002`) atau scan QR Code untuk melihat timeline tahapan cuci secara transparan.
3. **Bot Asisten WhatsApp 24/7**: Simulasi bot WhatsApp cerdas yang terhubung ke database live. Mengetahui harga, promo, jadwal kurir, hingga status pakaian berdasarkan nomor nota atau nama pelanggan.
4. **DevOps & Chaos Engineering Lab**:
   - Uji validasi input negatif (HTTP 400 Bad Request) jika berat $\le 0$ atau format nomor HP salah.
   - Simulasi gangguan penyimpanan database (HTTP 503 Service Unavailable) dan pemulihan otomatis ke HTTP 200 OK.
5. **Uji Persistensi Data**: Data transaksi aman tersimpan di dalam Docker named volume `postgres_data` dan `laundry_data`. Menjalankan `docker compose down` lalu `docker compose up -d` membuktikan seluruh data pesanan tetap utuh tanpa kehilangan riwayat.

---

## 5. Tautan Publik Proyek UTS

| Komponen | Tautan Publik |
|---|---|
| **Repository GitHub** | [https://github.com/farrelwidjaja/rels-laundry](https://github.com/farrelwidjaja/rels-laundry) |
| **Live Production (Vercel)** | [https://rels-laundry.vercel.app](https://rels-laundry.vercel.app) |
| **Artikel Publik** | *Tautan artikel publik (Medium / Dev.to / LinkedIn)* |
| **Video Demo YouTube** | *Tautan video demonstrasi publik 3–5 menit* |

---

## 6. AI Usage Declaration (Deklarasi Penggunaan AI)

Sesuai ketentuan ujian kategori **Partial AI Use** (maksimal 50% proses pengerjaan):

- **Alat AI yang Digunakan**: Gemini AI / Antigravity Agentic Assistant.
- **Bagian yang Dibantu**:
  1. *Brainstorming & Architecture Design*: Perancangan diagram arsitektur multi-tier container dan perumusan matriks shared responsibility model layanan cloud.
  2. *Refinement & Multi-Stage Optimization*: Optimalisasi Dockerfile multi-stage untuk meminimalkan ukuran image dan penyusunan dependensi healthcheck pada Docker Compose.
  3. *Kerangka Dokumen & Skrip Presentasi*: Penyusunan outline artikel publik dan struktur naskah video demonstrasi.
- **Contoh Prompt Utama**:
  > *"Bantu rancang arsitektur multi-tier cloud-native menggunakan Docker Compose untuk aplikasi laundry POS dengan service app Express.js, PostgreSQL dengan named volume, Redis caching, dan profile tools Adminer yang memenuhi kriteria ujian Cloud Services."*
  > *"Tuliskan perbandingan komparatif model layanan IaaS, PaaS, SaaS, BaaS, dan FaaS beserta shared responsibility dan relevansinya untuk aplikasi Point of Sale UMKM."*
- **Pernyataan Kemandirian**: Seluruh baris konfigurasi pada `Dockerfile` dan `docker-compose.yml` telah dipelajari, dipahami, dan dapat dijelaskan secara mandiri pada video demonstrasi dan laporan ujian.

---

## 7. Lisensi

Proyek ini dirilis di bawah lisensi [MIT License](LICENSE).
Semua hak cipta dan merek dagang adalah milik Farrel Widjaja.
