// server/services/sourceService.ts
// مدیریت منابع پایش، فیلترها و زمان‌بندی (CRUD & Scheduling Rules)

import { sourceRepo, auditRepo } from '../db/repos/index.js';
import { Source, SourceFilters } from '../db/types.js';

export class SourceService {
  public listSources(): Source[] {
    return sourceRepo.findAll();
  }

  public getSource(id: string): Source | null {
    return sourceRepo.findById(id);
  }

  public createSource(data: {
    type: 'youtube_channel' | 'telegram_channel' | 'web_url';
    ref: string;
    title: string;
    schedule?: 'manual' | 'every_6h' | 'daily';
    auto_publish?: boolean;
    default_reciter_id?: string;
    default_category_id?: string;
    filters?: SourceFilters;
    actor?: string;
  }): Source {
    const id = `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newSource: Source = {
      id,
      type: data.type,
      ref: data.ref.trim(),
      title: data.title.trim(),
      schedule: data.schedule || 'daily',
      enabled: 1,
      auto_publish: data.auto_publish ? 1 : 0,
      default_reciter_id: data.default_reciter_id || null,
      default_category_id: data.default_category_id || null,
      filters_json: JSON.stringify(data.filters || {}),
      last_run_at: null,
      last_status: 'ready',
      created_at: new Date().toISOString(),
    };

    sourceRepo.create(newSource);

    auditRepo.log({
      actor_type: 'web',
      actor_id: data.actor || null,
      action: 'source_created',
      entity: 'sources',
      entity_id: id,
      meta_json: JSON.stringify({ title: newSource.title, type: newSource.type }),
    });

    return newSource;
  }

  public updateSource(id: string, updates: Partial<Source>, actor?: string): Source | null {
    const updated = sourceRepo.update(id, updates);
    if (updated) {
      auditRepo.log({
        actor_type: 'web',
        actor_id: actor || null,
        action: 'source_updated',
        entity: 'sources',
        entity_id: id,
        meta_json: JSON.stringify(updates),
      });
    }
    return updated;
  }

  public deleteSource(id: string, actor?: string): boolean {
    const ok = sourceRepo.delete(id);
    if (ok) {
      auditRepo.log({
        actor_type: 'web',
        actor_id: actor || null,
        action: 'source_deleted',
        entity: 'sources',
        entity_id: id,
        meta_json: '{}',
      });
    }
    return ok;
  }

  /**
   * شناسایی منابع سررسید شده جهت اسکن زمان‌بندی‌شده
   */
  public getDueSources(): Source[] {
    const all = sourceRepo.findAll().filter((s) => s.enabled === 1);
    const now = Date.now();

    return all.filter((s) => {
      if (s.schedule === 'manual') return false;

      if (!s.last_run_at) return true; // تاکنون اجرا نشده

      const lastRun = new Date(s.last_run_at).getTime();
      const diffHours = (now - lastRun) / (1000 * 60 * 60);

      if (s.schedule === 'every_6h') {
        return diffHours >= 6;
      }
      if (s.schedule === 'daily') {
        return diffHours >= 24;
      }

      return false;
    });
  }
}

export const sourceService = new SourceService();
