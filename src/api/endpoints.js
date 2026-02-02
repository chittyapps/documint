/**
 * DocuMint API Endpoints
 * Cloudflare Worker handlers for DocuMint API
 */

import { DocuMint } from '../core/documint.js';
import { PublicVerify } from '../verify/public.js';

export class DocuMintAPI {
  constructor(env) {
    this.env = env;
    this.documint = new DocuMint({
      apiKey: env.INTERNAL_API_KEY
    });
  }

  async initialize() {
    await this.documint.initialize();
    return this;
  }

  /**
   * Handle incoming requests
   */
  async handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS
    if (method === 'OPTIONS') {
      return this.corsResponse();
    }

    try {
      // Route requests
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
      console.error('DocuMint API error:', error);
      return this.errorResponse(error.message, 500);
    }
  }

  // ============ Mint Routes ============

  async handleMintRoutes(request, path, method) {
    // POST /documint/v1/mint - Create new mint
    if (path === '/documint/v1/mint' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await request.json();
      const result = await this.documint.mint(body);
      return this.jsonResponse(result, 201);
    }

    // Extract mintId from path
    const mintIdMatch = path.match(/\/documint\/v1\/mint\/([^/]+)/);
    if (!mintIdMatch) return this.notFound();

    const mintId = mintIdMatch[1];
    const subPath = path.replace(`/documint/v1/mint/${mintId}`, '');

    // POST /documint/v1/mint/:id/sign
    if (subPath === '/sign' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await request.json();
      const result = await this.documint.sign(mintId, body);
      return this.jsonResponse(result);
    }

    // POST /documint/v1/mint/:id/attach
    if (subPath === '/attach' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await request.json();
      const result = await this.documint.attach(mintId, body);
      return this.jsonResponse(result);
    }

    // POST /documint/v1/mint/:id/revoke
    if (subPath === '/revoke' && method === 'POST') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const body = await request.json();
      const result = await this.documint.revoke(mintId, body);
      return this.jsonResponse(result);
    }

    // GET /documint/v1/mint/:id
    if (subPath === '' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const result = await this.documint.verify(mintId);
      return this.jsonResponse(result);
    }

    // GET /documint/v1/mint/:id/bundle
    if (subPath === '/bundle' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const result = await this.documint.bundle(mintId);
      return this.jsonResponse(result);
    }

    // GET /documint/v1/mint/:id/export
    if (subPath === '/export' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const result = await this.documint.export(mintId);
      return this.jsonResponse(result);
    }

    // GET /documint/v1/mint/:id/audit
    if (subPath === '/audit' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const result = await this.documint.chain.history(mintId);
      return this.jsonResponse(result);
    }

    // GET /documint/v1/mint/:id/report
    if (subPath === '/report' && method === 'GET') {
      const auth = await this.authenticate(request);
      if (!auth.valid) return this.unauthorized();

      const result = await this.documint.proof.generateReport(mintId);
      return this.jsonResponse(result);
    }

    return this.notFound();
  }

  // ============ Verify Routes (Public) ============

  async handleVerifyRoutes(request, path, method) {
    if (method !== 'GET') return this.methodNotAllowed();

    // Extract proof ID
    const proofIdMatch = path.match(/\/(?:documint\/v1\/)?verify\/([^/]+)/);
    if (!proofIdMatch) return this.notFound();

    const proofId = proofIdMatch[1];

    // Public verification - no auth needed
    const result = await this.documint.verify(proofId);

    return this.jsonResponse({
      ...result,
      publicVerification: true,
      verifiedAt: new Date().toISOString()
    });
  }

  // ============ Audit Routes ============

  async handleAuditRoutes(request, path, method) {
    if (method !== 'POST') return this.methodNotAllowed();

    // POST /documint/v1/audit/score
    if (path === '/documint/v1/audit/score') {
      const body = await request.json();
      const result = await this.scoreDocument(body);
      return this.jsonResponse(result);
    }

    // POST /documint/v1/audit/compare
    if (path === '/documint/v1/audit/compare') {
      const body = await request.json();
      const result = await this.compareToChittyProof(body);
      return this.jsonResponse(result);
    }

    return this.notFound();
  }

  // ============ Audit Engine ============

  async scoreDocument(options) {
    // Score any document/system against 11 pillars
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
    // Default scores based on features
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
    // Simplified scoring logic - expand based on actual features
    const featureMap = {
      signature: ['cryptoSignature', 'typedName', 'drawnSignature', 'checkbox'],
      identity: ['chittyId', 'govId', 'email2fa', 'emailOnly'],
      document: ['immutableHash', 'hash', 'noHash'],
      delivery: ['certifiedDelivery', 'readReceipt', 'emailOnly'],
      authority: ['roleVerified', 'titleStated', 'assumed'],
      witness: ['thirdParty', 'vendorOnly', 'none'],
      durability: ['distributed', 'cloudSingle', 'local'],
      chain: ['fullChain', 'partialChain', 'noChain'],
      verifiable: ['publicVerify', 'vendorVerify', 'noVerify'],
      revocable: ['revocableAudit', 'deletable', 'permanent'],
      caseReady: ['fullBundle', 'partialBundle', 'none']
    };

    // Return mock score - implement real logic
    return {
      score: 50,
      technical: 50,
      arguable: 50
    };
  }

  calculateOverallScore(scores) {
    const pillarList = Object.values(scores);
    const avg = pillarList.reduce((sum, p) => sum + p.score, 0) / pillarList.length;

    let status = 'WEAK';
    if (avg >= 90) status = 'IRONCLAD';
    else if (avg >= 75) status = 'STRONG';
    else if (avg >= 50) status = 'MODERATE';

    return { score: avg, status };
  }

  getChittyProofComparison(scores) {
    // Compare to ChittyProof standard (90+ on all pillars)
    const weakPillars = Object.entries(scores)
      .filter(([_, v]) => v.score < 80)
      .map(([k]) => k);

    return {
      chittyProofScore: 92,
      yourScore: this.calculateOverallScore(scores).score,
      weakPillars,
      improvementPotential: 92 - this.calculateOverallScore(scores).score
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
          'Cryptographic signatures (P-256)',
          'ChittyID verified identity',
          'Immutable ChittyChain anchoring',
          'Third-party attestation',
          'Public verification',
          'Legal defense backing'
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
    // TODO: Validate with ChittyOS
    if (token.length > 10) {
      return { valid: true, chittyId: 'authenticated' };
    }

    return { valid: false };
  }

  jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  corsResponse() {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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
