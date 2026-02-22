# Documint Charter

## Classification
- **Canonical URI**: `chittycanon://core/services/documint`
- **Tier**: 4 (Domain)
- **Organization**: chittyapps
- **Domain**: documint.chitty.cc

## Mission

Document signing service with ChittyProof integration. Implements the 11-pillar proof standard for permanent document verification.

## Scope

### IS Responsible For
- Document signing, proof generation, 11-pillar verification standard, permanent records

### IS NOT Responsible For
- Identity generation (ChittyID)
- Token provisioning (ChittyAuth)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyAuth | Authentication |

## API Contract

**Base URL**: https://documint.chitty.cc

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health |

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | chittyapps |

## Compliance

- [ ] Registered in ChittyRegister
- [ ] Health endpoint operational at /health
- [ ] CLAUDE.md present
- [ ] CHARTER.md present
- [ ] CHITTY.md present

---
*Charter Version: 1.0.0 | Last Updated: 2026-02-21*