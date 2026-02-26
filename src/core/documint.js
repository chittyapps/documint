/**
 * DocuMint Core
 * "Mint it. It's permanent."
 *
 * Document minting with ChittyProof - the 11-pillar proof standard.
 * @canon chittycanon://core/services/documint
 */

import { ChittyProof } from './proof.js';
import { ChittySignature } from './signature.js';
import { ChittyChain } from './chain.js';

export class DocuMint {
  constructor(config = {}) {
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.baseUrl || 'https://api.chitty.cc/documint/v1';
    this.chittyId = config.chittyId || null;
    this.signingKeyJwk = config.signingKeyJwk || null;

    // Core components
    this.proof = new ChittyProof(this);
    this.signature = new ChittySignature(this);
    this.chain = new ChittyChain(this);

    this.initialized = false;
  }

  /**
   * Initialize DocuMint
   */
  async initialize() {
    if (this.initialized) return this;

    // Validate API key
    if (this.apiKey) {
      await this.validateApiKey();
    }

    this.initialized = true;
    return this;
  }

  /**
   * Mint a document - creates ChittyProof
   *
   * @param {Object} options
   * @param {Buffer|Uint8Array|string} options.document - Document content or base64
   * @param {string} options.name - Document name
   * @param {string} options.type - Document type (contract, invoice, certificate, etc.)
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<MintedDocument>}
   */
  async mint(options) {
    const { document, name, type = 'document', metadata = {} } = options;

    // Hash the document
    const documentHash = await this.hashDocument(document);

    // Create mint ID
    const mintId = this.generateMintId();

    // Create timestamp
    const timestamp = new Date().toISOString();

    // Create the minted document
    const minted = {
      mintId,
      version: '1.0',

      document: {
        hash: documentHash,
        name,
        type,
        size: this.getDocumentSize(document),
        minted: timestamp
      },

      // ChittyProof (11 pillars) - starts empty, builds as actions happen
      proof: await this.proof.create({
        mintId,
        documentHash,
        timestamp
      }),

      // Chain anchor
      chain: await this.chain.anchor({
        mintId,
        documentHash,
        action: 'MINTED',
        timestamp
      }),

      // Status
      status: 'MINTED',
      createdAt: timestamp,

      // Verification URL
      verifyUrl: `https://chitty.cc/verify/${mintId}`,

      // Metadata
      metadata: {
        ...metadata,
        mintedBy: this.chittyId || 'anonymous',
        mintedAt: timestamp
      }
    };

    return minted;
  }

  /**
   * Sign a minted document
   *
   * @param {string} mintId - The mint ID
   * @param {Object} options
   * @param {string} options.signer - ChittyID of signer
   * @param {string} options.role - Role (creator, signer, witness, etc.)
   * @returns {Promise<SignatureResult>}
   */
  async sign(mintId, options) {
    const { signer, role = 'signer' } = options;

    // Create signature
    const sig = await this.signature.create({
      mintId,
      signer,
      role,
      timestamp: new Date().toISOString()
    });

    // Anchor to chain
    await this.chain.anchor({
      mintId,
      action: 'SIGNED',
      signer,
      role,
      signatureId: sig.signatureId,
      timestamp: sig.timestamp
    });

    // Update proof pillars
    await this.proof.update(mintId, {
      signature: {
        score: 95,
        method: 'ECDSA-P256',
        verified: true,
        signatureId: sig.signatureId
      },
      identity: {
        score: sig.identityScore,
        method: 'ChittyID',
        verified: sig.identityVerified
      }
    });

    return sig;
  }

  /**
   * Attach a related document
   *
   * @param {string} mintId - Primary document mint ID
   * @param {Object} options
   * @param {string} options.attachmentMintId - The attachment's mint ID
   * @param {string} options.relationship - Relationship type
   * @returns {Promise<AttachmentResult>}
   */
  async attach(mintId, options) {
    const { attachmentMintId, relationship } = options;

    const attachment = {
      attachmentId: this.generateAttachmentId(),
      parentMintId: mintId,
      childMintId: attachmentMintId,
      relationship,
      attachedAt: new Date().toISOString()
    };

    // Anchor to chain
    await this.chain.anchor({
      mintId,
      action: 'ATTACHED',
      ...attachment
    });

    return attachment;
  }

  /**
   * Revoke a minted document
   *
   * @param {string} mintId - The mint ID
   * @param {Object} options
   * @param {string} options.reason - Revocation reason
   * @param {string} options.revokedBy - ChittyID of revoker
   * @returns {Promise<RevocationResult>}
   */
  async revoke(mintId, options) {
    const { reason, revokedBy } = options;

    const revocation = {
      revocationId: this.generateRevocationId(),
      mintId,
      reason,
      revokedBy,
      revokedAt: new Date().toISOString(),
      auditPreserved: true // Audit trail is permanent
    };

    // Anchor to chain (revocation is permanent record)
    await this.chain.anchor({
      mintId,
      action: 'REVOKED',
      ...revocation
    });

    return revocation;
  }

  /**
   * Verify a minted document
   *
   * @param {string} mintId - The mint ID
   * @returns {Promise<VerificationResult>}
   */
  async verify(mintId) {
    return await this.proof.verify(mintId);
  }

  /**
   * Get full proof bundle
   *
   * @param {string} mintId - The mint ID
   * @returns {Promise<ProofBundle>}
   */
  async bundle(mintId) {
    return await this.proof.bundle(mintId);
  }

  /**
   * Export as PDX package (portable)
   *
   * @param {string} mintId - The mint ID
   * @returns {Promise<PDXPackage>}
   */
  async export(mintId) {
    return await this.proof.exportPDX(mintId);
  }

  // ============ Internal Methods ============

  async hashDocument(document) {
    let data;
    try {
      if (typeof document === 'string') {
        data = Uint8Array.from(atob(document), c => c.charCodeAt(0));
      } else if (document instanceof Uint8Array) {
        data = document;
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(document)) {
        data = new Uint8Array(document);
      } else {
        throw new Error('Document must be Buffer, Uint8Array, or base64 string');
      }
    } catch (error) {
      if (error.message.includes('Document must be')) throw error;
      throw new Error(`Invalid document format: ${error.message}`);
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  getDocumentSize(document) {
    if (typeof document === 'string') {
      return Math.ceil(document.length * 0.75);
    }
    return document.length || document.byteLength || 0;
  }

  generateMintId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DM-${Date.now().toString(36)}-${random}`.toUpperCase();
  }

  generateAttachmentId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DA-${Date.now().toString(36)}-${random}`.toUpperCase();
  }

  generateRevocationId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DR-${Date.now().toString(36)}-${random}`.toUpperCase();
  }

  async validateApiKey() {
    if (!this.apiKey) return false;
    // API key is validated at the API layer against env.API_KEY
    // This validates format only — real auth happens in the worker
    if (typeof this.apiKey !== 'string' || this.apiKey.length < 16) {
      throw new Error('Invalid API key format');
    }
    return true;
  }
}

export default DocuMint;
