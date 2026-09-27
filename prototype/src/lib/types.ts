export type AuthorityLevel = "AUTHORITATIVE" | "SUPPLEMENTARY" | "REFERENCE" | "USER_CONTRIBUTED";

export type DocumentStatus = "CURRENT" | "AMENDED" | "SUPERSEDED" | "WITHDRAWN";

export type GroundingState = "verified" | "supported_inference" | "insufficient_evidence";

export type ApplicabilityState =
  | "DIRECTLY_APPLICABLE"
  | "POTENTIALLY_APPLICABLE"
  | "RELATED"
  | "MATERIAL_MISMATCH"
  | "SCOPE_UNCLEAR"
  | "INSUFFICIENT_EVIDENCE";

export interface StandardRecord {
  standard_id: string;
  standard_number: string;
  year?: number | string;
  full_title: string;
  short_title?: string;
  product_category: string;
  industry: string;
  scheme: string;
  certification_route: string;
  mandatory_qco: boolean;
  status: DocumentStatus;
  publication_date?: string;
  scope: string;
  key_testing_parameters: string[];
  materials?: string[];
  keywords: string[];
  document_url: string;
  source_url: string;
  source_type: string;
  verification_status: string;
}

export interface LaboratoryRecord {
  id?: string;
  slNo?: number;
  name: string;
  city: string | null;
  state: string;
  stateRaw?: string;
  type?: string;
  oslCode?: string;
  recognitionValidUpto?: string;
  currentStatus?: string;
  remarks?: string | null;
  lat: number;
  lng: number;
  recognized_standards?: string[];
  accreditation_number?: string;
  address?: string;
  distance_km?: number;
  testing_scope?: string[];
}

export interface QCORecord {
  standard_id?: string;
  standard_number: string;
  full_title: string;
  short_title?: string;
  mandatory_qco?: boolean;
  order_name?: string;
  title?: string;
  ministry?: string;
  department?: string;
  gazette_date?: string;
  publication_date?: string;
  is_mandatory?: boolean;
  status?: string;
}

export interface DisambiguationOption {
  label: string;
  standard: string;
  category: string;
  icon?: string;
}

export interface DisambiguationResult {
  isAmbiguous: boolean;
  term?: string;
  question?: string;
  options?: DisambiguationOption[];
}

export interface EvidenceClause {
  sid?: string;
  standardNumber: string;
  title: string;
  clauseNumber?: string;
  clauseTitle?: string;
  verbatimText: string;
  pageNumber?: number | string;
  pageNumbers?: number[];
  breadcrumb?: string[];
  documentId?: string;
  knowledgeTier?: "A" | "B" | "C";
  confidence: number;
  authorityLevel: AuthorityLevel;
  sourceUrl?: string;
  isMandatoryQco?: boolean;
}

export interface RecommendationResult {
  standardNumber: string;
  title: string;
  year?: number | string;
  relevanceScore: number;
  applicability: ApplicabilityState;
  applicabilityReason: string;
  groundingState: GroundingState;
  scheme: string;
  mandatoryQco: boolean;
  scope: string;
  tier?: "A" | "B" | "C";
  testingClauses: EvidenceClause[];
  sourceUrl: string;
  isPrimary: boolean;
}

export interface LanguageGatewayInfo {
  detectedLanguage: "en" | "hi";
  isCodeMixed: boolean;
  confidence: number;
  canonicalEnglishQuery: string;
  lockedTerms: string[];
}

export interface SpecialistAgentData {
  id: string;
  name: string;
  role: string;
  badgeColor: string;
  icon: string;
  keyInsights?: string[];
  recommendedNextActions?: string[];
}

export interface OutdatedReferenceInfo {
  queriedStandard: string;
  currentStandard: string;
  status: "SUPERSEDED" | "WITHDRAWN" | "AMENDED";
  enforcementNotice: string;
}

export interface FormDraftData {
  formType: "SCHEDULE_II_FORM_I" | "FORM_V";
  standardNumber: string;
  productTitle: string;
  scheme: string;
  msmeEligible: boolean;
  concessionPercent: number;
  estimatedBaseFee: number;
  concessionFee: number;
  requiredDocuments: string[];
  inHouseTestEquipment: string[];
  submissionPortal: string;
}

export interface QueryResponse {
  query: string;
  outcome: "answered" | "refused_insufficient_evidence" | "disambiguation_required";
  confidenceScore: number;
  synthesis: string;
  recommendations: RecommendationResult[];
  activeEvidence: EvidenceClause[];
  disambiguation?: DisambiguationResult;
  qcoAlert?: {
    isMandatory: boolean;
    orderTitle: string;
    ministry: string;
    penalProvision?: string;
  };
  labs?: LaboratoryRecord[];
  languageGateway?: LanguageGatewayInfo;
  specialistAgent?: SpecialistAgentData;
  outdatedReferenceAlert?: OutdatedReferenceInfo;
  isSpeedGateHit?: boolean;
  formDraft?: FormDraftData;
  starterActions?: Array<{ id: string; label: string; icon?: string; query: string }>;
  isConversational?: boolean;
  dossier?: import("@/types/api").ComplianceDossier;
  adjudicationReport?: any;
  reasoningSteps: {
    stage: "UNDERSTAND" | "RETRIEVE" | "RERANK" | "VALIDATE" | "SYNTHESIZE";
    status: "done" | "active" | "pending";
    detail: string;
  }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  queryResponse?: QueryResponse;
  dossier?: import("@/types/api").ComplianceDossier;
  stageEvents?: any[];
  citedClauses?: EvidenceClause[];
  selectedDisambiguation?: string;
}

export interface BoundingBox {
  id: string;
  label: string;
  box: [number, number, number, number]; // [top%, left%, width%, height%]
  category: "product" | "mark" | "component" | "violation";
  confidence: number;
  description: string;
}

export interface VisionInspectionResult {
  id: string;
  timestamp: string;
  imageUrl: string;
  sampleKey?: string;
  product: {
    category: string;
    productName: string;
    description: string;
    identifiedMaterials: string[];
    confidence: number;
  };
  markDetection: {
    isMarkPresent: boolean;
    markType: "ISI" | "CRS" | "HALLMARK_HUID" | "NONE" | "SUSPICIOUS";
    detectedStandard?: string;
    cmlOrHuidNumber?: string;
    isValidFormat: boolean;
    formatDetails: string;
    verificationStatus: "GENUINE_OPERATIVE" | "NON_COMPLIANT_MISSING" | "FORMAT_INVALID" | "UNVERIFIED";
  };
  statutoryAnalysis: {
    isQcoMandatory: boolean;
    qcoOrderTitle: string;
    issuingMinistry: string;
    penalProvision: string;
    governingStandard: string;
    standardTitle: string;
    standardYear: string | number;
    certificationScheme: string;
    msmeSubsidyPercent: number;
    officialPortalUrl: string;
  };
  testingClauses: EvidenceClause[];
  nearestLaboratories: LaboratoryRecord[];
  boundingBoxes: BoundingBox[];
  dossierQuery: string;
  summaryProse: string;
}

