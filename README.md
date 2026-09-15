# 数字糖果铺 · 本地生日贺卡系统

零依赖 Node 后端 + 本地静态前端。表单页生成分享链接与二维码，贺卡页读取本地接口渲染内容。

## 启动

```powershell
cd "C:\Users\31285\Desktop\Ai\deepseek\workspace12\extracted_site"
node server.js
```

- 本机访问：<http://127.0.0.1:8000/>
- 局域网访问：<http://192.168.137.246:8000/>（启动时会打印实际探测到的地址）
- 需要 Node.js 18+（用到内置 `fetch`/`crypto.randomInt`），**无需 `npm install`**。

可选环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址，`0.0.0.0` 才能被手机访问 |
| `BASE_URL` | 自动探测 | 覆盖分享链接/二维码里使用的外网或固定地址 |
| `CARD_TTL_DAYS` | `30` | 贺卡目录多久未更新后被自动清理，`0` 关闭清理 |
| `MAX_JSON_BODY` | `440401920`（420MB） | 请求体上限，仅用于测试 413 分支 |

> 旧写法 `python -m http.server 8000` 已不再适用：它是纯静态服务器，无法处理 `/api/*`
> 的 POST 接口（会返回 `501 Unsupported method ('POST')`），表单无法生成贺卡。

## 手机扫码打不开时

Windows 防火墙默认不放行 8000 端口，用**管理员** PowerShell 执行一次：

```powershell
New-NetFirewallRule -DisplayName "Birthday Local 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

手机需与本机在同一局域网（本机热点或同一 WiFi）。启动日志会列出其它网卡地址，
若探测到的地址不可达，可用 `BASE_URL` 指定。

## 目录结构

```
extracted_site/
├─ server.js                  零依赖后端（唯一入口）
├─ index.audio.html           表单页（录音/图片/音乐/文字 + 生成）
├─ integrated.html            贺卡页（收件人打开）
├─ error.html                 token 失效落地页
├─ html/player.html           音频播放器（表单预览与贺卡共用，iframe）
├─ js/  css/  img/  music/  audio/  fonts/
├─ default-assets-config.json 推荐图片组 / 推荐音乐（经 /api/default-assets/config 下发）
├─ blessing-messages.json     祝福语（经 /api/blessingmessage/enabled 下发）
└─ data/
   ├─ demo/card.json          内置演示贺卡（不带 blessingid 时展示，寿星 NAME、祝福者 ONE）
   ├─ tokens.json             token 白名单；文件存在且非空时按白名单校验
   └─ cards/<16位ID>/         生成的贺卡
      ├─ card.json            贺卡数据
      ├─ images/0.png …       上传的图片
      ├─ audio.<ext>          录音
      └─ music.<ext>          背景音乐
```

`data/cards/` 下没有任何索引文件，`card.json` 与 `tokens.json` 也禁止静态访问，
ID 为 16 位 base62（95 bit 熵），无法枚举。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 运行状态、局域网地址、清理天数、单文件上限 |
| POST | `/api/generate` | 生成贺卡，返回 `{ data: { id, url, blessingId } }` |
| GET | `/api/birthdayreport/:id` | 贺卡数据；`:id` 传 `demo` 或省略时返回演示数据 |
| POST | `/api/edit?blessingId=:id` | 修改贺卡（局部合并） |
| GET | `/api/default-assets/config` | 推荐图片组 / 推荐音乐 |
| GET | `/api/blessingmessage/enabled` | 祝福语（可按 `relationship` 过滤） |
| POST | `/api/media/transcode-mp3` | 音频**直通**：原样回传上传字节与真实 `Content-Type` |
| GET | `/api/token/validate?token=` | token 校验，返回 `{ code: 200, data: true|false }` |

所有响应统一为 `{ code, msg, data }`，错误也返回 JSON（客户端不会遇到 `Unexpected token '<'`）。

### 关于「转码」

后端**不做 FFmpeg 转码**，`/api/media/transcode-mp3` 是直通实现（响应头
`X-Transcode-Mode: passthrough`）。前端因此始终沿用真实的 MIME 与扩展名：
上传 `.wav` 就存成 `audio.wav` 并以 `audio/wav` 提供，不会谎称 `.mp3`。
这点很重要——把 WebM/Opus 标成 `audio/mpeg` 在桌面 Chrome 上能蒙混过关，
但在 iOS Safari 上会直接静音。

## 已实现的行为约定

- **录音**：仅支持上传音频/视频文件（已整体移除麦克风录音，局域网 HTTP 下
  `getUserMedia` 不可用且需要安全上下文）。单个文件上限 **60MB**。
- **图片**：最多 8 张；不足 8 张时其余位置展示默认图片。提交的图片数组若有任何
  一张无效（例如编辑页图片尚未加载完成时送来的空占位），服务端**整体拒绝**并返回 400，
  避免把「残缺的图片数组」当成「清空图片」而永久删除已有照片。
- **背景音乐**：可用推荐音乐、上传音频或视频。明确删除后 `musicDisabled: true`，
  贺卡保持静音，不会自动回落到默认音乐，且后续编辑其它字段也会保留静音状态。
- **30 天清理**：`data/cards/` 下超过 `CARD_TTL_DAYS` 天未更新的目录会被删除；
  启动时与每 6 小时各执行一次。**读取贺卡会刷新 `card.json` 的修改时间**，
  所以一直有人访问的贺卡不会被清掉。
- **分享链接/二维码**：使用探测到的局域网 IP（而非 `127.0.0.1`），手机扫码可直接打开。
  `/html/integrated.html` 会 302 到 `/integrated.html`，兼容旧链接。
- **演示数据**：打开贺卡页不带 `blessingid` 时展示 `data/demo/card.json`（寿星 `NAME`、祝福者 `ONE`）。

## 验证脚本

```powershell
cd "C:\Users\31285\Desktop\Ai\deepseek\workspace12\extracted_site"
node _verify\api_test.mjs      # 112 项：接口契约、静态资源、演示数据、遍历防护
node _verify\fix_test.mjs      #  59 项：审计修复项回归（安全、数据丢失、静音、MIME）
```

两者都要求在 `node server.js` 已启动的情况下运行。`_verify/` 目录已被后端禁止静态访问。
