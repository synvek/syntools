import { describe, expect, it } from 'vitest';
import { detectBrowserLang, mapBrowserLocale } from './types';

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

  it('returns null for unsupported languages', () => {
    expect(mapBrowserLocale('ko')).toBeNull();
    expect(mapBrowserLocale('ru-RU')).toBeNull();
    expect(mapBrowserLocale('')).toBeNull();
  });
});

describe('detectBrowserLang', () => {
  it('picks the first supported language in preference order', () => {
    expect(detectBrowserLang(['ko-KR', 'ja-JP', 'en'])).toBe('ja');
    expect(detectBrowserLang(['zh-TW', 'en'])).toBe('zh-TW');
  });

  it('falls back to English when nothing matches', () => {
    expect(detectBrowserLang([])).toBe('en');
    expect(detectBrowserLang(['ko', 'ru', 'ar'])).toBe('en');
  });
});
