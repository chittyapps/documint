# DocuMint

Document signing service with ChittyProof 11-pillar standard. Cloudflare Worker at `documint.chitty.cc`.

## Commands

```bash
npm install          # Install dependencies
npm test             # Run tests (vitest)
npm run dev          # Wrangler dev server
npm run deploy       # Deploy to Cloudflare Workers
npm run lint         # ESLint
npm run build        # esbuild bundle
```

## Architecture

```
src/
├── worker.js           # CF Worker entry point, health, queue, ProofStateDO
├── api/endpoints.js    # API routes, auth (ECDSA hash-then-XOR), CORS
├── core/
│   ├── documint.js     # Mint orchestrator (mint, sign, attach, revoke)
│   ├── signature.js    # ECDSA-P256-SHA256 signing via Web Crypto API
│   ├── chain.js        # Hash-chained immutable ledger + drand anchoring
│   └── proof.js        # ChittyProof 11-pillar scoring engine
├── sdk/client.js       # SDK client for external consumers
├── verify/public.js    # Public verification badges + embeds
└── index.js            # Package exports
```

## Key Patterns

- **Signing**: ECDSA-P256-SHA256 via `crypto.subtle`. Persistent key from `SIGNING_KEY_JWK` env, ephemeral fallback with warning.
- **Auth**: Bearer token validated against `CHITTY_AUTH_SERVICE_TOKEN` via constant-time hash-then-XOR comparison.
- **Chain**: Each anchor hash-chains to the previous via SHA-256. drand beacon provides temporal proof.
- **Proof**: 11 pillars scored with dual technical/arguable weights.
- **IDs**: `DM-` (mint), `SIG-` (signature), `DA-` (attachment), `DR-` (revocation), `CPF-` (proof), `ACH-` (anchor).

## Environment

| Secret | Purpose |
|--------|---------|
| `CHITTY_AUTH_SERVICE_TOKEN` | Bearer token auth |
| `SIGNING_KEY_JWK` | Persistent ECDSA P-256 private key (JWK) |
| `INTERNAL_SERVICE_TOKEN` | Durable Object internal auth |
| `CHITTY_ID` | Service identity |

## Routes

- `documint.chitty.cc/*` — Primary domain
- `api.chitty.cc/documint/*` — API gateway
