# BeamPay ⚡

A social payments platform built on the Stellar blockchain. BeamPay transforms financial transactions into social interactions — users can pay friends, add memos, like and comment on payments, and share activity publicly or privately, similar to Venmo or Cash App.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running with Docker](#running-with-docker)
  - [Running Locally](#running-locally)
- [Smart Contracts](#smart-contracts)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [CI / CD](#ci--cd)
- [Contributing](#contributing)

---

## Features

- **Social Payments Feed** — Share peer-to-peer payments (e.g. *"Alice paid ₦5,000 to Bob for Lunch"*) with likes and comments. Supports public, friends-only, and private visibility.
- **Yield Vault** — Earn passive yield on idle wallet balance. Deposit, withdraw, and toggle auto-earn from the app. Tracks APY, accrued interest, and full transaction history.
- **Cross-Chain Bridge** — Fund your Stellar wallet from Ethereum, Solana, BNB Chain, or Polygon via Allbridge Core integration.
- **Fiat Settlement** — Deposit and withdraw fiat (including Naira ₦) through regulated Stellar Anchors using SEP-24 / SEP-38.
- **Soroban Smart Contracts** — On-chain execution of payments, social graphs, token management, and yield vaulting via Soroban (Stellar's smart contract platform).
- **Secure Wallet Onboarding** — BIP-39 mnemonic generation with screenshot prevention, clipboard auto-clear, and biometric lock.
- **NFC Tap-to-Pay** — Contactless payment flow for in-person transactions.
- **Push Notifications** — Yield reports (daily/weekly), payment alerts, and friend activity via Expo Notifications.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Mobile App    │────▶│  Rust Backend    │────▶│  PostgreSQL + Redis │
│  (React Native) │     │  (Axum / REST)   │     └─────────────────────┘
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────▼──────────┐
                    │  Stellar / Soroban    │
                    │  (Soroban RPC Node)   │
                    └───────────────────────┘
         ┌──────────────────────────────────────┐
         │  Yield Scheduler (background worker) │
         │  sweep_worker · notifications cron   │
         └──────────────────────────────────────┘
```

| Layer | Description |
|---|---|
| `mobileapp/` | React Native (Expo) — wallet, feed, bridge UI |
| `backend/` | Axum Rust API — auth, social, indexer, yield |
| `contracts/` | Soroban smart contracts workspace |
| `dashboard/` | Next.js admin dashboard — stats and monitoring |

---

## Tech Stack

| Area | Technology |
|---|---|
| Mobile | React Native 0.81, Expo 54, Expo Router, TypeScript |
| Backend | Rust (Axum 0.7, SQLx 0.7, Tokio), JWT (Ed25519) |
| Database | PostgreSQL 15, Redis 7 |
| Blockchain | Stellar / Soroban, `@stellar/stellar-sdk` v16 |
| Contracts | Rust (Soroban SDK), WASM targets |
| Dashboard | Next.js, TypeScript, Tailwind CSS |
| DevOps | Docker, Docker Compose, GitHub Actions, Kubernetes |
| Security | gitleaks, cargo-audit, Ed25519 signature auth |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) + `wasm32-unknown-unknown` target
- [Docker](https://www.docker.com/) and Docker Compose
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- PostgreSQL 15 (or use Docker Compose)

---

### Environment Variables

Copy the example and fill in your values:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:password@localhost:5432/beampay_dev` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `ALLBRIDGE_API_URL` | `https://core-api.allbridge.io` | Allbridge Core API |
| `JWT_SECRET` | — | **Change before deploying.** Secret for signing JWTs |
| `RUST_LOG` | `info` | Log level (`debug`, `info`, `warn`, `error`) |

> **Never commit real values for `JWT_SECRET` or database credentials.**

---

### Running with Docker

The easiest way to run the full stack locally:

```bash
docker-compose up
```

This starts:
- `beampay-postgres` on port `5432`
- `beampay-redis` on port `6379`
- `beampay-soroban-rpc` (Stellar local sandbox) on port `8000`
- `beampay-backend` API on port `8080`
- `beampay-yield-scheduler` background worker

---

### Running Locally

#### Mobile App

```bash
cd mobileapp
npm install
npm start
```

Then press:
- `w` — open in browser at `http://localhost:8081`
- `a` — open on Android emulator
- `i` — open on iOS simulator
- Scan the QR code with Expo Go on your device

#### Backend API

```bash
cd backend
cargo run
```

API will be available at `http://localhost:8080`. See [API Reference](#api-reference) for endpoints.

#### Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Opens at `http://localhost:3000`.

---

## Smart Contracts

Six Soroban contracts in the `contracts/` workspace:

| Contract | Description |
|---|---|
| `social_payment` | Core P2P payment logic with visibility controls |
| `user_registry` | On-chain user address and username registry |
| `social_graph` | Friend relationships and follow graph |
| `naira_token` | Fiat-pegged Naira token (NGN) |
| `allbridge_receiver` | Receives and validates cross-chain bridge transfers |
| `yield_vault` | Manages deposited balances and yield accrual |

#### Build & Test

```bash
cd contracts

# Build all contracts to WASM
cargo build --target wasm32-unknown-unknown --release

# Run all contract tests
cargo test
```

---

## API Reference

Full OpenAPI spec: [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml)

Base URL: `http://localhost:8080`

**Auth** — Stellar keypair challenge/response, returns a 24-hour JWT.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `GET` | `/api/auth/challenge` | — | Get signing challenge |
| `POST` | `/api/auth/verify` | — | Verify signature, issue JWT |
| `GET` | `/api/users/profile` | ✓ | Get own profile |
| `POST` | `/api/users/profile` | ✓ | Update profile |
| `GET` | `/api/users/search?q=` | ✓ | Search users |
| `GET` | `/api/users/friends` | ✓ | List friends |
| `POST` | `/api/users/friends/request` | ✓ | Send friend request |
| `GET` | `/api/feed/public` | ✓ | Public payment feed |
| `GET` | `/api/feed/friends` | ✓ | Friends payment feed |
| `GET` | `/api/feed/private` | ✓ | Private payment feed |
| `POST` | `/api/social/like` | ✓ | Like a payment |
| `DELETE` | `/api/social/unlike` | ✓ | Unlike a payment |
| `POST` | `/api/social/comment` | ✓ | Comment on a payment |
| `DELETE` | `/api/social/comment/:id` | ✓ | Delete a comment |
| `POST` | `/api/bridge/quote` | — | Get bridge quote |
| `POST` | `/api/bridge/tx` | — | Submit bridge transaction |
| `GET` | `/api/bridge/status/:id` | — | Get bridge tx status |
| `GET` | `/api/yield/balance` | ✓ | Yield vault balance + APY |
| `GET` | `/api/yield/history` | ✓ | Yield transaction history |
| `POST` | `/api/yield/deposit` | ✓ | Deposit into yield vault |
| `POST` | `/api/yield/withdraw` | ✓ | Withdraw from yield vault |
| `POST` | `/api/yield/auto-earn` | ✓ | Toggle auto-earn |

---

## Project Structure

```
beampay/
├── mobileapp/          # React Native / Expo app
│   ├── app/            # Expo Router screens
│   ├── src/
│   │   ├── components/ # Shared UI components
│   │   ├── constants/  # Colors, config
│   │   ├── services/   # Wallet, security, screen capture
│   │   └── utils/      # Retry, helpers
│   └── assets/         # Fonts, images
├── backend/            # Rust API server
│   ├── src/
│   │   ├── api/        # Route handlers (auth, feed, social, bridge, yield)
│   │   ├── db/         # SQLx models and queries
│   │   ├── indexer/    # Stellar ledger event indexer
│   │   └── services/   # Allbridge, Stellar, yield calc, sweep worker
│   ├── migrations/     # SQL migration files
│   └── docs/           # openapi.yaml
├── contracts/          # Soroban smart contracts
│   └── contracts/
│       ├── social_payment/
│       ├── user_registry/
│       ├── social_graph/
│       ├── naira_token/
│       ├── allbridge_receiver/
│       └── yield_vault/
├── dashboard/          # Next.js admin dashboard
├── k8s/                # Kubernetes manifests
├── scripts/            # Utility scripts
└── docker-compose.yml  # Full local stack
```

---

## CI / CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Description |
|---|---|---|
| `ci.yml` | Push / PR | Lint and test mobile app |
| `ci-backend.yml` | Push / PR | Rust build, test, cargo-audit |
| `ci-contracts.yml` | Push / PR | Contract build and tests |
| `build.yml` | Push | Docker image build |
| `deploy-staging.yml` | Push to `develop` | Deploy to staging |
| `deploy-production.yml` | Push to `main` | Deploy to production |
| `rollback.yml` | Manual | Rollback production deployment |
| `security.yml` | Schedule | gitleaks secret scan |
| `e2e.yml` | Push / PR | End-to-end tests |

---

## Contributing

1. Fork the repo and create a feature branch off `develop`
2. Follow the existing code style (Rust: `cargo fmt`, TypeScript: `npm run format`)
3. Ensure all checks pass: `cargo test`, `npm test`, `npm run lint`
4. Open a pull request with a clear description of the change

---

*Built by [Fracverse](https://github.com/fracverse)*
