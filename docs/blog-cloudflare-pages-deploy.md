# 在 Cloudflare Pages 上部署 iptv-sources：从零到定时更新

本文面向希望**自建 IPTV 直播源静态站**的读者，说明如何把 [iptv-sources](https://github.com/yunnysunny/iptv-sources) 部署到 **Cloudflare Pages**，并理清「Git 构建」「GitHub Actions 定时任务」「直连上传」之间的关系。

---

## 项目会产出什么

构建完成后，**站点根目录对应仓库里的 `m3u/` 目录**，其中包含：

- 各聚合源的 **`.m3u` / `.txt`** 播放列表  
- **TVBox** 等用的 **`sources/`** JSON  
- **EPG**：原始 **XML** 以及按日期、频道拆好的 **静态 JSON**（`epg/…`）  
- `public/` 里拷贝过去的静态资源（由脚本的 `postbuild:static` 等步骤处理）

你最终在浏览器或播放器里使用的，是 Pages 分配域名（如 `https://xxx.pages.dev`）下的这些路径。

---

## 前置条件

1. **GitHub 账号**，并已 Fork（或克隆后推送到）你要部署的仓库。  
2. **Cloudflare 账号**（免费套餐即可用于 Pages，具体额度以官方说明为准）。  
3. 对 **分支与 Secret** 有基本了解（后面配置定时更新会用到）。

参考仓库：

- 本文示例：**[github.com/yunnysunny/iptv-sources](https://github.com/yunnysunny/iptv-sources)**  

---

## 第一步：在 Cloudflare Pages 里「连接 Git」

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages**。  
2. 选择 **Create** → **Pages** → **Connect to Git**。  
3. 按提示授权 **GitHub**，选中你的仓库与要部署的分支（一般为 **`main`**）。  
4. 进入构建设置页面，按下一节的表格填写。

这一步完成后，**每次向该分支推送代码**，Cloudflare 都会按你配置的命令在云端重新构建并发布（除非你关闭了自动部署）。

---

## 第二步：构建设置（控制台）

在 Pages 项目的 **Build configuration** 中建议如下（与仓库 README 一致，可按需追加镜像站矩阵）：

| 配置项 | 建议值 |
|--------|--------|
| **Framework preset** | `None` |
| **Build command** | `pnpm build:static` |
| **Build output directory** | `m3u` |
| **Root directory** | `/`（仓库根目录） |

### Node 与包管理器

仓库使用 **pnpm** 与 **Node 20** 系（与 GitHub Actions 中一致）。Cloudflare Pages 若已根据 `pnpm-lock.yaml` 自动选用 pnpm，保存配置后执行一次 **Save and Deploy**，等待首次构建变绿。

---

## 第三步：部署结果自检

1. 打开 Cloudflare 为该 Pages 项目分配的域名，例如 `https://<项目名>.pages.dev`。  
2. 确认能访问到首页或列表（具体取决于 `public/` 与生成逻辑）。  
3. 随机抽查一个 M3U 或 EPG 路径是否 **200**。  
4. 若你在 TVBox / 播放器里配置了 EPG，把文档中的 `your-domain.pages.dev` 换成 **你的 Pages 域名或已绑定的自定义域名**。

更细的 EPG 用法见仓库内 **[EPG 方案详解](./EPG.md)**。

---

## 第四步：自定义域名（可选）

在 Pages 项目的 **Custom domains** 中添加你的域名，按 Cloudflare 提示完成 **DNS**（通常同一账号下会自动给出 CNAME 记录）。证书由 Cloudflare 托管，无需在服务器上自行申请。

---

## 定时更新：GitHub Actions 在做什么

仅依赖「手动推送」时，直播源不会自动变新。仓库里的 **`.github/workflows/schedule.yml`** 使用 cron **每 2 小时**跑一次，大致步骤为：

1. `pnpm install`  
2. `pnpm build`（打包 TS 等到 `dist/`）  
3. `pnpm m3u`（用编译产物抓取并写入 `m3u/`）  
4. **发布**：根据是否配置了 Cloudflare 凭据，走下面两种之一。

### 方式 A：直连上传（推荐与「纯静态上传」一致）

当 GitHub 仓库里配置了 **非空的** Secret **`CLOUDFLARE_API_TOKEN`** 时，工作流会在 Runner 上执行：

```bash
npx wrangler pages deploy m3u --project-name="<你的 Pages 项目名>"
```

也就是把**本次在 Actions 里生成好的整个 `m3u/` 目录**推到指定 Pages 项目（**Direct Upload**）。此时 Cloudflare 控制台里的 **Build command** 主要影响「你手动推送 Git 时」的行为；定时任务这条线以 **Wrangler 上传结果**为准。

**需要在 GitHub 配置：**

| 类型 | 名称 | 说明 |
|------|------|------|
| **Secret** | `CLOUDFLARE_API_TOKEN` | 在 Cloudflare 创建的 API 令牌，需包含对 **Pages** 的写入权限 |
| **Secret** | `CLOUDFLARE_ACCOUNT_ID` | 账户 ID（Dashboard 侧栏或 Workers/Pages 概览中可见） |
| **Variable 或 Secret** | `PROJECT_NAME` | 与 Cloudflare Pages **项目名称**完全一致；工作流优先读 **Repository variable** `PROJECT_NAME`，未设置时再读 **同名 Secret** |

**在 Cloudflare 创建 API Token 的要点：**

- 进入 **My Profile** → **API Tokens** → **Create Token**。  
- 可使用与 **Edit Cloudflare Workers** 类似的模板，或自定义权限，确保包含对目标账户下 **Cloudflare Pages** 的编辑/部署能力。  
- 生成后**只显示一次**，请复制到 GitHub **Secrets** 中保存。

Pages 项目需允许 **Direct Upload**（或通过 Wrangler 与该项目建立关联）；若从未用过 Wrangler，可按 [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/) 中关于 Wrangler 的说明操作一次。

### 方式 B：不配置 Token —— 用空 commit 触发云端构建

当 **没有** 配置 `CLOUDFLARE_API_TOKEN`（或为空）时，工作流不会调用 Wrangler，而是：

1. 以 `github-actions[bot]` 身份  
2. 执行 **`git commit --allow-empty`**  
3. **`git push`** 到当前分支  

这样会触发 **「已连接 Git 的 Pages」** 认为有新提交，从而在 **Cloudflare 构建环境**里再跑一遍你在控制台配置的 **`pnpm build:static`**。

注意：

- **`m3u/` 在 `.gitignore` 中**，空 commit **不会**把 Actions 里生成的文件提交进仓库；定时任务在这条路径下只是**触发** Cloudflare 用自己的构建命令重新生成站点。  
- 若默认分支开启了 **Branch protection** 且未允许 **GitHub Actions** 或 **`github-actions[bot]`** 推送，**push 会失败**，需要调整规则或改用方式 A。

---


## 常见问题排查

| 现象 | 可能原因 | 处理方向 |
|------|-----------|-----------|
| Wrangler 部署失败 | Token 权限不足、Account ID / 项目名错误 | 核对 Secret 与 Pages 项目名大小写、Token 模板权限 |
| 站点有缓存、内容不是最新 | CDN 缓存 | 等待 TTL 或在 Cloudflare 对关键路径调整缓存策略 |

---

## 小结

- **首次上线**：Pages **连接 Git** + 正确填写 **Build command** 与 **输出目录 `m3u`**。  
- **持续更新**：依赖 **`schedule` 工作流**；要么配置 **Cloudflare API + Wrangler 直连上传**，要么依赖 **空 commit 触发云端构建**（并保证 bot 能 push）。  
- **播放器侧**：把域名换成你自己的 Pages / 自定义域名，并按 **[EPG.md](./EPG.md)** 配置 XML 或 JSON EPG。

若本文与仓库内 **README**、**workflow 文件** 今后有出入，**以仓库当前文件为准**；欢迎在你 Fork 的仓库里提交文档修正。

---

*本文档随 iptv-sources 仓库维护，协议与项目一致（GPL-3.0）。*
