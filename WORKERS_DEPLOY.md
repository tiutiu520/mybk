# Cloudflare Workers 部署说明

这个版本已经从 Cloudflare Pages Functions 适配为 Cloudflare Workers + Workers Static Assets。

## 1. 准备 Cloudflare 资源

需要：
- 一个 D1 数据库，名称建议为 `book`
- 一个 KV Namespace，用作 `NAV_AUTH`

## 2. 配置 Wrangler

复制：

```text
wrangler.example.toml -> wrangler.toml
```

然后填写：

- `database_id`：D1 `book` 的完整 UUID
- `NAV_AUTH` 的 KV namespace ID

不要把真实 `wrangler.toml` 提交到公开仓库。

## 3. 本地部署

```bash
npm install
npm run build:css
npx wrangler deploy
```

也可以：

```bash
npm run deploy
```

## 4. GitHub 自动部署

如果使用 Cloudflare Workers 的 Git 部署，确保仓库根目录存在：

```text
wrangler.toml
worker.js
public/
functions/
```

Cloudflare 会根据 Wrangler 配置部署 Worker、Static Assets、D1 和 KV 绑定。

## 5. D1

第一次访问 Worker 首页时，项目现有的 `ensureSchemaReady()` 会自动创建/迁移项目需要的表结构。

不需要先手工执行 `schema.sql`。

## 6. 重要

这个版本的 `functions/` 目录仍然保留，因为业务代码大量复用了原 Pages Functions 模块。`worker.js` 是新的 Workers 路由适配层，不要删除 `functions/`。

自定义域名可以在 Worker 的 Domains & Routes 中绑定。
