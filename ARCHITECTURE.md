# WashFlow Cloud: System Architecture Documentation

Dokumen ini menjelaskan arsitektur sistem, containerisasi Docker, persistent storage, alur otomatisasi WhatsApp, dan penanganan gangguan pada platform **WashFlow Cloud Laundry POS**.

---

## 1. Diagram Arsitektur 3-Tier

```mermaid
graph TD
    Client["Pelanggan & Kasir (Web SPA)<br/>Tailwind CSS + WhatsApp Simulator"]

    subgraph Host["Docker Host Environment"]
        subgraph BridgeNet["Docker Bridge Network: laundry_network"]
            subgraph Container["Container: washflow-laundry-pos (Node:22-alpine)"]
                API["Express.js Server (:3000)<br/>- Kasir & CRUD Order Engine<br/>- WhatsApp NLP / Intent Processor<br/>- Strict Input Validator<br/>- Structured JSON Logger"]
                HealthProbe["Healthcheck Engine<br/>/health Probe"]
                SQLiteEngine["SQLite Database Engine<br/>(node:sqlite)"]
            end
        end

        subgraph Storage["Docker Storage Subsystem"]
            NamedVol[("Docker Named Volume<br/>laundry_data<br/>/app/data/laundry.db")]
        end
    end

    Client -->|"HTTP API (Port 3000:3000)"| API
    API --> HealthProbe
    API -->|"Baca / Tulis Transaksi & Log"| SQLiteEngine
    SQLiteEngine -->|"File I/O Persisten"| NamedVol
    HealthProbe -->|"Uji Kesiapan DB"| SQLiteEngine
```

---

## 2. Alur Pesan & Otomatisasi Bot WhatsApp

```mermaid
sequenceDiagram
    autonumber
    actor Pelanggan as Pelanggan (WhatsApp)
    participant WA as Bot WhatsApp / Webhook
    participant DB as SQLite Storage
    actor Kasir as Kasir Outlet

    Note over Pelanggan,WA: Kasus 1: Pelanggan Tanya Status Cucian
    Pelanggan->>WA: "Kak, order WASH-1002 udah selesai belum?"
    WA->>DB: Query Order by Code ('WASH-1002')
    DB-->>WA: Return Data (Status: 'Selesai', Rp 45.000)
    WA-->>Pelanggan: "Halo Kak Budi! Cucian Anda [#WASH-1002] berstatus: SELESAI & WANGI. Total: Rp 45.000..."

    Note over Kasir,Pelanggan: Kasus 2: Notifikasi Otomatis Pas Cucian Selesai
    Kasir->>DB: Update Status Cucian -> 'Selesai'
    DB->>WA: Trigger Event Order Selesai
    WA-->>Pelanggan: Notifikasi Otomatis: "Cucian Anda sudah selesai dan harum! Siap diambil."
```

---

## 3. Persistensi Data Docker Volume

```text
+-------------------------------------------------------------------------+
| HOST OPERATING SYSTEM                                                   |
|                                                                         |
|  [Port 3000]                                                            |
|       |                                                                 |
|       v                                                                 |
|  +-------------------------------------------------------------------+  |
|  | DOCKER BRIDGE NETWORK (laundry_network)                           |  |
|  |                                                                   |  |
|  |   CONTAINER: washflow-laundry-pos                                 |  |
|  |   +-----------------------------------------------------------+   |  |
|  |   | Base: node:22-alpine                                      |   |  |
|  |   | User: node (Non-root Least Privilege)                     |   |  |
|  |   | Mount: /app/data <===================================+    |   |  |
|  |   +------------------------------------------------------|----+   |  |
|  +----------------------------------------------------------|--------+  |
|                                                             |           |
|                                                             v           |
|  NAMED VOLUME: laundry_data ================================>+           |
|  (Menyimpan file database /app/data/laundry.db di host OS)              |
|  Data tetap utuh saat:                                                  |
|    - docker compose restart                                             |
|    - docker compose down && docker compose up                           |
|    - Container crash / failure                                          |
+-------------------------------------------------------------------------+
```
