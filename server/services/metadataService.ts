// server/services/metadataService.ts
// استخراج و پیشنهاد هوشمند متادیتای آثار با Google Gemini API

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export const aiSuggestionSchema = z.object({
  suggested_title: z.string().default(''),
  suggested_reciter: z.string().default(''),
  suggested_category: z.string().default(''),
  occasion: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export class MetadataService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initAi();
  }

  private initAi() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('[MetadataService] Failed to initialize GoogleGenAI:', err);
      }
    }
  }

  /**
   * استخراج و پیشنهاد متادیتا بر اساس عنوان و متن توضیحات اثر
   */
  public async suggestMetadata(
    rawTitle: string,
    rawDescription = ''
  ): Promise<AiSuggestion | null> {
    if (!this.ai) {
      this.initAi();
      if (!this.ai) {
        // اگر کلید جمینای ست نشده باشد، بدون توقف پردازش null برمی‌گرداند
        return null;
      }
    }

    try {
      const prompt = `
تو یک متخصص تحلیل و فهرست‌نویسی قطعات مذهبی، ادعیه و مداحی فارسی و عربی هستی.
اطلاعات زیر مربوط به یک اثر صوتی جدید است که وارد صف بررسی شده است:
عنوان خام: "${rawTitle}"
توضیحات: "${rawDescription.slice(0, 500)}"

وظیفه تو استخراج و استانداردسازی اطلاعات در قالب JSON دقیق با ساختار زیر است:
{
  "suggested_title": "عنوان پالایش شده، تمیز و بدون اموجی یا عبارات تبلیغاتی",
  "suggested_reciter": "نام مداح یا قاری اثر (مثلاً: محمود کریمی، میثم مطیعی، مهدی رسولی، یا نامشخص)",
  "suggested_category": "دسته کلی (مانند: محرم و عاشورا، فاطمیه، ادعیه و زیارات، رمضان، مولودی، یا عمومی)",
  "occasion": "مناسبت اثر (مثلاً: شب اول محرم، شام غریبان، شهادت حضرت زهرا، یا مدح)",
  "tags": ["حداکثر ۵ برچسب کلیدی و مناسب برای جستجو"]
}

پاسخ را فقط و فقط به صورت JSON معتبر بازگردان.
      `.trim();

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text?.trim() || '';
      if (!responseText) return null;

      const parsedJson = JSON.parse(responseText);
      const validated = aiSuggestionSchema.safeParse(parsedJson);

      if (validated.success) {
        return validated.data;
      }
      return null;
    } catch (err) {
      console.warn('[MetadataService] Error getting AI suggestions from Gemini:', err);
      // خطای Gemini نباید فرآیند ingest را متوقف کند (قاعده بخش ۵ و فاز ۳)
      return null;
    }
  }
}

export const metadataService = new MetadataService();
