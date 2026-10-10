// server/middleware/auth.ts
// میدل‌ورهای احراز هویت و کنترل دسترسی بر اساس نقش (RBAC)

import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: 'admin' | 'reviewer';
  };
}

/**
 * استخراج توکن از کوکی یا هدر Authorization
 */
function extractToken(req: Request): string | undefined {
  if (req.cookies && req.cookies.nava_session) {
    return req.cookies.nava_session;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return undefined;
}

/**
 * میدل‌ور اجباری احراز هویت (ورود الزامی است)
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'احراز هویت الزامی است. لطفاً ابتدا وارد پنل مدیریت شوید.',
    });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'نشست کاربری شما منقضی یا نامعتبر شده است. لطفاً مجدداً وارد شوید.',
    });
  }

  req.user = session;
  next();
}

/**
 * میدل‌ور بررسی نقش کاربر ('admin' یا 'reviewer')
 */
export function requireRole(requiredRole: 'admin' | 'reviewer') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'احراز هویت الزامی است.' });
      }

      if (requiredRole === 'admin' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'دسترسی غیرمجاز: این عملیات صرفاً توسط مدیر سامانه (admin) قابل انجام است.',
        });
      }

      // اگر نقش reviewer درخواست شده باشد، هر دو نقش reviewer و admin دسترسی دارند
      next();
    });
  };
}

/**
 * میدل‌ور اختصاصی توکن سرویس داخلی برای ورکرها (Telethon و پردازش‌ها)
 */
export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const expectedToken = process.env.INTERNAL_API_TOKEN || 'nava_internal_worker_secret_2026';

  if (!expectedToken || !token || token !== expectedToken) {
    return res.status(401).json({
      success: false,
      error: 'دسترسی غیرمجاز سرویس داخلی (Invalid or Missing Internal API Token).',
    });
  }

  next();
}
