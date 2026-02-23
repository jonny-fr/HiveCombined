// User types
export interface User {
  id: number;
  username: string;
  email: string;
}

// Event types
export interface Event {
  id: number;
  owner: User;
  title: string;
  location: string;
  starts_at: string;
  ends_at?: string;
  dresscode?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  title: string;
  location: string;
  starts_at: string;
  ends_at?: string;
  dresscode?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEventData {
  title?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  dresscode?: string;
  metadata?: Record<string, unknown>;
}

// Participation types
export type ZusageStatus = 'pending' | 'accepted' | 'declined';

export interface Participation {
  id: number;
  event: number;
  user: User;
  rsvp_status: ZusageStatus;
  plus_one_count?: number;
  allergies?: string;
  notes?: string;
  dresscode_visible?: boolean;
  contributions: ContributionItem[];
  custom_field_values: CustomFieldValue[];
  created_at: string;
  updated_at: string;
}

export interface UpdateParticipationData {
  rsvp_status?: ZusageStatus;
  plus_one_count?: number;
  allergies?: string;
  notes?: string;
  dresscode_visible?: boolean;
  contributions?: Array<{ item_name: string; quantity?: number; notes?: string }>;
  custom_field_answers?: Record<string, unknown>;
}

// Contribution types
export interface ContributionItem {
  id: number;
  event: number;
  participation: number;
  item_name: string;
  quantity?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContributionData {
  item_name: string;
  quantity?: number;
  notes?: string;
}

// Poll types
export interface PollOption {
  id: number;
  label: string;
  position: number;
}

export interface Poll {
  id: number;
  event: number;
  question: string;
  allows_multiple: boolean;
  opens_at?: string;
  closes_at?: string;
  options: PollOption[];
  created_at: string;
  updated_at: string;
}

export interface CreatePollData {
  question: string;
  allows_multiple?: boolean;
  opens_at?: string;
  closes_at?: string;
  options: Array<{ label: string; position?: number }>;
}

export interface VoteData {
  option_ids: number[];
}

export interface VoteResponse {
  poll_id: number;
  selected_option_ids: number[];
}

export interface PollResultOption {
  id: number;
  label: string;
  vote_count: number;
}

export interface PollResults {
  poll_id: number;
  question: string;
  allows_multiple: boolean;
  total_votes: number;
  unique_voters: number;
  options: PollResultOption[];
}

// Custom Field types
export type CustomFieldType = 'text' | 'number' | 'bool' | 'enum';

export interface CustomFieldDefinition {
  id: number;
  event: number;
  key: string;
  label: string;
  field_type: CustomFieldType;
  required: boolean;
  options?: string[];
  position: number;
  created_at: string;
}

export interface CreateCustomFieldData {
  key: string;
  label: string;
  field_type: CustomFieldType;
  required?: boolean;
  options?: string[];
  position?: number;
}

export interface CustomFieldValue {
  id: number;
  definition: number;
  definition_key: string;
  value: unknown;
}

// Invitation types
export interface SendInvitesData {
  emails?: string[];
  user_ids?: number[];
  expires_in_hours?: number;
}

export type InviteResponseStatus = 'accepted' | 'declined';

export interface InviteResponseData {
  status: InviteResponseStatus;
}

// Auth types
export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}
