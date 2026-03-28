/**
 * ChittyChain - Immutable Ledger Integration
 * "Every moment. Every actor. Forever."
 *
 * Hash-chained event log with drand temporal anchoring.
 * Persisted to Cloudflare KV (DOCUMINT_CACHE) for durability across worker invocations.
 * @canon chittycanon://core/services/documint
 */

const DRAND_URL = 'https://drand.cloudflare.com';
const DRAND_CHAIN_HASH = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce';

// KV key prefixes
const KEY_ANCHOR = 'anchor:';
const KEY_CHAIN = 'mint-chain:';
const KEY_LAST_HASH = 'chain:last-hash';

export class ChittyChain {
  constructor(documint, kv) {
    this.documint = documint;
    this.chainUrl = 'https://chain.chitty.cc';
    this.kv = kv || null;
    // In-memory fallback when KV is unavailable (dev/test only)
    this._anchors = new Map();
    this._events = new Map();
    this._lastAnchorHash = null;
  }

  /**
   * Fetch latest drand round from Cloudflare's beacon
   */
  async fetchDrandRound() {
    try {
      const response = await fetch(`${DRAND_URL}/${DRAND_CHAIN_HASH}/public/latest`);
      if (!response.ok) {
        console.error(`drand fetch failed: HTTP ${response.status} ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      if (!data.round || !data.randomness || !data.signature) {
        console.error('drand returned incomplete data:', JSON.stringify(data));
        return null;
      }
      return {
        round: data.round,
        randomness: data.randomness,
        signature: data.signature
      };
    } catch (error) {
      // drand is supplementary — anchor still valid without it
      console.error('drand fetch error (anchor proceeds without temporal proof):', error.message);
      return null;
    }
  }

  /**
   * Load the last anchor hash from KV for chain continuity
   */
  async loadLastHash() {
    if (this._lastAnchorHash) return this._lastAnchorHash;
    if (this.kv) {
      try {
        this._lastAnchorHash = await this.kv.get(KEY_LAST_HASH);
      } catch (error) {
        console.error('Failed to load last anchor hash from KV:', error.message);
      }
    }
    return this._lastAnchorHash;
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
    await this.loadLastHash();
    const previousHash = this._lastAnchorHash;
    const chainHash = await this.hashEvent({
      eventHash,
      previousHash: previousHash || 'GENESIS',
      anchorId,
      timestamp,
      drandRound: drand?.round || null,
      drandRandomness: drand?.randomness || null
    });

    // Get current block height from KV or memory
    let blockHeight = this._anchors.size + 1;
    if (this.kv) {
      try {
        const meta = await this.kv.get('chain:meta', { type: 'json' });
        blockHeight = (meta?.blockHeight || 0) + 1;
      } catch { /* use fallback */ }
    }

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
      blockHeight,
      txId: `TX-${anchorId}`,
      status: 'CONFIRMED',

      // Timestamps
      anchoredAt: timestamp,
      confirmedAt: new Date().toISOString()
    };

    // Persist to KV if available, otherwise in-memory fallback
    if (this.kv) {
      try {
        // Store anchor by ID
        await this.kv.put(`${KEY_ANCHOR}${anchorId}`, JSON.stringify(anchor));

        // Append to mint's chain index
        const chainKey = `${KEY_CHAIN}${event.mintId}`;
        const existing = await this.kv.get(chainKey, { type: 'json' }) || [];
        existing.push(anchorId);
        await this.kv.put(chainKey, JSON.stringify(existing));

        // Update last hash and block height
        await this.kv.put(KEY_LAST_HASH, chainHash);
        await this.kv.put('chain:meta', JSON.stringify({ blockHeight, lastAnchorId: anchorId }));
      } catch (error) {
        console.error('KV persistence failed for anchor, falling back to memory:', error.message);
        this._anchors.set(anchorId, anchor);
        const mintEvents = this._events.get(event.mintId) || [];
        mintEvents.push(anchor);
        this._events.set(event.mintId, mintEvents);
      }
    } else {
      this._anchors.set(anchorId, anchor);
      const mintEvents = this._events.get(event.mintId) || [];
      mintEvents.push(anchor);
      this._events.set(event.mintId, mintEvents);
    }

    this._lastAnchorHash = chainHash;
    return anchor;
  }

  /**
   * Verify an anchor exists and its chain hash is valid
   */
  async verify(anchorId) {
    const anchor = await this.getAnchor(anchorId);

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
   * Get an anchor by ID from KV or memory
   */
  async getAnchor(anchorId) {
    if (this.kv) {
      try {
        const data = await this.kv.get(`${KEY_ANCHOR}${anchorId}`, { type: 'json' });
        if (data) return data;
      } catch (error) {
        console.error('KV read failed for anchor:', error.message);
      }
    }
    return this._anchors.get(anchorId) || null;
  }

  /**
   * Verify a drand round against the public beacon
   */
  async verifyDrandRound(round, expectedRandomness) {
    try {
      const response = await fetch(`${DRAND_URL}/${DRAND_CHAIN_HASH}/public/${round}`);
      if (!response.ok) {
        console.error(`drand verification fetch failed for round ${round}: HTTP ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data.randomness === expectedRandomness;
    } catch (error) {
      console.error(`drand verification error for round ${round}:`, error.message);
      return null;
    }
  }

  /**
   * Get full chain history for a mintId
   */
  async history(mintId) {
    let events = [];

    if (this.kv) {
      try {
        const anchorIds = await this.kv.get(`${KEY_CHAIN}${mintId}`, { type: 'json' }) || [];
        for (const id of anchorIds) {
          const anchor = await this.getAnchor(id);
          if (anchor) events.push(anchor);
        }
      } catch (error) {
        console.error('KV read failed for chain history:', error.message);
      }
    }

    // Fall back to memory if KV returned nothing
    if (events.length === 0) {
      events = this._events.get(mintId) || [];
    }

    // Verify chain integrity
    let gaps = 0;
    for (const anchor of events) {
      if (anchor.previousHash === 'GENESIS') continue;
      let found = false;
      // Check KV for predecessor
      if (this.kv) {
        try {
          const keys = await this.kv.list({ prefix: KEY_ANCHOR });
          for (const key of keys.keys) {
            const a = await this.kv.get(key.name, { type: 'json' });
            if (a && a.chainHash === anchor.previousHash) {
              found = true;
              break;
            }
          }
        } catch { /* fall through to memory check */ }
      }
      if (!found) {
        for (const [, a] of this._anchors) {
          if (a.chainHash === anchor.previousHash) {
            found = true;
            break;
          }
        }
      }
      if (!found) gaps++;
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
