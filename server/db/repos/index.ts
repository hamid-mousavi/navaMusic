// server/db/repos/index.ts
import { TrackRepo } from './trackRepo.js';
import { ReciterRepo } from './reciterRepo.js';
import { CategoryRepo } from './categoryRepo.js';
import { SourceRepo } from './sourceRepo.js';
import { ScanJobRepo } from './jobRepo.js';
import { UserRepo } from './userRepo.js';
import { AuditRepo } from './auditRepo.js';
import { SettingsRepo } from './settingsRepo.js';

export const trackRepo = new TrackRepo();
export const reciterRepo = new ReciterRepo();
export const categoryRepo = new CategoryRepo();
export const sourceRepo = new SourceRepo();
export const scanJobRepo = new ScanJobRepo();
export const userRepo = new UserRepo();
export const auditRepo = new AuditRepo();
export const settingsRepo = new SettingsRepo();

export * from './trackRepo.js';
export * from './reciterRepo.js';
export * from './categoryRepo.js';
export * from './sourceRepo.js';
export * from './jobRepo.js';
export * from './userRepo.js';
export * from './auditRepo.js';
export * from './settingsRepo.js';
