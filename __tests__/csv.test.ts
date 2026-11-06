import { describe, it, expect } from '@jest/globals';
import { buildHistoryCsv } from '../src/utils/csv';
import { QuestHistoryEntry } from '../src/types';

const row = (over: Partial<QuestHistoryEntry> = {}): QuestHistoryEntry => ({
  id: 1,
  quest_id: 7,
  title: 'خرید نان',
  completed_at: Date.UTC(2026, 0, 2, 3, 4, 5),
  coins_awarded: 10,
  xp_awarded: 25,
  ...over,
});

describe('buildHistoryCsv (Could-have #3)', () => {
  it('emits a UTF-8 BOM and the header row', () => {
    const csv = buildHistoryCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('quest_id,title,completed_at,coins_awarded,xp_awarded');
  });

  it('serializes rows with ISO timestamps', () => {
    const csv = buildHistoryCsv([row()]);
    expect(csv).toContain('7,خرید نان,2026-01-02T03:04:05.000Z,10,25');
  });

  it('quotes titles containing ASCII commas', () => {
    // U+060C (Persian comma) is NOT a field separator — only ASCII ',' is.
    const csv = buildHistoryCsv([row({ title: 'خرید نان, پنیر' })]);
    expect(csv).toContain('7,"خرید نان, پنیر",');
  });

  it('escapes embedded quotes by doubling them', () => {
    const csv = buildHistoryCsv([row({ title: 'سطل "طلایی"' })]);
    expect(csv).toContain('7,"سطل ""طلایی""",');
  });

  it('keeps titles with newlines inside quotes', () => {
    const csv = buildHistoryCsv([row({ title: 'خط اول\nخط دوم' })]);
    expect(csv).toContain('7,"خط اول\nخط دوم",');
  });

  it('uses an empty field for a missing title', () => {
    const csv = buildHistoryCsv([row({ title: null })]);
    expect(csv).toContain('7,,2026-01-02T03:04:05.000Z,10,25');
  });
});
