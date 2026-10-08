export interface User {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Location {
  id: number;
  latitude: float;
  longitude: float;
  accuracy_meters: number | null;
  location_type: string;
  created_at: string;
}

export type float = number;

export type InvestigationStatusType =
  | 'draft'
  | 'active'
  | 'under_review'
  | 'completed'
  | 'resolved'
  | 'archived';

export type ObservationSeverityType = 'low' | 'moderate' | 'high' | 'critical';

export type ObservationSourceType =
  | 'observed'
  | 'user_reported'
  | 'estimated'
  | 'inferred'
  | 'simulated';

export type EvidenceSourceType =
  | 'observed'
  | 'user_reported'
  | 'external_source'
  | 'inferred'
  | 'estimated';

export type VerificationStateType =
  | 'needs_verification'
  | 'verified'
  | 'disputed';

export interface Evidence {
  id: number;
  investigation_id: number;
  observation_id: number | null;
  evidence_type: 'image' | 'document';
  file_name: string;
  original_filename: string;
  mime_type: string;
  storage_key: string;
  file_size_bytes: number;
  captured_at: string | null;
  uploaded_at: string;
  source_type: EvidenceSourceType;
  description: string | null;
  verification_state: VerificationStateType;
  metadata?: Record<string, any>;
  observation_description?: string | null;
  location_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  location_source?: string;
}

export interface UpdateEvidencePayload {
  description?: string;
  observation_id?: number | null;
  source_type?: EvidenceSourceType;
  verification_state?: VerificationStateType;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_accuracy_meters?: number | null;
  location_source?: string;
}

export interface EvidenceGap {
  gap_type: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  target_type: 'investigation' | 'observation' | 'evidence';
  target_id: number | null;
  recommendation: string;
}

export interface EvidenceGapsResponse {
  investigation_id: number;
  total_gaps: number;
  gaps: EvidenceGap[];
}

export interface BoundingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CompareEvidenceRequest {
  before_evidence_id: number;
  after_evidence_id: number;
}

export interface ImageAnalysisResult {
  status: string;
  investigation_id: number;
  before_evidence_id: number;
  after_evidence_id: number;
  similarity: number;
  changed_pixel_percentage: number;
  alignment_status: 'ALIGNED' | 'ALIGNED_RESCALED' | 'ALIGNMENT_UNCERTAIN' | string;
  before_dimensions: ImageDimensions;
  after_dimensions: ImageDimensions;
  analysis_dimensions?: ImageDimensions | null;
  difference_region: BoundingRegion | null;
  analyzed_at: string;
  warnings: string[];
  limitations: string[];
}

export interface TemporalSequenceItem {
  evidence_id: number;
  sequence_index: number;
  captured_at: string | null;
  uploaded_at: string | null;
  original_filename: string | null;
  role: 'BASELINE' | 'INTERMEDIATE' | 'CURRENT';
  latitude?: number | null;
  longitude?: number | null;
  location_source?: 'GPS' | 'USER_SUPPLIED' | 'INVESTIGATION' | 'UNAVAILABLE' | string;
  location_accuracy?: number | null;
}

export interface AdjacentComparison {
  before_evidence_id: number;
  after_evidence_id: number;
  before_captured_at: string | null;
  after_captured_at: string | null;
  similarity: number;
  changed_pixel_percentage: number;
  alignment_status: string;
  difference_region: BoundingRegion | null;
  distance_meters?: number | null;
  bearing_degrees?: number | null;
  accuracy_before_meters?: number | null;
  accuracy_after_meters?: number | null;
  spatial_consistency?: 'SAME_LOCATION' | 'NEARBY' | 'DISTANT' | 'UNKNOWN' | string;
  spatial_consistency_message?: string | null;
  warnings: string[];
  limitations: string[];
}

export interface EvidenceLocationRead {
  evidence_id: number;
  investigation_id: number;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_source: string;
}

export interface TemporalSequenceResponse {
  status: string;
  investigation_id: number;
  sequence_id: string;
  sequence: TemporalSequenceItem[];
  comparisons: AdjacentComparison[];
  limitations: string[];
}

export interface TemporalSequenceRequest {
  evidence_ids: number[];
}

export interface Observation {
  id: number;
  investigation_id: number;
  location_id: number | null;
  location: Location | null;
  category: string;
  description: string;
  severity: ObservationSeverityType;
  source_type: ObservationSourceType;
  confidence: number;
  observed_at: string;
  created_at: string;
  updated_at: string;
  evidence_count?: number;
  evidence_ids?: number[];
}

export interface TimelineEntry {
  id: number;
  investigation_id: number;
  event_type: string;
  title: string;
  description: string | null;
  event_timestamp: string;
  created_at: string;
}

export interface Investigation {
  id: number;
  owner_id: number;
  title: string;
  description: string | null;
  status: InvestigationStatusType;
  category: string;
  location_id: number | null;
  location?: Location | null;
  observations_count?: number;
  investigation_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestigationDetail extends Investigation {
  observations: Observation[];
  timeline_entries: TimelineEntry[];
  evidence: Evidence[];
}

export interface CreateInvestigationPayload {
  title: string;
  description?: string;
  category?: string;
  status?: InvestigationStatusType;
  location_latitude?: number;
  location_longitude?: number;
  location_accuracy_meters?: number;
  location_type?: string;
  initial_observation?: string;
  initial_severity?: ObservationSeverityType;
  initial_source_type?: ObservationSourceType;
}

export interface CreateObservationPayload {
  category: string;
  description: string;
  severity?: ObservationSeverityType;
  source_type?: ObservationSourceType;
  confidence?: number;
  observed_at?: string;
  location_latitude?: number;
  location_longitude?: number;
  location_accuracy_meters?: number;
  location_type?: string;
}

// GeoJSON Types
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONFeatureProperties {
  id: number;
  title: string;
  category: string;
  status: InvestigationStatusType;
  severity?: ObservationSeverityType | null;
  source_type?: ObservationSourceType | null;
  created_at: string;
  observation_count: number;
  accuracy_meters?: number | null;
  location_type: string;
  description?: string | null;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONPoint;
  properties: GeoJSONFeatureProperties;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const TOKEN_KEY = 'ecointelligence_auth_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new Error(
      'Unable to connect to the EcoIntelligence server. Please verify the backend is running.'
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      removeStoredToken();
    }

    let errorMessage = `Request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((item: any) => item.msg || JSON.stringify(item))
          .join(', ');
      }
    } catch {
      // response was not JSON
    }

    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export const authApi = {
  async register(payload: {
    email: string;
    display_name: string;
    password: string;
  }): Promise<TokenResponse> {
    const data = await apiFetch<TokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.access_token);
    return data;
  },

  async login(payload: {
    email: string;
    password: string;
  }): Promise<TokenResponse> {
    const data = await apiFetch<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.access_token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<{ message: string }>('/api/v1/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      removeStoredToken();
    }
  },

  async getMe(): Promise<User> {
    return apiFetch<User>('/api/v1/users/me', {
      method: 'GET',
    });
  },
};

export const investigationsApi = {
  async list(): Promise<Investigation[]> {
    return apiFetch<Investigation[]>('/api/v1/investigations', {
      method: 'GET',
    });
  },

  async create(payload: CreateInvestigationPayload): Promise<Investigation> {
    return apiFetch<Investigation>('/api/v1/investigations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async get(id: number): Promise<InvestigationDetail> {
    return apiFetch<InvestigationDetail>(`/api/v1/investigations/${id}`, {
      method: 'GET',
    });
  },

  async patch(
    id: number,
    payload: Partial<CreateInvestigationPayload>
  ): Promise<Investigation> {
    return apiFetch<Investigation>(`/api/v1/investigations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async listObservations(investigationId: number): Promise<Observation[]> {
    return apiFetch<Observation[]>(
      `/api/v1/investigations/${investigationId}/observations`,
      { method: 'GET' }
    );
  },

  async createObservation(
    investigationId: number,
    payload: CreateObservationPayload
  ): Promise<Observation> {
    return apiFetch<Observation>(
      `/api/v1/investigations/${investigationId}/observations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async updateObservation(
    investigationId: number,
    observationId: number,
    payload: Partial<CreateObservationPayload>
  ): Promise<Observation> {
    return apiFetch<Observation>(
      `/api/v1/investigations/${investigationId}/observations/${observationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteObservation(
    investigationId: number,
    observationId: number
  ): Promise<void> {
    await apiFetch<void>(
      `/api/v1/investigations/${investigationId}/observations/${observationId}`,
      { method: 'DELETE' }
    );
  },

  async getTimeline(investigationId: number): Promise<TimelineEntry[]> {
    return apiFetch<TimelineEntry[]>(
      `/api/v1/investigations/${investigationId}/timeline`,
      { method: 'GET' }
    );
  },
};

export const evidenceApi = {
  async listEvidence(investigationId: number): Promise<Evidence[]> {
    return apiFetch<Evidence[]>(
      `/api/v1/investigations/${investigationId}/evidence`,
      { method: 'GET' }
    );
  },

  async getEvidence(evidenceId: number): Promise<Evidence> {
    return apiFetch<Evidence>(`/api/v1/evidence/${evidenceId}`, {
      method: 'GET',
    });
  },

  async getEvidenceLocation(
    investigationId: number,
    evidenceId: number
  ): Promise<EvidenceLocationRead> {
    return apiFetch<EvidenceLocationRead>(
      `/api/v1/investigations/${investigationId}/evidence/${evidenceId}/location`,
      { method: 'GET' }
    );
  },

  async uploadEvidence(
    investigationId: number,
    formData: FormData
  ): Promise<Evidence> {
    return apiFetch<Evidence>(
      `/api/v1/investigations/${investigationId}/evidence`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  async updateEvidence(
    evidenceId: number,
    payload: UpdateEvidencePayload
  ): Promise<Evidence> {
    return apiFetch<Evidence>(`/api/v1/evidence/${evidenceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteEvidence(evidenceId: number): Promise<void> {
    await apiFetch<void>(`/api/v1/evidence/${evidenceId}`, {
      method: 'DELETE',
    });
  },

  async fetchEvidenceBlob(evidenceId: number): Promise<Blob> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(
      `${API_BASE_URL}/api/v1/evidence/${evidenceId}/file`,
      { headers }
    );
    if (!res.ok) {
      throw new Error(`Failed to load evidence file (${res.status})`);
    }
    return res.blob();
  },

  async downloadEvidence(evidenceId: number, filename: string): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(
      `${API_BASE_URL}/api/v1/evidence/${evidenceId}/download`,
      { headers }
    );
    if (!res.ok) {
      throw new Error(`Failed to download evidence file (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async getEvidenceGaps(investigationId: number): Promise<EvidenceGapsResponse> {
    return apiFetch<EvidenceGapsResponse>(
      `/api/v1/investigations/${investigationId}/evidence-gaps`,
      { method: 'GET' }
    );
  },

  async compareEvidence(
    investigationId: number,
    payload: CompareEvidenceRequest
  ): Promise<ImageAnalysisResult> {
    return apiFetch<ImageAnalysisResult>(
      `/api/v1/investigations/${investigationId}/evidence/compare`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async fetchDifferenceMapBlob(
    investigationId: number,
    beforeEvidenceId: number,
    afterEvidenceId: number
  ): Promise<Blob> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(
      `${API_BASE_URL}/api/v1/investigations/${investigationId}/evidence/compare/difference-map?before_evidence_id=${beforeEvidenceId}&after_evidence_id=${afterEvidenceId}`,
      { headers }
    );
    if (!res.ok) {
      let detailMsg = `Failed to generate difference map (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.detail) detailMsg = errJson.detail;
      } catch {
        // use default
      }
      throw new Error(detailMsg);
    }
    return res.blob();
  },

  async analyzeTemporalSequence(
    investigationId: number,
    payload: TemporalSequenceRequest
  ): Promise<TemporalSequenceResponse> {
    return apiFetch<TemporalSequenceResponse>(
      `/api/v1/investigations/${investigationId}/evidence/temporal-sequence`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },
};

export const mapApi = {
  async getMapInvestigations(): Promise<GeoJSONFeatureCollection> {
    return apiFetch<GeoJSONFeatureCollection>('/api/v1/map/investigations', {
      method: 'GET',
    });
  },
};
