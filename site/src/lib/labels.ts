/**
 * Chinese display labels for page types and relation kinds (Task 7). Used
 * by `page-info.ts` to build card rows and by any UI that needs to show a
 * `PageType`/`Rel` value to a reader.
 */
import type { PageType } from './schema';
import type { Rel } from './schema';

export const TYPE_LABEL: Record<PageType, string> = {
  topic: '主题',
  concept: '概念',
  paper: '论文',
  blog: 'Blog',
  video: '视频',
  podcast: '播客',
  entity: '实体',
  raw: '',
};

export const REL_LABEL: Record<Rel, string> = {
  proposes: '提出',
  extends: '扩展',
  supports: '支持',
  challenges: '反驳',
  applies: '使用',
  explains: '讲解',
  responds: '回应',
  'part-of': '属于',
  'alternative-to': '对照',
};
