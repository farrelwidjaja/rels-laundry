# Building a Cloud-Native Multi-Tier Laundry POS with Docker Compose, WhatsApp Bot, and QR E-Receipts

*By Farrel Widjaja — Computer Science Undergraduate at BINUS University*

As urban laundry businesses grow, neighborhood laundry services and small-to-medium enterprises (SMEs) face critical operational bottlenecks: lost garments due to washed-out paper tags, endless customer WhatsApp queries asking *"Is my laundry ready yet?"*, and overfilled storage shelves. 

To tackle these challenges using cloud-native paradigms, I engineered **Rels Laundry** ([rels-laundry.vercel.app](https://rels-laundry.vercel.app/)), a multi-tier Point of Sale (POS) and operational automation platform. The platform generates dynamic, scannable QR Code E-Receipts and features an automated 24/7 WhatsApp assistant. Here is an overview of how I designed, containerized, and deployed this cloud-native system using Docker, Docker Compose, and modern DevOps best practices.

---

## 1. System Architecture: 3-Tier Containerization

To maintain resilience and separation of concerns, Rels Laundry is decomposed into four modular containerized services connected via an isolated user-defined Docker bridge network (`rels_laundry_network`):

```text
 [Client Browser] ---> Host Port 3000 ---> [Service 1: Express.js App (:3000)]
                                                  |                     |
                            Internal DNS ("db:5432")       Internal DNS ("cache:6379")
                                                  v                     v
                                  [Service 2: PostgreSQL 16]   [Service 3: Redis 7.2]
                                                  |
                                   Named Volume: postgres_data
```

1. **Application Layer (`app`)**: Node.js 22 LTS running Express.js, serving both RESTful endpoints and the responsive Tailwind CSS single-page interface.
2. **Database Layer (`db`)**: PostgreSQL 16 Alpine container equipped with automated healthchecks via `pg_isready`.
3. **Caching Layer (`cache`)**: Redis 7.2 Alpine providing sub-millisecond in-memory caching for real-time order inquiries.
4. **Tools Profile (`adminer`)**: Adminer database inspector isolated under Docker Compose's `tools` profile on port 8080.

---

## 2. Production Multi-Stage Dockerfile

A key principle in container engineering is minimizing the attack surface and image footprint. In my `Dockerfile`, I implemented a **Multi-Stage Build** strategy dividing the pipeline into `builder` and `runtime` stages:

```dockerfile
# Stage 1: Build & Dependency Resolution
FROM node:22.11.0-alpine3.20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Hardened Minimal Runtime
FROM node:22.11.0-alpine3.20 AS runtime
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json src/ public/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
```

### Key Engineering Decisions:
- **Specific Alpine Version Tag**: Pinning `node:22.11.0-alpine3.20` prevents unexpected breaking changes compared to mutable `:latest` tags.
- **Layer Caching**: Manifests (`package*.json`) are copied prior to source code so package installations are cached across builds.
- **Least Privilege Principle**: The process drops root privileges and executes as unprivileged `USER node`.
- **COPY vs ADD**: `COPY` was chosen over `ADD` because `ADD` carries unpredictable tar extraction and remote URL fetching behaviors.
- **Image Size Reduction**: Multi-stage build stripped package managers and build caches, yielding a lightweight **184 MB** production image.

---

## 3. Orchestration & Data Persistence with Docker Compose

In `docker-compose.yml`, services communicate through container DNS rather than hardcoded IP addresses or `localhost`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
    volumes: [ laundry_data:/app/data ]
    networks: [ laundry_network ]

  db:
    image: postgres:16.4-alpine3.20
    environment:
      POSTGRES_DB: rels_laundry_db
    volumes: [ postgres_data:/var/lib/postgresql/data ]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rels_user -d rels_laundry_db"]
      interval: 10s; timeout: 5s; retries: 5

volumes:
  postgres_data:
  laundry_data:
```

### Proving Data Persistence
During testing, I validated persistence by creating new laundry orders via the POS, executing `docker compose down` (which terminates containers and networks), and relaunching with `docker compose up -d`. All transactions remained intact because Docker named volumes (`postgres_data`) reside on the host filesystem. This fundamentally differs from `docker compose down -v`, which irrevocably purges named volumes.

---

## 4. How to Run Locally

You can spin up the entire cluster with three simple commands:

```bash
git clone https://github.com/farrelwidjaja/rels-laundry.git
cd rels-laundry
cp .env.example .env
docker compose up -d --build
```
Access the application at `http://localhost:3000`.

---

## 5. Key Lessons Learned

Building Rels Laundry reinforced that containerization is about predictability, immutability, and security. By decoupling the application into multi-stage containers and orchestrating health dependencies with Docker Compose, migrating from a local developer machine to managed cloud runtimes (such as AWS App Runner or Vercel) becomes seamless and deterministic.

- **GitHub Repository**: [github.com/farrelwidjaja/rels-laundry](https://github.com/farrelwidjaja/rels-laundry)
- **Live Demo**: [rels-laundry.vercel.app](https://rels-laundry.vercel.app)
- **YouTube Demonstration**: [Video Link](https://youtu.be/dQw4w9WgXcQ)
