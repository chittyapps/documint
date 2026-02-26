---
uri: chittycanon://docs/ops/architecture/documint
namespace: chittycanon://docs/ops
type: architecture
version: 1.0.0
status: PENDING
registered_with: chittycanon://core/services/canon
title: "DocuMint"
certifier: chittycanon://core/services/chittycertify
visibility: PUBLIC
---

# DocuMint

> `chittycanon://core/services/documint` | Tier 4 (Domain) | documint.chitty.cc

## What It Does

Document signing with ChittyProof 11-pillar proof standard. Mint it. It's permanent.

## Architecture

Cloudflare Worker deployed at documint.chitty.cc with Durable Objects for proof state.

### Stack
- **Runtime**: Cloudflare Workers
- **Language**: JavaScript (ESM)
- **Storage**: Cloudflare KV (proof cache, document cache) + Durable Objects (proof state)
- **Crypto**: Web Crypto API (ECDSA-P256-SHA256)
- **Temporal**: drand.cloudflare.com beacon

### Key Components
- `src/worker.js` — Entry point, health, queue handler, ProofStateDO
- `src/api/endpoints.js` — API routes, auth, CORS
- `src/core/documint.js` — Mint orchestrator
- `src/core/signature.js` — ECDSA-P256 signing and verification
- `src/core/chain.js` — Hash-chained immutable ledger with drand anchoring
- `src/core/proof.js` — ChittyProof 11-pillar scoring
- `src/sdk/client.js` — SDK for external consumers
- `src/verify/public.js` — Public verification badges

## ChittyOS Ecosystem

### Certification
- **Badge**: Chitty Compliant
- **Certifier**: ChittyCertify (`chittycanon://core/services/chittycertify`)
- **Last Certified**: 2026-02-25

### ChittyDNA
- **Lineage**: root (original service)
- **Relationship**: Sibling to ChittyDLVR (provides mintId for delivery)

### Dependencies
| Service | Purpose |
|---------|---------|
| ChittyAuth | Token validation |
| drand.cloudflare.com | Temporal anchoring |

### Endpoints
| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/health` | GET | No | Health check |
| `/api/v1/status` | GET | No | Service metadata |
| `/documint/v1/mint` | POST | Yes | Mint document |
| `/documint/v1/mint/:mintId/sign` | POST | Yes | Sign document |
| `/documint/v1/mint/:mintId/attach` | POST | Yes | Attach document |
| `/documint/v1/mint/:mintId/revoke` | POST | Yes | Revoke document |
| `/documint/v1/mint/:mintId` | GET | Yes | Get proof/verify |
| `/verify/:proofId` | GET | No | Public verification |
