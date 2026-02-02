# DocuMint

**Mint it. It's permanent.**

Document signing with ChittyProof - the 11-pillar proof standard.

Free signatures. Court-admissible proof. Or we fight for you.

## Install

```bash
npm install @chitty/documint
```

## Quick Start

```javascript
import { DocuMint } from '@chitty/documint';

const mint = new DocuMint({ apiKey: 'your-api-key' });

// Mint a document
const doc = await mint.mint({
  document: pdfBuffer,
  name: 'Contract.pdf'
});

// Sign it
await mint.sign(doc.mintId, {
  signer: 'chittyid-123',
  role: 'signer'
});

// Verify anytime
const proof = await mint.verify(doc.mintId);
console.log(proof.overall.status); // 'IRONCLAD'
```

## The 11 Pillars of ChittyProof

Every minted document is scored on 11 pillars of admissibility:

| # | Pillar | Question |
|---|--------|----------|
| 1 | **Signature** | Is this a real signature? |
| 2 | **Identity** | Is this really that person? |
| 3 | **Document** | Is this the exact document? |
| 4 | **Delivery** | Did they receive it? |
| 5 | **Authority** | Did they have the right to sign? |
| 6 | **Witness** | Who else confirms this? |
| 7 | **Durability** | Will proof exist when needed? |
| 8 | **Chain** | Every moment accounted for? |
| 9 | **Verifiable** | Can anyone verify? Portable? |
| 10 | **Revocable** | Can cancel, can't hide? |
| 11 | **Case-Ready** | Attachable, citable, stackable? |

## API

### Mint

```javascript
const doc = await mint.mint({
  document: Buffer | Uint8Array | base64String,
  name: 'Contract.pdf',
  type: 'contract', // optional
  metadata: {}      // optional
});

// doc.mintId = 'DM-ABC123...'
// doc.proof = ChittyProof object
// doc.verifyUrl = 'https://chitty.cc/verify/DM-ABC123...'
```

### Sign

```javascript
const sig = await mint.sign(doc.mintId, {
  signer: 'chittyid-123',  // ChittyID of signer
  role: 'signer'           // signer, witness, notary, etc.
});

// sig.signatureId = 'SIG-...'
// sig.verified = true
```

### Attach

```javascript
await mint.attach(doc.mintId, {
  attachmentMintId: 'DM-XYZ...',  // Another minted doc
  relationship: 'amendment'       // amendment, invoice, exhibit, etc.
});
```

### Revoke

```javascript
await mint.revoke(doc.mintId, {
  reason: 'Mutual termination'
});

// Document is void
// Audit trail is PERMANENT (can't hide it existed)
```

### Verify

```javascript
const proof = await mint.verify(doc.mintId);

// proof.pillars.signature.score = 95
// proof.pillars.identity.score = 90
// proof.overall.score = 92
// proof.overall.status = 'IRONCLAD'
```

### Bundle

```javascript
const bundle = await mint.bundle(doc.mintId);

// bundle.proof = main document proof
// bundle.attachments = linked documents
// bundle.auditTrail = complete history
// bundle.courtReady = true
```

### Export

```javascript
const pdx = await mint.export(doc.mintId);

// PDX format - portable, take anywhere
```

## Public Verification

Anyone can verify a ChittyProof:

```javascript
import { PublicVerify } from '@chitty/documint/verify';

const result = await PublicVerify.verify('DM-ABC123');
// No API key needed
```

Or via URL:
```
https://chitty.cc/verify/DM-ABC123
```

Or CLI:
```bash
npx @chitty/documint verify DM-ABC123
```

## Pricing

| Feature | Free | Paid |
|---------|------|------|
| Signatures | Unlimited | Unlimited |
| Mints | 50/month | Unlimited |
| Per mint after free tier | - | $0.10 |
| Public verification | Free | Free |
| Legal defense fund | Included | Included |

**Sender pays. Platform never pays.**

## Legal Defense Guarantee

Every mint contributes $0.02 to the Legal Defense Fund.

If anyone challenges your ChittyProof in court:
- We provide expert witnesses
- We provide technical affidavits
- We fight with you

If we lose, we cover your legal costs.

**Court-admissible. Or we fight for you.**

## Links

- Website: https://documint.chitty.cc
- Docs: https://docs.chitty.cc/documint
- Verify: https://chitty.cc/verify
- GitHub: https://github.com/chittyapps/documint

## License

MIT
