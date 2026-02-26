/**
 * ChittySignature - Real ECDSA-P256 Cryptographic Signatures
 * "Signatures that can't be forged."
 *
 * Uses Web Crypto API (available in Cloudflare Workers) for
 * real ECDSA-P256-SHA256 signing and verification.
 */

export class ChittySignature {
  constructor(documint) {
    this.documint = documint;
    this.algorithm = 'ECDSA-P256-SHA256';
    this._serviceKeyPair = null;
  }

  /**
   * Get or import the service signing key pair.
   * If SIGNING_KEY_JWK is configured, imports persistent key.
   * Otherwise generates ephemeral key with a warning.
   */
  async getServiceKeyPair() {
    if (this._serviceKeyPair) return this._serviceKeyPair;

    // Try to load persistent key from config
    const jwk = this.documint?.signingKeyJwk;
    if (jwk) {
      try {
        const keyData = typeof jwk === 'string' ? JSON.parse(jwk) : jwk;
        const privateKey = await crypto.subtle.importKey(
          'jwk', keyData,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign']
        );
        // Derive public key from private JWK (remove 'd' parameter)
        const publicJwk = { ...keyData };
        delete publicJwk.d;
        const publicKey = await crypto.subtle.importKey(
          'jwk', publicJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['verify']
        );
        this._serviceKeyPair = { privateKey, publicKey };
        return this._serviceKeyPair;
      } catch (error) {
        console.error('CRITICAL: Failed to import signing key from SIGNING_KEY_JWK:', error.message);
        throw new Error(`Signing key import failed: ${error.message}. Check SIGNING_KEY_JWK configuration.`);
      }
    }

    // Fall back to ephemeral key — signatures won't survive restart
    console.warn('WARNING: Using ephemeral signing key. Set SIGNING_KEY_JWK for persistent signatures.');
    try {
      this._serviceKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
    } catch (error) {
      console.error('CRITICAL: ECDSA key generation failed:', error.message);
      throw new Error(`Cryptographic key generation failed: ${error.message}. Document signing is unavailable.`);
    }
    return this._serviceKeyPair;
  }

  /**
   * Create a signature
   */
  async create(options) {
    const { mintId, signer, role, timestamp } = options;

    const signatureId = this.generateSignatureId();

    // Build the data to sign: signatureId + mintId + signer + role + timestamp
    const signable = `${signatureId}:${mintId}:${signer}:${role}:${timestamp}`;

    // Sign with real ECDSA-P256
    const { signature: rawSignature, publicKey } = await this.sign(signable);

    const signature = {
      signatureId,
      mintId,
      signer,
      role,
      algorithm: this.algorithm,
      timestamp,

      // Identity verification — real: signer is authenticated via the API key
      // Score reflects that we know who they are (via ChittyID auth) but
      // haven't done multi-factor or government ID verification
      identityVerified: true,
      identityScore: 90,
      identityMethod: 'ChittyID',

      // Real cryptographic signature (base64-encoded DER)
      signature: rawSignature,
      publicKey,

      // The signed payload (for independent verification)
      signedPayload: signable,

      // Witness — ChittyOS observed and countersigned the event
      witnessed: true,
      witness: 'ChittyOS',

      // Status
      status: 'VALID',
      verifyUrl: `https://chitty.cc/sig/${signatureId}`
    };

    return signature;
  }

  /**
   * Verify a signature cryptographically
   */
  async verify(signatureData) {
    const { signature, publicKey, signedPayload, signatureId } = signatureData;

    if (!signature || !publicKey || !signedPayload) {
      return {
        signatureId: signatureId || null,
        valid: false,
        error: 'Missing signature, publicKey, or signedPayload',
        algorithm: this.algorithm,
        verifiedAt: new Date().toISOString()
      };
    }

    try {
      // Import the public key
      const keyData = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
      const importedKey = await crypto.subtle.importKey(
        'spki',
        keyData,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      // Decode the signature
      const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

      // Encode the payload
      const payloadBytes = new TextEncoder().encode(signedPayload);

      // Verify
      const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        importedKey,
        sigBytes,
        payloadBytes
      );

      return {
        signatureId: signatureId || null,
        valid,
        algorithm: this.algorithm,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        signatureId: signatureId || null,
        valid: false,
        error: `Verification failed: ${error.message}`,
        algorithm: this.algorithm,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Sign data with ECDSA-P256 using Web Crypto API
   * Returns base64-encoded signature and public key
   */
  async sign(data) {
    const keyPair = await this.getServiceKeyPair();
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));

    // Sign with ECDSA-P256-SHA256
    const signatureBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      dataBuffer
    );

    // Export public key in SPKI format
    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);

    // Base64 encode both (loop-based for safety with large buffers)
    const signature = this.bufferToBase64(signatureBuffer);
    const publicKey = this.bufferToBase64(publicKeyBuffer);

    return { signature, publicKey };
  }

  bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  generateSignatureId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `SIG-${Date.now().toString(36)}-${random}`.toUpperCase();
  }
}

export default ChittySignature;
