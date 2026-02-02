/**
 * DocuMint Worker
 * Cloudflare Worker entry point
 */

import { DocuMintAPI } from './api/endpoints.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        service: 'DocuMint',
        status: 'healthy',
        version: env.VERSION || '1.0.0',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize API handler
    const api = new DocuMintAPI(env);
    await api.initialize();

    // Handle request
    return api.handleRequest(request);
  }
};

/**
 * Durable Object for proof state
 */
export class ProofStateDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const proof = await this.state.storage.get('proof');
      return new Response(JSON.stringify(proof || {}), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PUT') {
      const proof = await request.json();
      await this.state.storage.put('proof', proof);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST' && url.pathname === '/event') {
      const event = await request.json();
      const events = await this.state.storage.get('events') || [];
      events.push({
        ...event,
        timestamp: new Date().toISOString()
      });
      await this.state.storage.put('events', events);
      return new Response(JSON.stringify({ success: true, eventCount: events.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
