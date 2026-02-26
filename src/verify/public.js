/**
 * Public Verification
 * Anyone can verify a ChittyProof without authentication.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class PublicVerify {
  static baseUrl = 'https://api.chitty.cc/verify';

  static async verify(proofId) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/${encodeURIComponent(proofId)}`);
    } catch (error) {
      return {
        proofId,
        found: false,
        verified: false,
        error: `Network error: ${error.message}`
      };
    }

    if (!response.ok) {
      if (response.status === 404) {
        return { proofId, found: false, verified: false, error: 'Proof not found' };
      }
      return { proofId, found: false, verified: false, error: `Server error: ${response.status}` };
    }

    let proof;
    try {
      proof = await response.json();
    } catch {
      return { proofId, found: false, verified: false, error: 'Invalid response from server' };
    }

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

  static async verifySignature(signatureId) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/sig/${encodeURIComponent(signatureId)}`);
    } catch (error) {
      return { signatureId, valid: false, error: `Network error: ${error.message}` };
    }

    if (!response.ok) {
      return { signatureId, valid: false, error: 'Signature not found' };
    }

    try {
      return await response.json();
    } catch {
      return { signatureId, valid: false, error: 'Invalid response from server' };
    }
  }

  static getBadge(proofId, options = {}) {
    const { size = 'medium', theme = 'light' } = options;
    const safeId = escapeHtml(proofId);
    const safeTheme = escapeHtml(theme);
    const sizes = { small: { width: 120, height: 40 }, medium: { width: 200, height: 60 }, large: { width: 280, height: 80 } };
    const { width, height } = sizes[size] || sizes.medium;

    return `<a href="https://chitty.cc/verify/${safeId}" target="_blank" rel="noopener"><img src="https://chitty.cc/badge/${safeId}?theme=${safeTheme}" alt="Verified by ChittyProof" width="${Number(width)}" height="${Number(height)}" /></a>`;
  }

  static getQRCode(proofId, options = {}) {
    const { size = 200 } = options;
    const safeId = encodeURIComponent(proofId);
    return `https://chitty.cc/qr/${safeId}?size=${Number(size)}`;
  }

  static getEmbed(proofId, options = {}) {
    const { width = '100%', height = 400 } = options;
    const safeId = escapeHtml(proofId);
    const safeWidth = escapeHtml(String(width));
    const safeHeight = Number(height);

    return `<iframe src="https://chitty.cc/embed/verify/${safeId}" width="${safeWidth}" height="${safeHeight}" frameborder="0" allowtransparency="true"></iframe>`;
  }
}

export default PublicVerify;
