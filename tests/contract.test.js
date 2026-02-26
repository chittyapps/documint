/**
 * DocuMint Consumer Contract Tests
 * Verify the API contract works as documented.
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.DOCUMINT_URL || 'https://documint.chitty.cc';
const AUTH_TOKEN = process.env.CHITTY_AUTH_SERVICE_TOKEN || '';
const SKIP = !AUTH_TOKEN;

function headers(auth = true) {
  const h = { 'Content-Type': 'application/json' };
  if (auth && AUTH_TOKEN) h['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  return h;
}

describe('DocuMint Contract', () => {
  describe('public endpoints', () => {
    it('GET /health returns status ok', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('DocuMint');
    });

    it('GET /api/v1/status returns service metadata', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/status`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('DocuMint');
      expect(body.version).toBeDefined();
      expect(body.uri).toBe('chittycanon://core/services/documint');
      expect(body.tier).toBe(4);
    });
  });

  describe('auth enforcement', () => {
    it('POST /documint/v1/mint without auth returns 401', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: 'dGVzdA==', name: 'test.pdf' })
      });
      expect(res.status).toBe(401);
    });

    it('POST /documint/v1/mint with bad token returns 401', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer bad-token' },
        body: JSON.stringify({ document: 'dGVzdA==', name: 'test.pdf' })
      });
      expect(res.status).toBe(401);
    });
  });

  describe.skipIf(SKIP)('authenticated operations', () => {
    let mintId;

    it('POST /documint/v1/mint creates a document', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ document: 'dGVzdCBjb250cmFjdA==', name: 'contract.pdf', type: 'contract' })
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.mintId).toMatch(/^DM-/);
      expect(body.status).toBe('MINTED');
      expect(body.proof).toBeDefined();
      expect(body.chain).toBeDefined();
      expect(body.chain.drand).toBeDefined();
      mintId = body.mintId;
    });

    it('POST /documint/v1/mint/:mintId/sign signs a document', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint/${mintId}/sign`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ signer: 'test-signer', role: 'signer' })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.signatureId).toMatch(/^SIG-/);
      expect(body.status).toBe('VALID');
      expect(body.signature).toBeDefined();
      expect(body.publicKey).toBeDefined();
    });

    it('GET /documint/v1/mint/:mintId returns proof/verify data', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint/${mintId}`, {
        headers: headers()
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mintId).toBe(mintId);
    });

    it('POST /documint/v1/mint rejects missing document', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: 'test.pdf' })
      });
      expect(res.status).toBe(400);
    });

    it('POST /documint/v1/mint rejects invalid JSON', async () => {
      const res = await fetch(`${BASE_URL}/documint/v1/mint`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: 'not json'
      });
      expect(res.status).toBe(400);
    });
  });
});
