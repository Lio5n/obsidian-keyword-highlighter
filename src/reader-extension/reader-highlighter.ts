import type { MarkdownPostProcessor } from 'obsidian';
import { type KeywordStyle, getCssClasses } from 'src/shared';
import { settingsStore } from 'src/stores/settings-store';
import { get } from 'svelte/store';

// 🔹 日期关键字映射表
const dateKeywordMap: Record<string, () => string> = {
  TODAY: () => getRelativeDate(0),
  YESTERDAY: () => getRelativeDate(-1),
  // 可以继续添加：
  // TOMORROW: () => getRelativeDate(1),
};

// 🔧 获取相对日期字符串，例如 offset=-1 昨天，0 今天，1 明天
function getRelativeDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const readerHighlighter: MarkdownPostProcessor = (el: HTMLElement) => {
  const settings = get(settingsStore);

  settings.keywords
    .filter((keyword) => !!keyword.keyword)
    .forEach((keyword) => {
      const mapFn = dateKeywordMap[keyword.keyword.toUpperCase()];
      const keywordToUse = mapFn ? mapFn() : keyword.keyword;

      replaceWithHighlight(el, { ...keyword, keyword: keywordToUse });
    });
};

function replaceWithHighlight(node: Node, keyword: KeywordStyle) {
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (<Element>node).classList.contains('kh-highlighted')
  ) {
    return;
  } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    const searchText = `${keyword.keyword}`;
    const index = node.nodeValue.indexOf(searchText);
    if (index > -1) {
      const parent = node.parentNode!;
      const beforeText = node.nodeValue.substring(0, index);
      const afterText = node.nodeValue.substring(index + searchText.length);
      const highlight = getHighlightNode(parent, searchText, keyword);

      parent.insertBefore(document.createTextNode(beforeText), node);
      parent.insertBefore(highlight, node);
      node.nodeValue = afterText;

      parent.childNodes.forEach((child) => replaceWithHighlight(child, keyword));
    }
    return;
  }

  node.childNodes.forEach((child) => replaceWithHighlight(child, keyword));
}

function getHighlightNode(parent: Node, searchText: string, keyword: KeywordStyle): Node {
  const highlight = parent.createSpan();
  highlight.classList.add(...getCssClasses(keyword).split(' '));

  if (keyword.showColor ?? true) {
    highlight.style.setProperty('--kh-c', keyword.color);
  }
  if (keyword.showBackgroundColor ?? true) {
    highlight.style.setProperty('--kh-bgc', keyword.backgroundColor);
  }

  highlight.setText(searchText);
  return highlight;
}
