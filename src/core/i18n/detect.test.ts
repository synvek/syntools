import { describe, expect, it } from 'vitest';
import {
  collectBrowserLocales,
  detectBrowserLang,
  mapBrowserLocale,
  normalizeLang,
} from './types';

describe('mapBrowserLocale', () => {
  it('maps exact and primary tags', () => {
    expect(mapBrowserLocale('en')).toBe('en');
    expect(mapBrowserLocale('en-US')).toBe('en');
    expect(mapBrowserLocale('ja-JP')).toBe('ja');
    expect(mapBrowserLocale('fr-CA')).toBe('fr');
    expect(mapBrowserLocale('pt-BR')).toBe('pt');
    expect(mapBrowserLocale('de-DE')).toBe('de');
    expect(mapBrowserLocale('it')).toBe('it');
    expect(mapBrowserLocale('es-MX')).toBe('es');
  });

  it('distinguishes simplified vs traditional Chinese', () => {
    expect(mapBrowserLocale('zh')).toBe('zh');
    expect(mapBrowserLocale('zh-CN')).toBe('zh');
    expect(mapBrowserLocale('zh-Hans')).toBe('zh');
    expect(mapBrowserLocale('zh-SG')).toBe('zh');
    expect(mapBrowserLocale('zh-TW')).toBe('zh-TW');
    expect(mapBrowserLocale('zh-HK')).toBe('zh-TW');
    expect(mapBrowserLocale('zh-MO')).toBe('zh-TW');
    expect(mapBrowserLocale('zh-Hant')).toBe('zh-TW');
    expect(mapBrowserLocale('zh-Hant-TW')).toBe('zh-TW');
  });

  it('normalizes case for zh-TW', () => {
    expect(normalizeLang('zh-tw')).toBe('zh-TW');
    expect(mapBrowserLocale('ZH-CN')).toBe('zh');
  });

  it('returns null for unsupported languages', () => {
    expect(mapBrowserLocale('ko')).toBeNull();
    expect(mapBrowserLocale('ru-RU')).toBeNull();
    expect(mapBrowserLocale('')).toBeNull();
  });
});

describe('detectBrowserLang', () => {
  it('picks the first supported language in preference order', () => {
    expect(detectBrowserLang(['ko-KR', 'ja-JP', 'en'], null)).toBe('ja');
    expect(detectBrowserLang(['zh-TW', 'en'], null)).toBe('zh-TW');
  });

  it('prefers system locale over browser UI language list', () => {
    // 中文系统 + Chrome UI 英文：navigator 常为 en-US 在前
    expect(detectBrowserLang(['en-US', 'en', 'zh-CN', 'zh'], 'zh-CN')).toBe('zh');
    expect(detectBrowserLang(['en-US', 'zh-TW'], 'zh-Hant-TW')).toBe('zh-TW');
  });

  it('falls back to English when nothing matches', () => {
    expect(detectBrowserLang([], null)).toBe('en');
    expect(detectBrowserLang(['ko', 'ru', 'ar'], null)).toBe('en');
  });

  it('collectBrowserLocales puts system locale first', () => {
    expect(collectBrowserLocales(['en-US', 'zh-CN'], 'zh-CN')).toEqual([
      'zh-CN',
      'en-US',
    ]);
  });
});
