/**
 * DocuMint Type Definitions
 * @canon chittycanon://core/services/documint
 */

// ============ Enums / Unions ============

export type ProofStatus = 'WEAK' | 'MODERATE' | 'STRONG' | 'IRONCLAD';
export type MintStatus = 'MINTED' | 'SIGNED' | 'REVOKED';
export type SignatureStatus = 'VALID' | 'REVOKED';
export type AnchorStatus = 'CONFIRMED';
export type EventAction = 'MINTED' | 'SIGNED' | 'ATTACHED' | 'REVOKED';
export type SignerRole = 'creator' | 'signer' | 'witness' | 'notary' | string;
export type DocumentType = 'contract' | 'invoice' | 'certificate' | 'document' | string;

// ============ Base Types ============

export interface PillarScore {
  score: number;
  technical: number;
  arguable: number;
}

export interface OverallScore {
  score: number;
  technical: number;
  arguable: number;
  status: ProofStatus;
}

export interface DrandProof {
  round: number;
  randomness: string;
  signature: string;
  beacon: string;
  chainHash: string;
}

export interface ChainEvent {
  action: EventAction;
  actor: string;
  timestamp: string;
  witnessed: boolean;
}

// ============ Pillar Interfaces ============

export interface SignaturePillar extends PillarScore {
  method: string | null;
  verified: boolean;
  signatures: string[];
}

export interface IdentityPillar extends PillarScore {
  method: string | null;
  verified: boolean;
  parties: string[];
}

export interface DocumentPillar extends PillarScore {
  hash: string;
  immutable: boolean;
  anchored: boolean;
}

export interface DeliveryPillar extends PillarScore {
  delivered: boolean;
  receipts: string[];
}

export interface AuthorityPillar extends PillarScore {
  verified: boolean;
  roles: string[];
}

export interface WitnessPillar extends PillarScore {
  attestor: string;
  independent: boolean;
  attestations: string[];
}

export interface DurabilityPillar extends PillarScore {
  searchable: boolean;
  indexed: boolean;
  immutable: boolean;
  distributed: boolean;
  survivesVendor: boolean;
  portable: boolean;
}

export interface ChainPillar extends PillarScore {
  locked: boolean;
  gaps: number;
  unknownActors: number;
  unknownPeriods: number;
  events: ChainEvent[];
}

export interface VerifiablePillar extends PillarScore {
  publicUrl: string | null;
  vendorIndependent: boolean;
  openStandard: boolean;
  transferable: boolean;
  reassignable: boolean;
}

export interface RevocablePillar extends PillarScore {
  status: string;
  canRevoke: boolean;
  auditPermanent: boolean;
  allPartiesAccess: boolean;
}

export interface CaseReadyPillar extends PillarScore {
  attachable: boolean;
  citable: boolean;
  stackable: boolean;
  linkable: boolean;
  attachments: string[];
  links: string[];
}

export interface Pillars {
  signature: SignaturePillar;
  identity: IdentityPillar;
  document: DocumentPillar;
  delivery: DeliveryPillar;
  authority: AuthorityPillar;
  witness: WitnessPillar;
  durability: DurabilityPillar;
  chain: ChainPillar;
  verifiable: VerifiablePillar;
  revocable: RevocablePillar;
  caseReady: CaseReadyPillar;
}

// ============ Entity Types ============

export interface ChittyProofObject {
  proofId: string;
  version: string;
  mintId: string;
  documentHash: string;
  pillars: Pillars;
  overall: OverallScore;
  createdAt: string;
  updatedAt: string;
  verifyUrl: string;
}

export interface MintedDocument {
  mintId: string;
  version: string;
  document: {
    hash: string;
    name: string;
    type: DocumentType;
    size: number;
    minted: string;
  };
  proof: ChittyProofObject;
  chain: Anchor;
  status: MintStatus;
  createdAt: string;
  verifyUrl: string;
  metadata: Record<string, unknown> & {
    mintedBy: string;
    mintedAt: string;
  };
}

export interface SignatureResult {
  signatureId: string;
  mintId: string;
  signer: string;
  role: SignerRole;
  algorithm: 'ECDSA-P256-SHA256';
  timestamp: string;
  identityVerified: boolean;
  identityScore: number;
  identityMethod: string;
  signature: string;
  publicKey: string;
  signedPayload: string;
  witnessed: boolean;
  witness: string;
  status: SignatureStatus;
  verifyUrl: string;
}

export interface AttachmentResult {
  attachmentId: string;
  parentMintId: string;
  childMintId: string;
  relationship: string;
  attachedAt: string;
}

export interface RevocationResult {
  revocationId: string;
  mintId: string;
  reason: string;
  revokedBy: string;
  revokedAt: string;
  auditPreserved: true;
}

export interface Anchor {
  anchorId: string;
  chainId: string;
  event: {
    mintId: string;
    action: EventAction;
    actor: string;
    timestamp: string;
    data: Record<string, unknown>;
  };
  eventHash: string;
  previousHash: string;
  chainHash: string;
  drand: DrandProof | null;
  blockHeight: number;
  txId: string;
  status: AnchorStatus;
  anchoredAt: string;
  confirmedAt: string;
}

export interface VerificationResult {
  mintId: string;
  verified: boolean;
  timestamp: string;
  pillars: Pillars | Record<string, never>;
  overall: OverallScore;
  documentHash?: string;
  proofId?: string;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
}

