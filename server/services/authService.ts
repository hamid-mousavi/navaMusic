// server/services/authService.ts
// سرویس احراز هویت، رمزنگاری و مدیریت نشست‌ها

import crypto from 'crypto';
import { userRepo, auditRepo } from '../db/repos/index.js';
import { User } from '../db/types.js';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'nava_music_secure_session_secret_2026';

// جدول نشست‌های فعال در حافظه
interface ActiveSession {
  userId: string;
  username: string;
  role: 'admin' | 'reviewer';
  createdAt: number;
}

const activeSessions = new Map<string, ActiveSession>();
const invalidatedTokens = new Set<string>();

// -------------------------------------------------------------
// توابع رمزنگاری کلمه‌عبور (Crypto Scrypt + Salt)
// -------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch (_) {
    return false;
  }
}

// -------------------------------------------------------------
// تولید و اعتبارسنجی توکن نشست (Signed Token)
// -------------------------------------------------------------
export function createSessionToken(user: User): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const payload = `${user.id}:${randomBytes}`;
  const hmac = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
  const token = `${payload}.${hmac}`;

  activeSessions.set(token, {
    userId: user.id,
    username: user.username || 'کاربر',
    role: user.role,
    createdAt: Date.now(),
  });

  return token;
}

export function verifySessionToken(token?: string): ActiveSession | null {
  if (!token || invalidatedTokens.has(token)) return null;

  // ۱. بررسی کش نشست‌های فعال
  const inMemory = activeSessions.get(token);
  if (inMemory) {
    return inMemory;
  }

  // ۲. اعتبارسنجی امضای توکن در صورت راه‌اندازی مجدد سرور
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const [userId] = payload.split(':');
    const user = userRepo.findById(userId);
    if (!user || user.active !== 1) return null;

    const session: ActiveSession = {
      userId: user.id,
      username: user.username || 'کاربر',
      role: user.role,
      createdAt: Date.now(),
    };
    activeSessions.set(token, session);
    return session;
  } catch (_) {
    return null;
  }
}

export function destroySession(token: string): void {
  activeSessions.delete(token);
  invalidatedTokens.add(token);
}

// -------------------------------------------------------------
// سرویس احراز هویت اصلی
// -------------------------------------------------------------
export class AuthService {
  /**
   * ایجاد کاربر ادمین اولیه در صورت خالی بودن دیتابیس کاربران
   */
  public initBootstrapAdmin(): void {
    const count = userRepo.count();
    if (count === 0) {
      const username = process.env.BOOTSTRAP_ADMIN_USER || 'admin';
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin123456';

      const adminUser: User = {
        id: `user-admin-${Date.now()}`,
        telegram_id: null,
        username,
        password_hash: hashPassword(password),
        role: 'admin',
        active: 1,
        created_at: new Date().toISOString(),
      };

      userRepo.create(adminUser);
      console.log(`[AuthService] Bootstrap admin user created: "${username}"`);

      auditRepo.log({
        actor_type: 'system',
        actor_id: 'bootstrap',
        action: 'admin_user_created',
        entity: 'users',
        entity_id: adminUser.id,
        meta_json: JSON.stringify({ username }),
      });
    }
  }

  /**
   * ورود با نام کاربری و کلمه‌عبور
   */
  public async login(
    username: string,
    password: string,
    ip = '127.0.0.1'
  ): Promise<{ token: string; user: Omit<User, 'password_hash'> } | null> {
    const user = userRepo.findByUsername(username.trim());
    if (!user || !user.password_hash || user.active !== 1) {
      auditRepo.log({
        actor_type: 'web',
        actor_id: null,
        action: 'login_failed',
        entity: 'users',
        entity_id: null,
        meta_json: JSON.stringify({ username, ip }),
      });
      return null;
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      auditRepo.log({
        actor_type: 'web',
        actor_id: user.id,
        action: 'login_failed_bad_password',
        entity: 'users',
        entity_id: user.id,
        meta_json: JSON.stringify({ username, ip }),
      });
      return null;
    }

    const token = createSessionToken(user);

    auditRepo.log({
      actor_type: 'web',
      actor_id: user.id,
      action: 'login_success',
      entity: 'users',
      entity_id: user.id,
      meta_json: JSON.stringify({ username, role: user.role, ip }),
    });

    const { password_hash, ...safeUser } = user;
    return { token, user: safeUser };
  }

  /**
   * خروج از حساب کاربری
   */
  public logout(token: string, userId?: string): void {
    destroySession(token);
    if (userId) {
      auditRepo.log({
        actor_type: 'web',
        actor_id: userId,
        action: 'logout',
        entity: 'users',
        entity_id: userId,
        meta_json: '{}',
      });
    }
  }
}

export const authService = new AuthService();
