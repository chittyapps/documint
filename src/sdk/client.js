/**
 * DocuMint SDK Client
 * For developers integrating DocuMint into their apps.
 *
 * Usage:
 *   import { DocuMint } from '@chitty/documint';
 *
 *   const mint = new DocuMint({ apiKey: 'your-api-key' });
 *
 *   // Mint a document
 *   const doc = await mint.create({ document: pdfBuffer, name: 'Contract.pdf' });
 *
 *   // Sign it
 *   await mint.sign(doc.mintId, { signer: 'chittyid-123' });
 *
 *   // Verify anytime
 *   const proof = await mint.verify(doc.mintId);
 */

export class DocuMintClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.chitty.cc/documint/v1';
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      throw new DocuMintError('API key required', 'AUTH_REQUIRED', 401);
    }
  }

  // ============ Document Lifecycle ============

  /**
   * Mint a new document
   */
  async create(options) {
    const { document, name, type, metadata } = options;

    // Convert document to base64 if needed
    const documentBase64 = this.toBase64(document);

    return this.request('POST', '/mint', {
      document: documentBase64,
      name,
      type,
      metadata
    });
  }

  /**
   * Sign a minted document
   */
  async sign(mintId, options) {
    const { signer, role } = options;

    return this.request('POST', `/mint/${mintId}/sign`, {
      signer,
      role
    });
  }

  /**
   * Attach a related document
   */
  async attach(mintId, options) {
    const { attachmentMintId, relationship } = options;

    return this.request('POST', `/mint/${mintId}/attach`, {
      attachmentMintId,
      relationship
    });
  }

  /**
   * Revoke a document (audit trail preserved)
   */
  async revoke(mintId, options) {
    const { reason, revokedBy } = options;

    return this.request('POST', `/mint/${mintId}/revoke`, {
      reason,
      revokedBy
    });
  }

  // ============ Verification ============

  /**
   * Verify a minted document
   */
  async verify(mintId) {
    return this.request('GET', `/verify/${mintId}`);
  }

  /**
   * Get full proof bundle
   */
  async bundle(mintId) {
    return this.request('GET', `/mint/${mintId}/bundle`);
  }

  /**
   * Get audit trail
   */
  async audit(mintId) {
    return this.request('GET', `/mint/${mintId}/audit`);
  }

  // ============ Export ============

  /**
   * Export as PDX (portable)
   */
  async export(mintId, options = {}) {
    return this.request('GET', `/mint/${mintId}/export`, options);
  }

  /**
   * Generate court-ready report
   */
  async report(mintId) {
    return this.request('GET', `/mint/${mintId}/report`);
  }

  // ============ Audit Engine ============

  /**
   * Score any document/system against 11 pillars
   */
  async auditScore(options) {
    return this.request('POST', '/audit/score', options);
  }

  /**
   * Compare a system to ChittyProof standard
   */
  async auditCompare(options) {
    return this.request('POST', '/audit/compare', options);
  }

  // ============ Internal ============

  async request(method, path, data) {
    const url = `${this.baseUrl}${path}`;

    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const options = {
      method,
      headers
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new DocuMintError(error.message || 'Request failed', error.code || 'REQUEST_FAILED', response.status);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new DocuMintError('Request timeout', 'TIMEOUT', 408);
      }
      throw error;
    }
  }

  toBase64(data) {
    if (typeof data === 'string') {
      return data; // Assume already base64
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return data.toString('base64');
    }
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
    throw new Error('Unsupported document format');
  }
}

export class DocuMintError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'DocuMintError';
    this.code = code;
    this.status = status;
  }
}

export default DocuMintClient;
