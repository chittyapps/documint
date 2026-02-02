/**
 * Public Verification
 * Anyone can verify a ChittyProof without authentication.
 *
 * Usage:
 *   // Via URL
 *   https://chitty.cc/verify/DM-ABC123
 *
 *   // Via CLI
 *   npx @chitty/documint verify DM-ABC123
 *
 *   // Via code
 *   import { PublicVerify } from '@chitty/documint/verify';
 *   const result = await PublicVerify.verify('DM-ABC123');
 */

export class PublicVerify {
  static baseUrl = 'https://api.chitty.cc/verify';

  /**
   * Verify a proof publicly (no auth required)
   */
  static async verify(proofId) {
    const url = `${this.baseUrl}/${proofId}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          proofId,
          found: false,
          verified: false,
          error: 'Proof not found'
        };
      }
      throw new Error(`Verification failed: ${response.statusText}`);
    }

    const proof = await response.json();

    return {
      proofId,
      found: true,
      verified: proof.verified,
      status: proof.overall?.status || 'UNKNOWN',
      pillars: proof.pillars,
      overall: proof.overall,
      document: {
        name: proof.document?.name,
        hash: proof.document?.hash,
        minted: proof.document?.minted
      },
      signatures: proof.signatures || [],
      chain: {
        anchored: proof.chain?.anchored,
        blockHeight: proof.chain?.blockHeight
      },
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Verify a signature
   */
  static async verifySignature(signatureId) {
    const url = `${this.baseUrl}/sig/${signatureId}`;

    const response = await fetch(url);

    if (!response.ok) {
      return { signatureId, valid: false, error: 'Signature not found' };
    }

    return response.json();
  }

  /**
   * Get verification badge HTML
   */
  static getBadge(proofId, options = {}) {
    const { size = 'medium', theme = 'light' } = options;

    const sizes = {
      small: { width: 120, height: 40 },
      medium: { width: 200, height: 60 },
      large: { width: 280, height: 80 }
    };

    const { width, height } = sizes[size] || sizes.medium;

    return `<a href="https://chitty.cc/verify/${proofId}" target="_blank" rel="noopener">
  <img
    src="https://chitty.cc/badge/${proofId}?theme=${theme}"
    alt="Verified by ChittyProof"
    width="${width}"
    height="${height}"
  />
</a>`;
  }

  /**
   * Get verification QR code URL
   */
  static getQRCode(proofId, options = {}) {
    const { size = 200 } = options;
    return `https://chitty.cc/qr/${proofId}?size=${size}`;
  }

  /**
   * Generate embed code for verification widget
   */
  static getEmbed(proofId, options = {}) {
    const { width = '100%', height = 400 } = options;

    return `<iframe
  src="https://chitty.cc/embed/verify/${proofId}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allowtransparency="true"
></iframe>`;
  }
}

export default PublicVerify;
