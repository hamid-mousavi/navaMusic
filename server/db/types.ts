// server/db/types.ts
// تعاریف مدل‌ها و رابط‌های مخازن داده (Repository Pattern)

export interface User {
  id: string;
  telegram_id: string | null;
  username: string | null;
  password_hash: string | null;
  role: 'admin' | 'reviewer';
  active: number;
  created_at: string;
}

export interface Reciter {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatar_url: string;
  tracks_count: number;
  style: string;
  accent_color: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon_name: string;
  tracks_count: number;
  description: string;
}

export type SourceType = 'youtube_channel' | 'telegram_channel' | 'web_url';
export type SourceSchedule = 'manual' | 'every_6h' | 'daily';

export interface SourceFilters {
  min_duration?: number;
  max_duration?: number;
  include_keywords?: string[];
  exclude_keywords?: string[];
}

export interface Source {
  id: string;
  type: SourceType;
  ref: string;
  title: string;
  schedule: SourceSchedule;
  enabled: number;
  auto_publish: number;
  default_reciter_id: string | null;
  default_category_id: string | null;
  filters_json: string;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export type JobTrigger = 'scheduled' | 'manual' | 'bot';

export interface ScanJob {
  id: string;
  source_id: string;
  trigger: JobTrigger;
  status: JobStatus;
  found: number;
  new_count: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export type TrackStatus =
  | 'pending'
  | 'uploading'
  | 'published'
  | 'rejected'
  | 'upload_failed'
  | 'hidden';

export interface TrackLyric {
  id: string;
  time: number;
  textArabic: string;
  textPersian: string;
}

export interface Track {
  id: string;
  title: string;
  reciter_id: string | null;
  category_id: string | null;
  occasion: string | null;
  tags_json: string;
  lyrics_json: string;
  duration: number;
  bitrate: string;
  file_size: number;
  content_hash: string | null;
  source_id: string | null;
  source_type: string | null;
  source_external_id: string | null;
  source_url: string | null;
  source_owner_name: string | null;
  staging_path: string | null;
  s3_key: string | null;
  audio_url: string | null;
  cover_url: string;
  ai_suggestion_json: string | null;
  status: TrackStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  channel_message_id: string | null;
  play_count: number;
  created_at: string;
  // Joined fields for view convenience
  reciter_name?: string;
  category_name?: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actor_type: 'web' | 'bot' | 'system' | 'worker';
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta_json: string;
}

export interface TakedownRequest {
  id: string;
  track_id: string;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_contact?: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  created_at: string;
}

// -------------------------------------------------------------
// مخازن داده (Repository Interfaces)
// -------------------------------------------------------------

export interface ITrackRepo {
  findById(id: string): Track | null;
  findBySource(sourceType: string, sourceExternalId: string): Track | null;
  findByContentHash(hash: string): Track | null;
  listPublished(options?: {
    query?: string;
    reciterId?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  }): { tracks: Track[]; total: number };
  listCandidates(status?: TrackStatus): Track[];
  listAll(): Track[];
  create(track: Track): Track;
  update(id: string, updates: Partial<Track>): Track | null;
  delete(id: string): boolean;
  incrementPlayCount(id: string): void;
  countByStatus(status: TrackStatus): number;
}

export interface IReciterRepo {
  findAll(): Reciter[];
  findById(id: string): Reciter | null;
  create(reciter: Reciter): Reciter;
  update(id: string, updates: Partial<Reciter>): Reciter | null;
  delete(id: string): boolean;
  updateTracksCount(id: string, delta: number): void;
}

export interface ICategoryRepo {
  findAll(): Category[];
  findById(id: string): Category | null;
  findBySlug(slug: string): Category | null;
  create(category: Category): Category;
  update(id: string, updates: Partial<Category>): Category | null;
  delete(id: string): boolean;
  updateTracksCount(id: string, delta: number): void;
}

export interface ISourceRepo {
  findAll(): Source[];
  findById(id: string): Source | null;
  findDueForScan(now: string): Source[];
  create(source: Source): Source;
  update(id: string, updates: Partial<Source>): Source | null;
  delete(id: string): boolean;
}

export interface IScanJobRepo {
  findAll(limit?: number): ScanJob[];
  findById(id: string): ScanJob | null;
  create(job: ScanJob): ScanJob;
  update(id: string, updates: Partial<ScanJob>): ScanJob | null;
  findActiveJobs(): ScanJob[];
}

export interface IUserRepo {
  findAll(): User[];
  findById(id: string): User | null;
  findByUsername(username: string): User | null;
  findByTelegramId(telegramId: string): User | null;
  create(user: User): User;
  update(id: string, updates: Partial<User>): User | null;
  delete(id: string): boolean;
  count(): number;
}

export interface IAuditRepo {
  log(entry: Omit<AuditLog, 'id' | 'at'> & { id?: string; at?: string }): AuditLog;
  listRecent(limit?: number): AuditLog[];
  filter(params: { actor_type?: string; action?: string; limit?: number }): AuditLog[];
  deleteOlderThan(cutoffIsoDate: string): number;
}

export interface ISettingsRepo {
  get(key: string, defaultValue?: string): string | null;
  set(key: string, value: string): void;
  getJson<T>(key: string): T | null;
  setJson(key: string, value: any): void;
  getAll(): Record<string, string>;
}
