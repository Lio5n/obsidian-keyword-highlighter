import type { MarkdownPostProcessor } from 'obsidian';
import { type KeywordStyle, getCssClasses } from 'src/shared';
import { settingsStore } from 'src/stores/settings-store';
import { get } from 'svelte/store';

// 🔧 获取当天日期字符串
function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const readerHighlighter: MarkdownPostProcessor = (el: HTMLElement) => {
  const settings = get(settingsStore);

  settings.keywords
    .filter((keyword) => !!keyword.keyword)
    .forEach((keyword) => {
      // 🔥 如果关键字是 "TODAY"，替换为当天日期
      const keywordToUse =
        keyword.keyword.toUpperCase() === 'TODAY' ? getTodayString() : keyword.keyword;

      // 保留原样式，只替换关键字文本
      replaceWithHighlight(el, { ...keyword, keyword: keywordToUse });
    });
};

function replaceWithHighlight(node: Node, keyword: KeywordStyle) {
  if (
    // skip highlighting nodes
    node.nodeType === Node.ELEMENT_NODE &&
    (<Element>node).classList.contains('kh-highlighted')
  ) {
    return;
  } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    const searchText = `${keyword.keyword}`;
    const index = node.nodeValue.indexOf(searchText);
    if (index > -1) {
      // parent cannot be null
      const parent = node.parentNode!;
      const beforeText = node.nodeValue.substring(0, index);
      const afterText = node.nodeValue.substring(index + searchText.length);
      const highlight = getHighlightNode(parent, searchText, keyword);

      // insert order: <beforeText> <highlight> <afterText>
      parent.insertBefore(document.createTextNode(beforeText), node);
      parent.insertBefore(highlight, node);
      node.nodeValue = afterText;

      // 递归处理所有子节点，保证多次出现的关键字也被高亮
      parent.childNodes.forEach((child) => replaceWithHighlight(child, keyword));
    }
    return;
  }

  // call recursively for element children
  node.childNodes.forEach((child) => replaceWithHighlight(child, keyword));
}

function getHighlightNode(parent: Node, searchText: string, keyword: KeywordStyle): Node {
  const highlight = parent.createSpan();
  highlight.classList.add(...getCssClasses(keyword).split(' '));

  const showColor = keyword.showColor ?? true;
  if (showColor) {
    highlight.style.setProperty('--kh-c', keyword.color);
  }
  const showBackgroundColor = keyword.showBackgroundColor ?? true;
  if (showBackgroundColor) {
    highlight.style.setProperty('--kh-bgc', keyword.backgroundColor);
  }

  highlight.setText(searchText);
  return highlight;
}
