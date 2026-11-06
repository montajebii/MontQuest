import { QuestHistoryEntry } from '../types';

/**
 * CSV export for the quest history (Could-have #3) — RFC 4180 escaping,
 * UTF-8 BOM so Excel renders Persian titles correctly.
 */

const HEADER = ['quest_id', 'title', 'completed_at', 'coins_awarded', 'xp_awarded'];

const escapeField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const buildHistoryCsv = (rows: QuestHistoryEntry[]): string => {
  const lines = [HEADER.join(',')];
  for (const row of rows) {
    lines.push(
      [
        String(row.quest_id),
        escapeField(row.title ?? ''),
        escapeField(new Date(row.completed_at).toISOString()),
        String(row.coins_awarded),
        String(row.xp_awarded),
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}`;
};
