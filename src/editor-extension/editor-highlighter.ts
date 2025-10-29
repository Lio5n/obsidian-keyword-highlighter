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
    // 可以继续添加新关键字，例如:
    // TOMORROW: () => this.getRelativeDate(1),
  };

  constructor(view: EditorView) {
    this.lastDateStr = this.getTodayString();
    this.decorations = this.buildDecorations(view);

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

  // 🔧 当天日期
  getTodayString(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // 🔧 相对日期，例如 -1 = 昨天, 1 = 明天
  getRelativeDate(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const newDecorations: NewDecoration[] = [];

    const settings = get(settingsStore);

    settings.keywords.filter((k) => !!k.keyword).forEach((k) => {
      let keywordToUse = k.keyword;

      // 🪄 如果关键字在 dateKeywordMap 中，则用对应函数结果替换
      const mapFn = this.dateKeywordMap[keywordToUse.toUpperCase()];
      if (mapFn) {
        keywordToUse = mapFn();
      }

      newDecorations.push(...this.buildDecorationsForKeyword(view, { ...k, keyword: keywordToUse }));
    });

    newDecorations.sort((a, b) => a.from - b.from);
    newDecorations.forEach((d) => builder.add(d.from, d.to, d.decoration));

    return builder.finish();
  }

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

export const editorHighlighter = ViewPlugin.fromClass(EditorHighlighter, {
  decorations: (value: EditorHighlighter) => value.decorations,
});