export interface ProofBundle {
  mintId: string;
  proof: VerificationResult;
  attachments: string[];
  links: string[];
  auditTrail: ChainEvent[];
  exportable: boolean;
  courtReady: boolean;
}

export interface PDXPackage {
  format: 'PDX';
  version: string;
  mintId: string;
  exportedAt: string;
}

export interface ChainHistory {
  mintId: string;
  events: Array<{
    anchorId: string;
    action: EventAction;
    actor: string;
    timestamp: string;
    blockHeight: number;
    eventHash: string;
    drandRound: number | null;
  }>;
  complete: boolean;
  gaps: number;
  queriedAt: string;
}

export interface AnchorVerification {
  anchorId: string;
  exists: boolean;
  verified: boolean;
  tampered?: boolean;
  blockHeight?: number;
  drand?: { verified: boolean; round: number } | null;
  error?: string;
  verifiedAt: string;
}

export interface SignatureVerification {
  signatureId: string | null;
  valid: boolean;
  algorithm: string;
  error?: string;
  verifiedAt: string;
}

export interface AuditScoreResult {
  system: string;
  pillars: Record<string, PillarScore>;
  overall: { score: number; status: ProofStatus };
  comparison: {
    chittyProofScore: number;
    yourScore: number;
    weakPillars: string[];
    improvementPotential: number;
  };
  recommendation: string;
  auditedAt: string;
}

export interface AuditCompareResult extends AuditScoreResult {
  chittyProof: {
    score: number;
    status: ProofStatus;
    features: string[];
  };
  switchRecommendation: boolean;
}

// ============ Config Types ============

export interface DocuMintConfig {
  apiKey?: string;
  baseUrl?: string;
  chittyId?: string;
  signingKeyJwk?: string | JsonWebKey;
  proofsKv?: KVNamespace | null;
  cacheKv?: KVNamespace | null;
}

export interface DocuMintClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

// ============ Classes ============

export class DocuMint {
  constructor(config?: DocuMintConfig);
  proof: ChittyProof;
  signature: ChittySignature;
  chain: ChittyChain;
  initialize(): Promise<DocuMint>;
  mint(options: { document: string | Uint8Array; name: string; type?: DocumentType; metadata?: Record<string, unknown> }): Promise<MintedDocument>;
  sign(mintId: string, options: { signer: string; role?: SignerRole }): Promise<SignatureResult>;
  attach(mintId: string, options: { attachmentMintId: string; relationship: string }): Promise<AttachmentResult>;
  revoke(mintId: string, options: { reason: string; revokedBy: string }): Promise<RevocationResult>;
  verify(mintId: string): Promise<VerificationResult>;
  bundle(mintId: string): Promise<ProofBundle>;
  export(mintId: string): Promise<PDXPackage>;
}

export class ChittyProof {
  constructor(documint: DocuMint, kv?: KVNamespace | null);
  create(options: { mintId: string; documentHash: string; timestamp: string }): Promise<ChittyProofObject>;
  update(mintId: string, updates: Partial<Pillars>): Promise<{ mintId: string; updated: string[]; overall?: OverallScore; timestamp: string }>;
  calculateOverall(pillars: Pillars): OverallScore;
  verify(mintId: string): Promise<VerificationResult>;
  bundle(mintId: string): Promise<ProofBundle>;
  exportPDX(mintId: string): Promise<PDXPackage>;
  generateReport(mintId: string): Promise<Record<string, unknown>>;
}

export class ChittySignature {
  constructor(documint: DocuMint);
  create(options: { mintId: string; signer: string; role: SignerRole; timestamp: string }): Promise<SignatureResult>;
  verify(signatureData: { signature: string; publicKey: string; signedPayload: string; signatureId?: string }): Promise<SignatureVerification>;
  sign(data: string | object): Promise<{ signature: string; publicKey: string }>;
}

export class ChittyChain {
  constructor(documint: DocuMint, kv?: KVNamespace | null);
  fetchDrandRound(): Promise<{ round: number; randomness: string; signature: string } | null>;
  anchor(event: { mintId: string; action: EventAction; [key: string]: unknown }): Promise<Anchor>;
  verify(anchorId: string): Promise<AnchorVerification>;
  history(mintId: string): Promise<ChainHistory>;
}

export class DocuMintClient {
  constructor(config: DocuMintClientConfig);
  create(options: { document: string | Uint8Array | ArrayBuffer; name: string; type?: string; metadata?: Record<string, unknown> }): Promise<MintedDocument>;
  sign(mintId: string, options: { signer: string; role?: string }): Promise<SignatureResult>;
  attach(mintId: string, options: { attachmentMintId: string; relationship: string }): Promise<AttachmentResult>;
  revoke(mintId: string, options: { reason: string; revokedBy: string }): Promise<RevocationResult>;
  verify(mintId: string): Promise<VerificationResult>;
  bundle(mintId: string): Promise<ProofBundle>;
  audit(mintId: string): Promise<ChainHistory>;
  export(mintId: string): Promise<PDXPackage>;
  report(mintId: string): Promise<Record<string, unknown>>;
  auditScore(options: { system?: string; features: Record<string, string | string[]> }): Promise<AuditScoreResult>;
  auditCompare(options: { system?: string; features: Record<string, string | string[]> }): Promise<AuditCompareResult>;
}

export class DocuMintError extends Error {
  name: 'DocuMintError';
  code: string;
  status: number;
  constructor(message: string, code: string, status: number);
}

// ============ Constants ============

export const VERSION: string;
export const PILLARS: readonly string[];

export default DocuMint;
