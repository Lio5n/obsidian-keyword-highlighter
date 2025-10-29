import { Plugin } from 'obsidian';
// 从 Obsidian 核心导入 Plugin 类，这是开发插件的基础类

import { editorHighlighter } from 'src/editor-extension';
// 导入用于编辑器（编辑模式）高亮的扩展模块

import { SettingTab } from 'src/settings/setting-tab';
// 导入插件设置页的类，用于在设置界面添加自定义设置

import { readerHighlighter } from './reader-extension';
// 导入用于阅读模式（Markdown 预览）高亮的扩展模块

import { createCommand } from './commands';
// 导入用于创建插件命令的函数

import { initStore, saveStore } from './stores/settings-store';
// 导入初始化和保存插件配置的函数

export class KeywordHighlighterPlugin extends Plugin {
// 定义插件主类 KeywordHighlighterPlugin，继承 Obsidian 的 Plugin 类

  async onload(): Promise<void> {
  // 插件加载时会自动调用 onload 方法，这里是初始化逻辑

    initStore(this);
    // 初始化插件存储（设置或数据），把插件实例传入

    this.registerEditorExtension(editorHighlighter);
    // 注册编辑器模式下的高亮扩展，使编辑器中关键字高亮生效

    this.registerMarkdownPostProcessor(readerHighlighter);
    // 注册 Markdown 渲染后处理器，使阅读模式中关键字高亮生效

    this.addCommand(createCommand(this.app));
    // 向 Obsidian 注册命令，例如通过快捷键触发的高亮操作

    this.addSettingTab(new SettingTab(this.app, this));
    // 向 Obsidian 设置界面添加插件自定义设置页
  }

  async saveSettings(): Promise<void> {
  // 定义保存设置的方法，供插件内部调用

    await saveStore();
    // 异步保存插件的配置或状态到存储
  }
}
