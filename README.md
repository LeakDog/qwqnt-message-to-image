# 消息转图片 (qwqnt-message-to-image)

右键单条消息，生成「头像 + 昵称 + 气泡」样式的图片并保存到本地；也支持进入 QQ 多选模式后一次转换多条消息。

移植自 LiteLoaderQQNT [轻量工具箱 (lite_tools)](https://github.com/xiyuesaves/LiteLoaderQQNT-lite_tools) 的「消息转图片」功能，适配 QwQNT 框架。

## 功能

- 在聊天窗口右键一条消息，菜单中出现「转图片」
- 支持纯文本、@（原生蓝染色、@全体成员）、图片、回复引用；多张图片按消息元素顺序纵向排列
- 点击后按 QQ 气泡样式绘制成 PNG
- 自动适配深色 / 浅色主题
- 渲染倍率可调（默认 2 倍）
- **多条消息**：进入 QQ 原生多选模式勾选多条，点击底部工具栏的「转图片」一次导出（跳过系统消息，保留时间分隔符）

## 依赖

本插件需要先安装 [qwqnt-hako](https://github.com/qwqnt-community/qwqnt-hako)（提供设置界面）。请在安装本插件前先安装并启用 hako。

## 安装

本插件采用**源码多文件 + vite 构建**的工程结构，需要先构建出产物再安装。

### 构建

```bash
npm install
npm run build
```

构建产物输出到 `dist/`（`dist/main/index.js`、`dist/preload/index.js`、`dist/renderer/index.js`），`package.json` 的 `inject` 已指向这些产物。

### 安装步骤

1. 先安装并启用 [qwqnt-hako](https://github.com/qwqnt-community/qwqnt-hako)
2. 构建本插件，得到 `dist/` 产物
3. 将本文件夹放入 QwQNT 的插件目录
4. 重启 QQ

### 开发

```bash
npm run dev   # 监听 renderer 变更并自动重新构建
npm test      # 消息字段、路径处理和并发 IPC 回归检查
```

## 源码结构

```
src/
  main/index.js           # 主进程：保存图片 / 配置读取
  preload/index.js        # preload：桥接保存能力到渲染进程
  renderer/
    index.js              # 装配入口：右键菜单 / 多选 / 设置注册
    ir.js                 # IR 框架：注册表 + 布局引擎 + parseMessage
    renderers/            # 各消息类型渲染器（text/at/reply/time/image）
    sticker.js            # canvas 绘制（多条纵排）
    avatar.js             # 头像加载（fetch→blob）
    image-loader.js       # 图片加载（与头像共用通道）
    extract.js            # DOM 提取（昵称/头像/主题检测）
    multi-select.js       # 多选模式 + 工具栏按钮
    settings-ui.js        # 设置界面
    config.js             # 配置读写（hako PluginSettings）
    constants.js          # 常量与颜色
```

新增消息类型（face/file/转发等）只需在 `src/renderer/renderers/` 新增一个渲染器并注册，布局引擎零改动。

## 使用

在聊天窗口右键一条消息，点击菜单中的「转图片」即可生成图片。

- 未设置保存目录时，每次会弹出保存对话框选择位置
- 设置了固定保存目录时，直接保存到该目录

**多条消息**：在消息上右键 →「多选」进入多选模式，勾选多条消息后，点击底部工具栏新增的「转图片」按钮即可一次导出。

## 设置

在 QQ 设置窗口中找到「消息转图片」插件页：

- **渲染倍率**：图片分辨率放大倍数。1 = 原始尺寸，2 = 高清，最高 8 倍。
- **保存目录**：留空则每次转图片弹出保存对话框；填写绝对路径则直接保存到该目录（如 `G:\images`）。

设置修改后自动保存，无需重启，下次右键转图片即生效。

## 已知限制

- 图片以块级纵向排版，多图宫格及 QQ 原生图文混排布局尚未复刻；动图导出为静态帧
- 被回复消息为图片/文件时，引用块显示占位文案（如 `[图片]`）
- 头像加载失败时留空；图片加载失败时显示占位文字，避免整张图无法导出
- 多选导出当前 DOM 中已加载的选中消息，虚拟列表滚出后被卸载的消息暂不支持
- 多选模式依赖 QQ 原生选择器的 DOM 结构，不同版本可能需要调整选择器
- 表情、文件、语音等未支持的独立元素会被跳过

## 0.0.8 更新

- 设置页使用 Shadow DOM 隔离 QQ 和第三方主题的全局样式，修复倍率输入框显示不明显的问题
- 调整输入框和说明布局，修复插件设置页标题仍显示「通用」的问题
- 保存成功后才提示「已保存」，写入失败时显示错误提示

## 0.0.7 更新

- 按实际 QQNT 数据适配 `picElement`、`textElement.atType` 和引用消息摘要
- 适配原生 `.forward-ops` 多选工具栏及 `pickerData.selected`，按列表顺序导出并保留时间分隔
- 本地读图改用 `ipcRenderer.invoke`，修复并发图片回包串图；头像与消息图片共用加载通道
- 修复 `file:///` 路径、图片显示尺寸、引用与图片块的纵向位置和头像复用
- 为图片加载加入超时及画布可导出检查，为超大导出提供尺寸限制

升级时替换 `dist/` 和 `package.json` 后重启 QQ，使新的主进程和 preload 同时生效。

## 许可

GPL-3.0（沿用原插件许可）
