/**
 * DocuMint Core Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocuMint } from '../src/core/documint.js';

describe('DocuMint', () => {
  let mint;

  beforeEach(() => {
    mint = new DocuMint({ apiKey: 'test-key-minimum-16ch', chittyId: 'test-chitty-id' });
  });

  describe('constructor', () => {
    it('initializes with config', () => {
      expect(mint.apiKey).toBe('test-key-minimum-16ch');
      expect(mint.chittyId).toBe('test-chitty-id');
      expect(mint.initialized).toBe(false);
    });

    it('has default baseUrl', () => {
      expect(mint.baseUrl).toBe('https://api.chitty.cc/documint/v1');
    });

    it('creates core components', () => {
      expect(mint.proof).toBeDefined();
      expect(mint.signature).toBeDefined();
      expect(mint.chain).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('sets initialized to true', async () => {
      await mint.initialize();
      expect(mint.initialized).toBe(true);
    });

    it('is idempotent', async () => {
      const result1 = await mint.initialize();
      const result2 = await mint.initialize();
      expect(result1).toBe(result2);
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await mint.initialize();
    });

    it('mints a document from Uint8Array', async () => {
      const doc = new TextEncoder().encode('test contract content');
      const result = await mint.mint({
        document: doc,
        name: 'Contract.pdf',
        type: 'contract'
      });

      expect(result.mintId).toMatch(/^DM-/);
      expect(result.status).toBe('MINTED');
      expect(result.document.name).toBe('Contract.pdf');
      expect(result.document.type).toBe('contract');
      expect(result.document.hash).toHaveLength(64); // SHA-256 hex
      expect(result.verifyUrl).toContain('chitty.cc/verify/');
    });

    it('mints a document from base64 string', async () => {
      const base64 = btoa('test contract content');
      const result = await mint.mint({
        document: base64,
        name: 'Invoice.pdf'
      });

      expect(result.mintId).toMatch(/^DM-/);
      expect(result.document.hash).toHaveLength(64);
    });

    it('generates unique mint IDs', async () => {
      const doc = new TextEncoder().encode('content');
      const result1 = await mint.mint({ document: doc, name: 'a.pdf' });
      const result2 = await mint.mint({ document: doc, name: 'b.pdf' });

      expect(result1.mintId).not.toBe(result2.mintId);
    });

    it('includes ChittyProof with 11 pillars', async () => {
      const doc = new TextEncoder().encode('content');
      const result = await mint.mint({ document: doc, name: 'test.pdf' });

      const pillars = result.proof.pillars;
      expect(pillars.signature).toBeDefined();
      expect(pillars.identity).toBeDefined();
      expect(pillars.document).toBeDefined();
      expect(pillars.delivery).toBeDefined();
      expect(pillars.authority).toBeDefined();
      expect(pillars.witness).toBeDefined();
      expect(pillars.durability).toBeDefined();
      expect(pillars.chain).toBeDefined();
      expect(pillars.verifiable).toBeDefined();
      expect(pillars.revocable).toBeDefined();
      expect(pillars.caseReady).toBeDefined();
    });

    it('anchors to chain on mint', async () => {
      const doc = new TextEncoder().encode('content');
      const result = await mint.mint({ document: doc, name: 'test.pdf' });

      expect(result.chain).toBeDefined();
      expect(result.chain.status).toBe('CONFIRMED');
      expect(result.chain.event.action).toBe('MINTED');
    });

    it('includes metadata with mintedBy', async () => {
      const doc = new TextEncoder().encode('content');
      const result = await mint.mint({
        document: doc,
        name: 'test.pdf',
        metadata: { custom: 'value' }
      });

      expect(result.metadata.mintedBy).toBe('test-chitty-id');
      expect(result.metadata.custom).toBe('value');
    });

    it('produces consistent hash for same content', async () => {
      const content = new TextEncoder().encode('identical content');
      const result1 = await mint.mint({ document: content, name: 'a.pdf' });
      const result2 = await mint.mint({ document: content, name: 'b.pdf' });

      expect(result1.document.hash).toBe(result2.document.hash);
    });
  });

  describe('sign', () => {
    let mintedDoc;

    beforeEach(async () => {
      await mint.initialize();
      const doc = new TextEncoder().encode('contract to sign');
      mintedDoc = await mint.mint({ document: doc, name: 'contract.pdf' });
    });

    it('creates a signature', async () => {
      const sig = await mint.sign(mintedDoc.mintId, {
        signer: 'signer-chitty-id',
        role: 'signer'
      });

      expect(sig.signatureId).toMatch(/^SIG-/);
      expect(sig.mintId).toBe(mintedDoc.mintId);
      expect(sig.signer).toBe('signer-chitty-id');
      expect(sig.role).toBe('signer');
      expect(sig.status).toBe('VALID');
    });

    it('verifies identity on sign', async () => {
      const sig = await mint.sign(mintedDoc.mintId, {
        signer: 'signer-id'
      });

      expect(sig.identityVerified).toBe(true);
      expect(sig.identityScore).toBe(90);
      expect(sig.identityMethod).toBe('ChittyID');
    });

    it('includes witness attestation', async () => {
      const sig = await mint.sign(mintedDoc.mintId, {
        signer: 'signer-id'
      });

      expect(sig.witnessed).toBe(true);
      expect(sig.witness).toBe('ChittyOS');
    });

    it('defaults role to signer', async () => {
      const sig = await mint.sign(mintedDoc.mintId, {
        signer: 'signer-id'
      });

      expect(sig.role).toBe('signer');
    });
  });

  describe('attach', () => {
    it('creates an attachment link', async () => {
      await mint.initialize();
      const result = await mint.attach('DM-PARENT', {
        attachmentMintId: 'DM-CHILD',
        relationship: 'amendment'
      });

      expect(result.attachmentId).toMatch(/^DA-/);
      expect(result.parentMintId).toBe('DM-PARENT');
      expect(result.childMintId).toBe('DM-CHILD');
      expect(result.relationship).toBe('amendment');
    });
  });

  describe('revoke', () => {
    it('creates a revocation with permanent audit', async () => {
      await mint.initialize();
      const result = await mint.revoke('DM-SOME-ID', {
        reason: 'Mutual termination',
        revokedBy: 'revoker-id'
      });

      expect(result.revocationId).toMatch(/^DR-/);
      expect(result.reason).toBe('Mutual termination');
      expect(result.revokedBy).toBe('revoker-id');
      expect(result.auditPreserved).toBe(true);
    });
  });

  describe('hashDocument', () => {
    it('throws on invalid input', async () => {
      await expect(mint.hashDocument(12345)).rejects.toThrow();
    });

    it('produces 64-char hex SHA-256', async () => {
      const hash = await mint.hashDocument(new TextEncoder().encode('test'));
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });
});
