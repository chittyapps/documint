/**
 * ChittyChain - Immutable Ledger Integration
 * "Every moment. Every actor. Forever."
 *
 * Uses in-memory event log with cryptographic hashing.
 * Each anchor is hash-chained to the previous, forming a tamper-evident log.
 * Anchors to Cloudflare's drand beacon for publicly verifiable timestamps.
 */

const DRAND_URL = 'https://drand.cloudflare.com';
const DRAND_CHAIN_HASH = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce';

export class ChittyChain {
  constructor(documint) {
    this.documint = documint;
    this.chainUrl = 'https://chain.chitty.cc';
    // In-memory chain store (production: KV or Durable Objects)
    this._anchors = new Map();
    this._events = new Map(); // mintId -> [anchor, anchor, ...]
    this._lastAnchorHash = null;
  }

  /**
   * Fetch latest drand round from Cloudflare's beacon
   */
  async fetchDrandRound() {
    try {
      const response = await fetch(`${DRAND_URL}/${DRAND_CHAIN_HASH}/public/latest`);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        round: data.round,
        randomness: data.randomness,
        signature: data.signature
      };
    } catch {
      // drand is supplementary — anchor still valid without it
      return null;
    }
  }

  /**
   * Anchor an event to ChittyChain
   */
  async anchor(event) {
    const anchorId = this.generateAnchorId();
    const timestamp = event.timestamp || new Date().toISOString();

    // Fetch drand round for public temporal anchoring
    const drand = await this.fetchDrandRound();

    // Hash the event with recursive canonicalization
    const eventHash = await this.hashEvent(event);

    // Chain to previous anchor (hash-linked list)
    // Include drand randomness in the chain hash for public verifiability
    const previousHash = this._lastAnchorHash;
    const chainHash = await this.hashEvent({
      eventHash,
      previousHash: previousHash || 'GENESIS',
      anchorId,
      timestamp,
      drandRound: drand?.round || null,
      drandRandomness: drand?.randomness || null
    });

    const anchor = {
      anchorId,
      chainId: 'chittychain-mainnet',

      // Event data
      event: {
        mintId: event.mintId,
        action: event.action,
        actor: event.signer || event.actor || 'system',
        timestamp,
        data: this.sanitizeEventData(event)
      },

      // Cryptographic hash of event
      eventHash,

      // Chain linkage
      previousHash: previousHash || 'GENESIS',
      chainHash,

      // drand temporal anchor
      drand: drand ? {
        round: drand.round,
        randomness: drand.randomness,
        signature: drand.signature,
        beacon: DRAND_URL,
        chainHash: DRAND_CHAIN_HASH
      } : null,

      // Block confirmation (sequential block height)
      blockHeight: this._anchors.size + 1,
      txId: `TX-${anchorId}`,
      status: 'CONFIRMED',

      // Timestamps
      anchoredAt: timestamp,
      confirmedAt: new Date().toISOString()
    };

    // Store the anchor
    this._anchors.set(anchorId, anchor);
    this._lastAnchorHash = chainHash;

    // Index by mintId
    const mintEvents = this._events.get(event.mintId) || [];
    mintEvents.push(anchor);
    this._events.set(event.mintId, mintEvents);

    return anchor;
  }

  /**
   * Verify an anchor exists and its chain hash is valid
   */
  async verify(anchorId) {
    const anchor = this._anchors.get(anchorId);

    if (!anchor) {
      return {
        anchorId,
        exists: false,
        verified: false,
        error: 'Anchor not found',
        verifiedAt: new Date().toISOString()
      };
    }

    // Re-compute the chain hash and verify it matches
    const recomputedHash = await this.hashEvent({
      eventHash: anchor.eventHash,
      previousHash: anchor.previousHash,
      anchorId: anchor.anchorId,
      timestamp: anchor.anchoredAt,
      drandRound: anchor.drand?.round || null,
      drandRandomness: anchor.drand?.randomness || null
    });

    const valid = recomputedHash === anchor.chainHash;

    // Optionally verify drand round against public beacon
    let drandVerified = null;
    if (anchor.drand) {
      drandVerified = await this.verifyDrandRound(anchor.drand.round, anchor.drand.randomness);
    }

    return {
      anchorId,
      exists: true,
      verified: valid,
      tampered: !valid,
      blockHeight: anchor.blockHeight,
      drand: drandVerified !== null ? {
        verified: drandVerified,
        round: anchor.drand.round
      } : null,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Verify a drand round against the public beacon
   */
  async verifyDrandRound(round, expectedRandomness) {
    try {
      const response = await fetch(`${DRAND_URL}/${DRAND_CHAIN_HASH}/public/${round}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.randomness === expectedRandomness;
    } catch {
      return null;
    }
  }

  /**
   * Get full chain history for a mintId
   */
  async history(mintId) {
    const events = this._events.get(mintId) || [];

    // Verify chain integrity
    let gaps = 0;
    for (let i = 1; i < events.length; i++) {
      if (events[i].previousHash !== events[i - 1].chainHash) {
        gaps++;
      }
    }

    return {
      mintId,
      events: events.map(a => ({
        anchorId: a.anchorId,
        action: a.event.action,
        actor: a.event.actor,
        timestamp: a.event.timestamp,
        blockHeight: a.blockHeight,
        eventHash: a.eventHash,
        drandRound: a.drand?.round || null
      })),
      complete: events.length > 0,
      gaps,
      queriedAt: new Date().toISOString()
    };
  }

  /**
   * Hash event using recursive JCS-style canonicalization + SHA-256
   */
  async hashEvent(event) {
    const canonical = this.canonicalize(event);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Recursive key-sorting canonicalization (JCS-style, RFC 8785 compatible)
   */
  canonicalize(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'boolean' || typeof obj === 'number') return JSON.stringify(obj);
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(item => this.canonicalize(item)).join(',') + ']';
    if (typeof obj === 'object') {
      const keys = Object.keys(obj).sort();
      const pairs = keys
        .filter(k => obj[k] !== undefined)
        .map(k => JSON.stringify(k) + ':' + this.canonicalize(obj[k]));
      return '{' + pairs.join(',') + '}';
    }
    return JSON.stringify(obj);
  }

  /**
   * Sanitize event data (remove sensitive info from chain)
   */
  sanitizeEventData(event) {
    const { mintId, action, signer, actor, role, timestamp, signatureId, attachmentId, revocationId, relationship, reason } = event;

    return {
      mintId,
      action,
      signer: signer || actor,
      role,
      timestamp,
      signatureId,
      attachmentId,
      revocationId,
      relationship,
      reason
    };
  }

  generateAnchorId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `ACH-${Date.now().toString(36)}-${random}`.toUpperCase();
  }
}

export default ChittyChain;
