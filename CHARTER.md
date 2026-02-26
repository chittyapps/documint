---
uri: chittycanon://docs/ops/policy/documint-charter
namespace: chittycanon://docs/ops
type: policy
version: 1.0.0
status: CERTIFIED
registered_with: chittycanon://core/services/canon
title: "DocuMint Charter"
certifier: chittycanon://core/services/chittycertify
visibility: PUBLIC
author: "ChittyApps"
created: 2026-02-25T00:00:00Z
modified: 2026-02-26T00:00:00Z
certified: 2026-02-25T00:00:00Z
tags: [documint, document-signing, chittyproof, tier-4, domain]
category: domain-services
---

# DocuMint Charter

## Classification
- **Canonical URI**: `chittycanon://core/services/documint`
- **Tier**: 4 (Domain)
- **Organization**: chittyapps
- **Domain**: documint.chitty.cc

## Mission

Document signing service with ChittyProof integration. Implements the 11-pillar proof standard for permanent document verification with real ECDSA-P256 cryptographic signatures, drand temporal anchoring, and hash-chained immutable ledger.

## Scope

### IS Responsible For
- Document minting (SHA-256 hash, unique mint ID)
- ECDSA-P256 cryptographic signing with witness attestation
- ChittyProof 11-pillar proof generation and scoring
- Hash-chained immutable ledger (ChittyChain) with drand anchoring
- Document attachment and revocation with audit preservation
- Public proof verification

### IS NOT Responsible For
- Identity generation (ChittyID)
- Token provisioning (ChittyAuth)
- Certified delivery (ChittyDLVR)
- Service registration (ChittyRegister)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyAuth | Authentication |
| External | drand.cloudflare.com | Temporal anchoring |
| Storage | Cloudflare KV | Proof cache |
| Storage | Cloudflare DO | Proof state |

## API Contract

**Base URL**: https://documint.chitty.cc

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | No | Health check |
| `/api/v1/status` | GET | No | Service metadata |
| `/documint/v1/mint` | POST | Yes | Mint a document |
| `/documint/v1/mint/:mintId/sign` | POST | Yes | Sign a document |
| `/documint/v1/mint/:mintId/attach` | POST | Yes | Attach document |
| `/documint/v1/mint/:mintId/revoke` | POST | Yes | Revoke document |
| `/documint/v1/mint/:mintId` | GET | Yes | Get proof/verify |
| `/verify/:proofId` | GET | No | Public verification |

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | chittyapps |
| Contact | documint@chitty.cc |

## Compliance

- [x] Service registered in ChittyRegistry
- [x] Health endpoint operational at /health
- [x] CLAUDE.md development guide present
- [x] CHARTER.md present
- [x] CHITTY.md present

---
*Charter Version: 1.0.0 | Last Updated: 2026-02-25*
