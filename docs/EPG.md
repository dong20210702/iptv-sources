# 不花一分钱，让 TVBox 重新显示直播预告

用 TVBox 看直播的朋友应该都有过这样的体验：明明配置了 EPG 链接，节目预告却死活不显示。换了好几个链接，结果全是挂掉的。去网上搜解决方案，翻来覆去都是让你"自建 EPG 服务"——光看教程就劝退了。

今天分享一个我折腾出来的方案，不用服务器，不用数据库，不用写后端，白嫖 Cloudflare Pages 就能搞定。

## 先说说为什么 EPG 都挂了

EPG 全称 Electronic Program Guide（电子节目指南），就是你在 TVBox 里看到的"现在播什么、接下来播什么"那个功能。

早些年网上有不少好心人维护的公共 EPG 服务，直接填个链接就能用。但这些服务本质上都跑在别人的服务器上——服务器到期了、维护者不想干了、流量扛不住了……各种原因，现在基本都凉了。

## 网上的方案为什么不好用

搜一圈"TVBox EPG"，你会发现清一色都是教你自建：

- 租一台云服务器或者用 NAS
- 装个 MySQL 或 SQLite 存数据
- 跑个后端程序定时去抓节目信息
- 开个 API 接口给 TVBox 调用

说实话，如果你本身就是搞开发的，这些操作确实不难。但对大多数人来说，光是"租服务器"这一步就够头疼了，更别提每个月还得交钱续费。而且万一哪天忘了续费，或者服务器出了问题，EPG 又回到了"啥也不显示"的状态。

有没有一种方案，既不需要服务器，又能一直稳定运行？

## 一个被忽略的 TVBox 特性

答案藏在 TVBox 自己的设计里。

TVBox 的 EPG 链接支持**动态参数替换**。你可以在 URL 里写占位符，TVBox 会在实际请求的时候自动替换成真实的值：

- `{date}` → 当天的日期，比如 `2026-03-18`
- `{name}` → 当前频道名，比如 `CCTV1`

这意味着什么？假设你把 EPG 链接填成：

```
https://xxx.pages.dev/epg/51zmt/{date}/{name}.json
```

当你在看 CCTV1 的时候，TVBox 实际去请求的是：

```
https://xxx.pages.dev/epg/51zmt/2026-03-18/CCTV1.json
```

看到了吗？每次请求的都是一个**固定路径的静态文件**。那我只要提前把每个频道、每天的节目数据存成一个个 JSON 文件，放到能被访问到的地方就行了——根本不需要什么后端服务。

## 具体怎么做的

思路其实很简单，分三步：

**第一步：拿到原始数据。** 上游还是有一些 EPG 数据源在维护的，比如 [51zmt.top](http://epg.51zmt.top:8000/)，它们提供标准的 XMLTV 格式 XML 文件，里面包含了数百个频道的节目预告。

**第二步：拆分成小文件。** 用脚本把一个大 XML 解析开，按"日期 + 频道"的维度拆成独立的 JSON 文件。比如 CCTV1 在 3 月 18 日的节目单，就变成 `epg/51zmt/2026-03-18/CCTV1.json` 这样一个文件：

```json
{
  "channel": "CCTV1",
  "epg_data": [
    { "start": "06:00", "end": "06:30", "title": "朝闻天下" },
    { "start": "19:00", "end": "19:30", "title": "新闻联播" },
    { "start": "19:31", "end": "19:38", "title": "天气预报" },
    { "start": "20:00", "end": "21:00", "title": "焦点访谈" }
  ]
}
```

这恰好就是 TVBox 所需要的 EPG JSON 格式。

**第三步：扔到 Cloudflare Pages 上。** 把这些静态文件部署上去，用户就能通过 URL 直接访问了。配合 GitHub Actions 每 2 小时自动跑一次，数据就能持续保持最新。

整条链路画出来大概是这样的：

```
上游数据源 (XMLTV XML)
       ↓
GitHub Actions 每 2 小时自动触发
       ↓
解析 XML，拆分为 JSON 文件
       ↓
部署到 Cloudflare Pages
       ↓
TVBox 按需请求静态 JSON
```

全程没有数据库，没有后端服务，就是纯粹的静态文件托管。

## 为什么选 Cloudflare Pages

选它的理由很直接——**免费，而且靠谱**。

Cloudflare Pages 的免费套餐没有带宽和请求次数的限制，背后是 Cloudflare 的全球 CDN 网络，国内外访问速度都不错。更重要的是，它不需要你操心任何运维的事：不用续费服务器、不用盯着进程有没有挂、不用半夜爬起来重启服务。

只要 Cloudflare 还在，你的 EPG 服务就在。

## 怎么用

### 直接用

在 TVBox 的配置里，把 EPG 地址改成（按你使用的数据源二选一或自行切换）：

```
https://your-domain.pages.dev/epg/51zmt/{date}/{name}.json
```

若使用本站从 [epg.pw](https://epg.pw/) 聚合的中国地区 EPG，可改为：

```
https://your-domain.pages.dev/epg/epg_pw/{date}/{name}.json
```

把 `your-domain.pages.dev` 替换成实际可用的域名就行。频道名需与 JSON 文件名一致，否则 TVBox 无法匹配到对应文件。

### 自己部署一套

如果你想完全掌控自己的 EPG 服务，也很简单：

1. Fork 笔者自己做的开源项目 https://github.com/whyun-pages/iptv-sources 到你的 GitHub 账号
2. 去 Cloudflare Pages 关联这个仓库
3. 剩下的交给自动化——GitHub Actions 每 2 小时抓一次数据，Cloudflare Pages 自动部署

全过程不花一分钱，部署完就不用再管了。


