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
  intervalId?: NodeJS.Timeout; // ⏰ 用于保存定时器ID
  lastDateStr: string; // 记录上次的日期字符串

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
    }, 5 * 60 * 1000); // 5分钟
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

  // 🔧 生成当天日期字符串 (YYYY-MM-DD)
  getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const newDecorations: NewDecoration[] = [];

    const settings = get(settingsStore);

    // 🧠 遍历所有关键字
    settings.keywords
      .filter((keyword) => !!keyword.keyword)
      .forEach((k) => {
        let keywordToUse = k.keyword;

        // 🪄 当关键字是 "TODAY" 时，用当天日期替换
        if (keywordToUse.toUpperCase() === 'TODAY') {
          keywordToUse = this.getTodayString();
        }

        newDecorations.push(...this.buildDecorationsForKeyword(view, { ...k, keyword: keywordToUse }));
      });

    // 排序+合并
    newDecorations.sort((a, b) => a.from - b.from);
    newDecorations.forEach((d) => builder.add(d.from, d.to, d.decoration));

    return builder.finish();
  }

  buildDecorationsForKeyword(view: EditorView, keyword: KeywordStyle): NewDecoration[] {
    const newDecorations: NewDecoration[] = [];
    const cursor = new SearchCursor(view.state.doc, `${keyword.keyword}`);
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

export const editorHighlighter = ViewPlugin.fromClass(EditorHighlighter, {
  decorations: (value: EditorHighlighter) => value.decorations,
});
