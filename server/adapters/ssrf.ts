// server/adapters/ssrf.ts
// حفاظت ضد SSRF بر اساس الزامات امنیتی بخش ۵ و فاز ۴

import dns from 'dns/promises';
import { URL } from 'url';

/**
 * بررسی آیا یک آدرس IP در بازه‌های خصوصی، لوکال یا متادیتای ابری قرار دارد یا خیر
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback & Special
  if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip === 'localhost') return true;

  // IPv6 Loopback & Local
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:')) return true;

  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link Local & Cloud Metadata مثل 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
  }

  return false;
}

/**
 * اعتبارسنجی یک URL عمومی پیش از ارسال درخواست
 * در صورت تشخیص دامنه داخلی یا IP خصوصی، خطا پرتاب می‌کند
 */
export async function validateSafeUrl(rawUrl: string): Promise<string> {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`پروتکل نامعتبر است: ${parsed.protocol}. تنها http و https مجاز هستند.`);
  }

  const hostname = parsed.hostname;

  // مسدودسازی هاست‌های ممنوعه لوکال
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error(`دسترسی به مقاصد محلی مسدود است (SSRF Protection): ${hostname}`);
  }

  // بررسی مستقیم در صورتی که هاست یک IP باشد
  if (isPrivateIp(hostname)) {
    throw new Error(`دسترسی به آدرس‌های IP خصوصی مسدود است (SSRF Protection): ${hostname}`);
  }

  // رزولو کردن DNS و بررسی IP حاصل
  try {
    const lookupResult = await dns.lookup(hostname);
    if (isPrivateIp(lookupResult.address)) {
      throw new Error(
        `دامنه ${hostname} به یک IP خصوصی نگاشت می‌شود (${lookupResult.address}) - دسترسی مسدود شد.`
      );
    }
  } catch (dnsErr: any) {
    if (dnsErr.message.includes('SSRF Protection') || dnsErr.message.includes('مسدود شد')) {
      throw dnsErr;
    }
    // خطاهای عدم یافتن DNS
    throw new Error(`خطا در اعتبارسنجی هاست ${hostname}: ${dnsErr.message}`);
  }

  return rawUrl;
}
