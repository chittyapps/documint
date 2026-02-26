/**
 * DocuMint API Endpoints
 * Cloudflare Worker handlers for DocuMint API
 */

import { DocuMint } from '../core/documint.js';

const ALLOWED_ORIGINS = [
  'https://documint.chitty.cc',
  'https://api.chitty.cc',
  'https://portal.chitty.cc',
  'https://chitty.cc'
];

export class DocuMintAPI {
  constructor(env) {
    this.env = env;
    this.documint = new DocuMint({
      apiKey: env.INTERNAL_API_KEY,
      chittyId: env.CHITTY_ID
    });
  }

  async initialize() {
    await this.documint.initialize();
    return this;
  }

  async handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return this.corsResponse(request);
    }

    try {
      if (path.startsWith('/documint/v1/mint')) {
        return await this.handleMintRoutes(request, path, method);
      }

      if (path.startsWith('/documint/v1/verify') || path.startsWith('/verify/')) {
        return await this.handleVerifyRoutes(request, path, method);
      }

      if (path.startsWith('/documint/v1/audit')) {
        return await this.handleAuditRoutes(request, path, method);
      }

      return this.notFound();
    } catch (error) {
      console.error('DocuMint API error:', error.message, error.stack);
      return this.errorResponse('Internal server error', 500);
    }
  }

  // ============ Mint Routes ============

  async handleMintRoutes(request, path, method) {
    if (path === '/documint/v1/mint' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await this.parseJSON(request);
      if (body.error) return body.error;

      if (!body.data.document) return this.errorResponse('Missing required field: document', 400);
      if (!body.data.name || typeof body.data.name !== 'string') return this.errorResponse('Missing required field: name', 400);

      const result = await this.documint.mint({ ...body.data, chittyId: auth.chittyId });
      return this.jsonResponse(result, 201, request);
    }

    const mintIdMatch = path.match(/\/documint\/v1\/mint\/([^/]+)/);
    if (!mintIdMatch) return this.notFound();

    const mintId = mintIdMatch[1];
    if (!/^DM-/.test(mintId)) return this.errorResponse('Invalid mint ID format', 400);

    const subPath = path.replace(`/documint/v1/mint/${mintId}`, '');

    if (subPath === '/sign' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await this.parseJSON(request);
      if (body.error) return body.error;

      if (!body.data.signer || typeof body.data.signer !== 'string') return this.errorResponse('Missing required field: signer', 400);

      const result = await this.documint.sign(mintId, { ...body.data, chittyId: auth.chittyId });
      return this.jsonResponse(result, 200, request);
    }

    if (subPath === '/attach' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await this.parseJSON(request);
      if (body.error) return body.error;

      if (!body.data.attachmentMintId) return this.errorResponse('Missing required field: attachmentMintId', 400);
      if (!body.data.relationship) return this.errorResponse('Missing required field: relationship', 400);

      const result = await this.documint.attach(mintId, body.data);
      return this.jsonResponse(result, 200, request);
    }

    if (subPath === '/revoke' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await this.parseJSON(request);
      if (body.error) return body.error;

      if (!body.data.reason) return this.errorResponse('Missing required field: reason', 400);
      if (!body.data.revokedBy) return this.errorResponse('Missing required field: revokedBy', 400);

      const result = await this.documint.revoke(mintId, body.data);
      return this.jsonResponse(result, 200, request);
    }

    if (subPath === '' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();
      return this.jsonResponse(await this.documint.verify(mintId), 200, request);
    }

    if (subPath === '/bundle' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();
      return this.jsonResponse(await this.documint.bundle(mintId), 200, request);
    }

    if (subPath === '/export' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();
      return this.jsonResponse(await this.documint.export(mintId), 200, request);
    }

    if (subPath === '/audit' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();
      return this.jsonResponse(await this.documint.chain.history(mintId), 200, request);
    }

    if (subPath === '/report' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();
      return this.jsonResponse(await this.documint.proof.generateReport(mintId), 200, request);
    }

    return this.notFound();
  }

  // ============ Verify Routes (Public) ============

  async handleVerifyRoutes(request, path, method) {
    if (method !== 'GET') return this.methodNotAllowed();

    const proofIdMatch = path.match(/\/(?:documint\/v1\/)?verify\/([^/]+)/);
    if (!proofIdMatch) return this.notFound();

    const proofId = proofIdMatch[1];
    const result = await this.documint.verify(proofId);

    return this.jsonResponse({
      ...result,
      publicVerification: true,
      verifiedAt: new Date().toISOString()
    }, 200, request);
  }

  // ============ Audit Routes ============

  async handleAuditRoutes(request, path, method) {
    if (method !== 'POST') return this.methodNotAllowed();

    const auth = await this.authenticate(request);
    if (!auth.valid) return this.unauthorized();

    const body = await this.parseJSON(request);
    if (body.error) return body.error;

    if (path === '/documint/v1/audit/score') {
      if (!body.data.features) return this.errorResponse('Missing required field: features', 400);
      const result = await this.scoreDocument(body.data);
      return this.jsonResponse(result, 200, request);
    }

    if (path === '/documint/v1/audit/compare') {
      if (!body.data.features) return this.errorResponse('Missing required field: features', 400);
      const result = await this.compareToChittyProof(body.data);
      return this.jsonResponse(result, 200, request);
    }

    return this.notFound();
  }

  // ============ Audit Engine ============

  async scoreDocument(options) {
    const { system, features } = options;
    const scores = this.calculatePillarScores(features);
    const overall = this.calculateOverallScore(scores);

    return {
      system,
      pillars: scores,
      overall,
      comparison: this.getChittyProofComparison(scores),
      recommendation: overall.score < 50 ? 'UPGRADE_RECOMMENDED' : 'ACCEPTABLE',
      auditedAt: new Date().toISOString()
    };
  }

  calculatePillarScores(features) {
    if (!features || typeof features !== 'object') {
      return Object.fromEntries(
        ['signature', 'identity', 'document', 'delivery', 'authority', 'witness', 'durability', 'chain', 'verifiable', 'revocable', 'caseReady']
          .map(p => [p, { score: 0, technical: 0, arguable: 0 }])
      );
    }
    return {
      signature: this.scorePillar('signature', features),
      identity: this.scorePillar('identity', features),
      document: this.scorePillar('document', features),
      delivery: this.scorePillar('delivery', features),
      authority: this.scorePillar('authority', features),
      witness: this.scorePillar('witness', features),
      durability: this.scorePillar('durability', features),
      chain: this.scorePillar('chain', features),
      verifiable: this.scorePillar('verifiable', features),
      revocable: this.scorePillar('revocable', features),
      caseReady: this.scorePillar('caseReady', features)
    };
  }

  scorePillar(pillar, features) {
    // Real scoring: each pillar has ranked features from strongest to weakest
    const featureRanks = {
      signature:  [['cryptoSignature', 95, 95, 90], ['drawnSignature', 60, 55, 65], ['typedName', 30, 25, 35], ['checkbox', 10, 5, 15]],
      identity:   [['chittyId', 90, 90, 85], ['govId', 85, 80, 90], ['email2fa', 60, 65, 55], ['emailOnly', 30, 35, 25]],
      document:   [['immutableHash', 95, 95, 90], ['hash', 70, 75, 65], ['noHash', 5, 5, 5]],
      delivery:   [['certifiedDelivery', 90, 85, 90], ['readReceipt', 50, 55, 45], ['emailOnly', 20, 25, 15]],
      authority:  [['roleVerified', 85, 80, 85], ['titleStated', 40, 35, 45], ['assumed', 10, 5, 15]],
      witness:    [['thirdParty', 90, 85, 90], ['vendorOnly', 50, 55, 45], ['none', 0, 0, 0]],
      durability: [['distributed', 95, 95, 90], ['cloudSingle', 60, 65, 55], ['local', 20, 25, 15]],
      chain:      [['fullChain', 90, 90, 85], ['partialChain', 50, 55, 45], ['noChain', 0, 0, 0]],
      verifiable: [['publicVerify', 95, 95, 90], ['vendorVerify', 50, 55, 45], ['noVerify', 0, 0, 0]],
      revocable:  [['revocableAudit', 95, 95, 90], ['deletable', 30, 35, 25], ['permanent', 60, 55, 65]],
      caseReady:  [['fullBundle', 90, 85, 90], ['partialBundle', 50, 45, 55], ['none', 0, 0, 0]]
    };

    const ranks = featureRanks[pillar] || [];
    const pillarFeatures = Array.isArray(features[pillar]) ? features[pillar] : (features[pillar] ? [features[pillar]] : []);

    // Find the strongest matching feature
    let bestScore = 0, bestTechnical = 0, bestArguable = 0;
    for (const [featureName, score, technical, arguable] of ranks) {
      if (pillarFeatures.includes(featureName)) {
        if (score > bestScore) {
          bestScore = score;
          bestTechnical = technical;
          bestArguable = arguable;
        }
      }
    }

    return { score: bestScore, technical: bestTechnical, arguable: bestArguable };
  }

  calculateOverallScore(scores) {
    const pillarList = Object.values(scores);
    const avg = pillarList.reduce((sum, p) => sum + p.score, 0) / pillarList.length;

    let status = 'WEAK';
    if (avg >= 90) status = 'IRONCLAD';
    else if (avg >= 75) status = 'STRONG';
    else if (avg >= 50) status = 'MODERATE';

    return { score: Math.round(avg * 10) / 10, status };
  }

  getChittyProofComparison(scores) {
    const weakPillars = Object.entries(scores)
      .filter(([_, v]) => v.score < 80)
      .map(([k]) => k);

    const yourScore = this.calculateOverallScore(scores).score;

    return {
      chittyProofScore: 92,
      yourScore,
      weakPillars,
      improvementPotential: Math.round((92 - yourScore) * 10) / 10
    };
  }

  async compareToChittyProof(options) {
    const score = await this.scoreDocument(options);
    return {
      ...score,
      chittyProof: {
        score: 92,
        status: 'IRONCLAD',
        features: [
          'Cryptographic signatures (ECDSA-P256)',
          'ChittyID verified identity',
          'Immutable ChittyChain anchoring',
          'Third-party attestation (ChittyOS witness)',
          'Public verification (no auth needed)',
          'ChittyDLVR legal defense backing'
        ]
      },
      switchRecommendation: score.overall.score < 80
    };
  }

  // ============ Helpers ============

  async authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false };
    }

    const token = authHeader.substring(7);
    if (!token) return { valid: false };

    // Validate against the real API key from environment
    const validKey = this.env.API_KEY;
    if (!validKey) {
      console.error('API_KEY not configured in environment');
      return { valid: false };
    }

    // Constant-time comparison to prevent timing attacks
    if (token.length !== validKey.length) return { valid: false };
    const encoder = new TextEncoder();
    const a = encoder.encode(token);
    const b = encoder.encode(validKey);
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a[i] ^ b[i];
    }
    if (mismatch !== 0) return { valid: false };

    return { valid: true, chittyId: this.env.CHITTY_ID || 'authenticated' };
  }

  async parseJSON(request) {
    try {
      const data = await request.json();
      return { data };
    } catch {
      return { error: this.errorResponse('Invalid JSON in request body', 400) };
    }
  }

  getCorsOrigin(request) {
    const origin = request?.headers?.get('Origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
    return ALLOWED_ORIGINS[0];
  }

  jsonResponse(data, status = 200, request = null) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': this.getCorsOrigin(request)
      }
    });
  }

  corsResponse(request) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': this.getCorsOrigin(request),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  notFound() {
    return this.jsonResponse({ error: 'Not found' }, 404);
  }

  unauthorized() {
    return this.jsonResponse({ error: 'Unauthorized' }, 401);
  }

  methodNotAllowed() {
    return this.jsonResponse({ error: 'Method not allowed' }, 405);
  }

  errorResponse(message, status = 500) {
    return this.jsonResponse({ error: message }, status);
  }
}

export default DocuMintAPI;
