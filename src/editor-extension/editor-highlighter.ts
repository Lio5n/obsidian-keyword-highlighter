import { SearchCursor } from '@codemirror/search';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, type PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { highlightMark } from 'src/editor-extension';
import type { KeywordStyle } from 'src/shared';
import { settingsStore } from 'src/stores/settings-store';
import { get } from 'svelte/store';

type NewDecoration = { from: number; to: number; decoration: Decoration };

export class EditorHighlighter implements PluginValue {
  decorations: DecorationSet;
  unsubscribe: () => void;
  intervalId?: NodeJS.Timeout;
  lastDateStr: string;

  // 🗓 可扩展日期关键字映射表
  dateKeywordMap: Record<string, () => string> = {
    TODAY: () => this.getTodayString(),
    YESTERDAY: () => this.getRelativeDate(-1),
    TOMORROW: () => this.getRelativeDate(1),
  };

  constructor(view: EditorView) {
    this.lastDateStr = this.getTodayString();
    this.decorations = this.buildDecorations(view);

    // 🧩 订阅设置变化，当关键字或样式改变时自动更新
    this.unsubscribe = settingsStore.subscribe(() => {
      setTimeout(() => {
        try {
          if (view.state) {
            this.decorations = this.buildDecorations(view);
            view.requestMeasure();
          }
        } catch (e) {
          this.unsubscribe();
        }
      }, 0);
    });

    // 🕒 每5分钟检查一次日期是否变化，若跨天则重新构建高亮
    this.intervalId = setInterval(() => {
      const newDateStr = this.getTodayString();
      if (newDateStr !== this.lastDateStr) {
        this.lastDateStr = newDateStr;
        this.decorations = this.buildDecorations(view);
        view.requestMeasure();
      }
    }, 5 * 60 * 1000);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  destroy(): void {
    this.unsubscribe();
    if (this.intervalId) clearInterval(this.intervalId);
  }

  // 🔧 获取当天日期
  getTodayString(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // 🔧 获取相对日期，例如 -1 = 昨天, 1 = 明天
  getRelativeDate(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  // 🔍 从 map 查找关键字对应日期
  getKeywordFromMap(keyword: string): string | undefined {
    const fn = this.dateKeywordMap[keyword.toUpperCase()];
    return fn ? fn() : undefined;
  }

  // 🔍 处理 D±n 规则，例如 D-3、D+7
  getDynamicRelativeDate(keyword: string): string | undefined {
    const match = /^D([+-]\d+)$/.exec(keyword.toUpperCase());
    if (match) {
      const n = parseInt(match[1], 10);
      return this.getRelativeDate(n);
    }
    return undefined;
  }

  // 🔧 获取关键字最终显示文本
  getKeywordData(keyword: string): string {
    return this.getKeywordFromMap(keyword)
        ?? this.getDynamicRelativeDate(keyword)
        ?? keyword; // 默认返回原关键字
  }

  // 🏗 构建所有高亮装饰
  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const newDecorations: NewDecoration[] = [];

    const settings = get(settingsStore);

    settings.keywords.filter((k) => !!k.keyword).forEach((k) => {
      // 🪄 获取关键字最终显示文本（支持 map + D±n）
      const keywordToUse = this.getKeywordData(k.keyword);

      // 构建装饰
      newDecorations.push(...this.buildDecorationsForKeyword(view, { ...k, keyword: keywordToUse }));
    });

    // 排序并添加到 builder
    newDecorations.sort((a, b) => a.from - b.from);
    newDecorations.forEach((d) => builder.add(d.from, d.to, d.decoration));

    return builder.finish();
  }

  // 🔧 根据关键字生成装饰
  buildDecorationsForKeyword(view: EditorView, keyword: KeywordStyle): NewDecoration[] {
    const newDecorations: NewDecoration[] = [];
    const cursor = new SearchCursor(view.state.doc, keyword.keyword);
    cursor.next();
    while (!cursor.done) {
      newDecorations.push({
        from: cursor.value.from,
        to: cursor.value.to,
        decoration: highlightMark(keyword),
      });
      cursor.next();
    }
    return newDecorations;
  }
}

// 🖇 注册编辑器插件
export const editorHighlighter = ViewPlugin.fromClass(EditorHighlighter, {
  decorations: (value: EditorHighlighter) => value.decorations,
});
