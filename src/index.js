/**
 * DocuMint
 * "Mint it. It's permanent."
 *
 * Document signing with ChittyProof - the 11-pillar proof standard.
 *
 * @example
 * import { DocuMint } from '@chitty/documint';
 *
 * const mint = new DocuMint({ apiKey: 'your-key' });
 *
 * // Mint a document
 * const doc = await mint.mint({
 *   document: pdfBuffer,
 *   name: 'Contract.pdf'
 * });
 *
 * // Sign it
 * await mint.sign(doc.mintId, { signer: myChittyId });
 *
 * // Verify anytime
 * const proof = await mint.verify(doc.mintId);
 * // proof.pillars → all 11 scores
 * // proof.overall.status → 'IRONCLAD'
 */

// Core
export { DocuMint } from './core/documint.js';
export { ChittyProof } from './core/proof.js';
export { ChittySignature } from './core/signature.js';
export { ChittyChain } from './core/chain.js';

// SDK Client (for API usage)
export { DocuMintClient, DocuMintError } from './sdk/client.js';

// Public verification
export { PublicVerify } from './verify/public.js';

// Default export
export { DocuMint as default } from './core/documint.js';

// Version
export const VERSION = '1.0.0';

// Pillar names for reference
export const PILLARS = [
  'signature',      // 1. Signature Strength
  'identity',       // 2. Identity Authenticity
  'document',       // 3. Document Integrity
  'delivery',       // 4. Delivery Proof
  'authority',      // 5. Authority
  'witness',        // 6. Witness/Attestation
  'durability',     // 7. Record Durability
  'chain',          // 8. Chain of Custody
  'verifiable',     // 9. Verifiability/Portability
  'revocable',      // 10. Revocability + Audit
  'caseReady'       // 11. Case Architecture
];
