# 张林晖 · 个人主页

Liquid Glass 风格的静态个人主页，部署在 <https://davidz0926.github.io>。

纯 HTML / CSS / JS，没有构建步骤，也不依赖外部 CDN。

## 常改的地方（都在 `index.html`）

- **当前状态**：`<p class="status-word" data-text="Restarting">Restarting</p>`，两处文字一起改
- **友链**：复制 `friend-list` 里的一整个 `<li>`，改名字、简介、链接、头像（头像放 `assets/friends/`）
- **头像**：替换 `assets/avatar.webp` 和 `assets/avatar.jpg`（256×256）
