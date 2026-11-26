import { describe, expect, test } from 'vitest';
import { pageSchema } from '../src/lib/schema';

const paper = {
  title: 'T',
  type: 'paper',
  summary: '一句话',
  topics: ['context'],
  aliases: [],
  added: '2026-11-26',
  date: '2026-11-03',
  url: 'https://arxiv.org/abs/2611.05306',
  source_dir: 'sources/papers/2611.05306',
  venue: 'arXiv',
  by: [{ entity: 'nvidia', role: 'org' }],
  relations: [{ concept: 'context-compaction', rel: 'proposes' }],
};

test('valid paper passes', () => expect(pageSchema.safeParse(paper).success).toBe(true));

test('summary over 60 chars fails', () =>
  expect(pageSchema.safeParse({ ...paper, summary: '字'.repeat(61) }).success).toBe(false));

test('unknown rel fails', () =>
  expect(
    pageSchema.safeParse({ ...paper, relations: [{ concept: 'x', rel: 'likes' }] }).success,
  ).toBe(false));

test('relation with two targets fails', () =>
  expect(
    pageSchema.safeParse({ ...paper, relations: [{ concept: 'x', source: 'y', rel: 'extends' }] })
      .success,
  ).toBe(false));

test('source page needs at least one relation', () =>
  expect(pageSchema.safeParse({ ...paper, relations: [] }).success).toBe(false));

test('video requires duration', () =>
  expect(pageSchema.safeParse({ ...paper, type: 'video', venue: 'Bilibili' }).success).toBe(
    false,
  ));

test('podcast requires a host and a guest in by', () =>
  expect(
    pageSchema.safeParse({
      ...paper,
      type: 'podcast',
      duration: 41,
      by: [{ name: 'Koji', role: 'host' }],
    }).success,
  ).toBe(false));

test('concept status defaults to emerging', () =>
  expect(
    pageSchema.parse({
      title: 'C',
      type: 'concept',
      summary: 's',
      topics: ['context'],
      added: '2026-11-26',
      relations: [{ topic: 'context', rel: 'part-of' }],
    }).status,
  ).toBe('emerging'));

test('topic root flag and order', () =>
  expect(
    pageSchema.parse({
      title: 'Agent',
      type: 'topic',
      summary: 's',
      added: '2026-11-26',
      root: true,
      order: 0,
    }).root,
  ).toBe(true));

test('raw page needs only title', () =>
  expect(pageSchema.safeParse({ title: 'transcript', type: 'raw' }).success).toBe(true));

describe('url / code must be http(s)', () => {
  test.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://x', '/relative', 'arxiv.org/abs/1'])(
    'url %s fails',
    (url) => expect(pageSchema.safeParse({ ...paper, url }).success).toBe(false),
  );
  test.each(['javascript:alert(1)', 'github.com/x'])('code %s fails', (code) =>
    expect(pageSchema.safeParse({ ...paper, code }).success).toBe(false),
  );
  test('http and https pass', () => {
    expect(pageSchema.safeParse({ ...paper, url: 'http://example.com/a' }).success).toBe(true);
    expect(pageSchema.safeParse({ ...paper, code: 'https://github.com/x/y' }).success).toBe(true);
  });
});
