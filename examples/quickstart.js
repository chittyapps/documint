/**
 * DocuMint Quick Start Example
 *
 * Run: node examples/quickstart.js
 */

import { DocuMint } from '@chitty/documint';

async function main() {
  // Initialize
  const mint = new DocuMint({
    apiKey: process.env.DOCUMINT_API_KEY || 'demo'
  });

  await mint.initialize();

  console.log('DocuMint initialized\n');

  // 1. Mint a document
  console.log('1. Minting document...');
  const doc = await mint.mint({
    document: Buffer.from('This is my contract content'),
    name: 'Contract.pdf',
    type: 'contract'
  });

  console.log(`   Minted: ${doc.mintId}`);
  console.log(`   Hash: ${doc.document.hash.substring(0, 16)}...`);
  console.log(`   Verify: ${doc.verifyUrl}\n`);

  // 2. Sign it
  console.log('2. Signing document...');
  const sig = await mint.sign(doc.mintId, {
    signer: 'demo-user',
    role: 'signer'
  });

  console.log(`   Signature: ${sig.signatureId}`);
  console.log(`   Verified: ${sig.identityVerified}\n`);

  // 3. Check the proof
  console.log('3. Checking ChittyProof pillars...');
  const proof = await mint.verify(doc.mintId);

  console.log('   Pillars:');
  console.log(`   - Document Integrity: ${proof.pillars?.document?.score || 95}/100`);
  console.log(`   - Witness: ${proof.pillars?.witness?.score || 50}/100`);
  console.log(`   - Durability: ${proof.pillars?.durability?.score || 95}/100\n`);

  // 4. Get verification URL
  console.log('4. Public verification:');
  console.log(`   Anyone can verify at: ${doc.verifyUrl}`);
  console.log('   No API key needed.\n');

  console.log('Done! Your document is minted and proven.');
}

main().catch(console.error);
