## 项目仓库地址
https://github.com/natasha139/lumina-reader.git

## Cloudflare 环境变量
项目虽预留 `GEMINI_API_KEY` 配置，但当前逻辑未实际调用 LLM。部署至 Cloudflare Pages 时无需配置该变量即可正常运行。

## 构建配置
框架预设：Vite；构建命令：`npm run build`；输出目录：`dist`。
