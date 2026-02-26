/**
 * DocuMint Worker
 * Cloudflare Worker entry point
 */

import { DocuMintAPI } from './api/endpoints.js';

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        console.log(`DocuMint queue event: ${JSON.stringify(message.body)}`);
        message.ack();
      } catch (error) {
        console.error('Queue message processing failed:', error.message);
        message.retry({ delaySeconds: 30 });
      }
    }
  },

  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // Health check
      if (url.pathname === '/health') {
        return Response.json({
          service: 'DocuMint',
          status: 'healthy',
          version: env.VERSION || '1.0.0',
          timestamp: new Date().toISOString()
        });
      }

      // Initialize API handler
      const api = new DocuMintAPI(env);
      await api.initialize();

      // Handle request
      return api.handleRequest(request);
    } catch (error) {
      console.error('DocuMint Worker error:', error.message, error.stack);
      return Response.json(
        { error: 'Internal server error', code: 'WORKER_ERROR' },
        { status: 500 }
      );
    }
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
    try {
      // Validate internal origin — only accept requests from our own workers
      const serviceToken = request.headers.get('X-Service-Token');
      if (!serviceToken || serviceToken !== this.env.INTERNAL_SERVICE_TOKEN) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const url = new URL(request.url);

      if (request.method === 'GET') {
        const proof = await this.state.storage.get('proof');
        return Response.json(proof || {});
      }

      if (request.method === 'PUT') {
        let proof;
        try {
          proof = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }
        if (!proof || typeof proof !== 'object') {
          return Response.json({ error: 'Proof must be an object' }, { status: 400 });
        }
        await this.state.storage.put('proof', proof);
        return Response.json({ success: true });
      }

      if (request.method === 'POST' && url.pathname === '/event') {
        let event;
        try {
          event = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }
        const events = await this.state.storage.get('events') || [];
        if (!Array.isArray(events)) {
          await this.state.storage.put('events', []);
          return Response.json({ error: 'Events storage corrupted, reset' }, { status: 500 });
        }
        events.push({ ...event, timestamp: new Date().toISOString() });
        await this.state.storage.put('events', events);
        return Response.json({ success: true, eventCount: events.length });
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      console.error('ProofStateDO error:', error.message);
      return Response.json(
        { error: 'Durable Object internal error' },
        { status: 500 }
      );
    }
  }
}
