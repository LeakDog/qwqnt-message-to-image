// QwQNT 插件构建配置：三个 mode 分别打包 main / preload / renderer。
// 参照官方 qwqnt-hako 的做法：`vite build --mode <x>` 逐个产出单文件入口，
// 供 package.json 的 inject 指向 dist/ 下的产物。
const path = require("node:path");

function baseLib({ mode, entry, name, format, outDir }) {
  return {
    mode,
    build: {
      outDir,
      emptyOutDir: true,
      lib: { entry, name, formats: [format] },
      rollupOptions: {
        output: { entryFileNames: "index.js" },
        // 主进程依赖的 Node/Electron 模块必须在运行时提供，不打进产物
        external: ["electron", "fs", "fs/promises", "path"],
      },
      sourcemap: false,
      minify: false,
    },
  };
}

module.exports = ({ mode }) => {
  const src = path.resolve(__dirname, "src");
  switch (mode) {
    case "main":
      return baseLib({
        mode,
        entry: path.join(src, "main/index.js"),
        name: "main",
        format: "cjs",
        outDir: "dist/main",
      });
    case "preload":
      return baseLib({
        mode,
        entry: path.join(src, "preload/index.js"),
        name: "preload",
        format: "cjs",
        outDir: "dist/preload",
      });
    case "renderer":
      // 渲染进程注入到 QQ 页面（Chromium），用 IIFE 避免 CJS require 抛错。
      // 浏览器环境无 Node 模块，故 external 不适用；本插件 renderer 无外部 import。
      return baseLib({
        mode,
        entry: path.join(src, "renderer/index.js"),
        name: "m2i",
        format: "iife",
        outDir: "dist/renderer",
      });
    default:
      throw new Error(`未知构建 mode: ${mode}`);
  }
};
