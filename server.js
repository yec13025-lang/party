#!/usr/bin/env node
/**
 * 数字糖果铺 · 本地生日贺卡系统（零依赖 Node 后端）
 *
 * 运行： node server.js        （默认 0.0.0.0:8000）
 * 环境变量： PORT / HOST / BASE_URL / CARD_TTL_DAYS
 *
 * 路由总览
 *   GET  /                                   -> 表单页 index.audio.html
 *   GET  /html/integrated.html               -> 302 到 /integrated.html
 *   GET  /api/health                         -> 运行状态与局域网分享地址
 *   POST /api/generate                       -> 生成贺卡，返回 { data: { id, url } }
 *   GET  /api/birthdayreport/:id             -> 贺卡数据（:id 省略/ demo 时返回演示数据）
 *   POST /api/edit?blessingId=:id            -> 修改贺卡（局部合并）
 *   GET  /api/default-assets/config          -> 推荐图片 / 推荐音乐
 *   GET  /api/blessingmessage/enabled        -> 祝福语
 *   GET  /api/changelogs/latest?limit=       -> 更新日志（读 data/changelog.json，缺省空列表）
 *   GET  /api/blogs/latest?limit=            -> 精选博客（读 data/blog.json，缺省空列表）
 *   POST /api/message                        -> 留言（只记本机日志，不落盘）
 *   POST /api/media/transcode-mp3            -> 音频直通（不转码，原样回传）
 *   GET  /api/token/validate?token=          -> token 校验
 *
 * 数据落盘
 *   data/cards/<id>/card.json
 *   data/cards/<id>/images/0.jpg ...
 *   data/cards/<id>/audio.<ext>
 *   data/cards/<id>/music.<ext>
 *   data/demo/card.json                      -> 无 blessingid 时展示的演示贺卡
 *   data/changelog.json                      -> 可选：首页更新日志内容
 *   data/blog.json                           -> 可选：首页精选博客内容
 *
 * 生成目录超过 CARD_TTL_DAYS（默认 30）天未更新会被自动清理。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CARDS_DIR = path.join(DATA_DIR, 'cards');
const DEMO_FILE = path.join(DATA_DIR, 'demo', 'card.json');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8000);
const CARD_TTL_DAYS = Number(process.env.CARD_TTL_DAYS || 30);
const ID_LENGTH = 16;
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const MAX_AUDIO_BYTES = 60 * 1024 * 1024;   // 单个录音 / 背景音乐上限
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;   // 单张图片上限
// base64 会把二进制放大 4/3。UI 允许的上限是 8 张图 + 录音 60MB + 背景音乐 60MB ≈ 280MB 原始，
// 即约 373MB base64，所以请求体上限必须留出余量，否则合法提交会被 413 拒绝。
// MAX_JSON_BODY 可用环境变量覆盖，便于测试 413 分支。
const MAX_JSON_BODY = Number(process.env.MAX_JSON_BODY || 420 * 1024 * 1024);
// 留言只是几百字的文本，给一个独立的小上限，避免 420MB 的请求体上限被这个接口借用。
const MAX_MESSAGE_BYTES = Number(process.env.MAX_MESSAGE_BYTES || 64 * 1024);
const DEFAULT_MUSIC_URL = '/music/2099452154499207168.mp3';

const TEXT_FIELDS = ['text1', 'text2', 'text3', 'text4', 'text5', 'text6', 'text7', 'text8', 'text9'];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.eot': 'application/vnd.ms-fontobject',
    '.wasm': 'application/wasm'
};

const AUDIO_EXT_BY_MIME = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/wave': '.wav',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'audio/x-flac': '.flac',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm'
};

const IMAGE_EXT_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp'
};

// ---------------------------------------------------------------- 基础工具

function log() {
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log('[' + stamp + '] ' + Array.prototype.join.call(arguments, ' '));
}

function jsonResponse(res, status, payload, extraHeaders) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    res.writeHead(status, Object.assign({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store'
    }, extraHeaders || {}));
    res.end(body);
}

function ok(res, data, msg) {
    jsonResponse(res, 200, { code: 200, msg: msg || '操作成功', data: data === undefined ? null : data });
}

function fail(res, status, msg) {
    jsonResponse(res, status, { code: status, msg: msg, data: null });
}

function randomId(len) {
    const bytes = crypto.randomBytes(len * 2);
    let out = '';
    for (let i = 0; out.length < len && i < bytes.length; i++) {
        const b = bytes[i];
        if (b < 248) {                       // 拒绝采样，避免取模偏置
            out += ID_ALPHABET[b % ID_ALPHABET.length];
        }
    }
    while (out.length < len) {
        out += ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)];
    }
    return out;
}

function isPlainId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

function readBody(req, limit) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let settled = false;
        req.on('data', (chunk) => {
            if (settled) return;
            total += chunk.length;
            if (total > limit) {
                settled = true;
                // 不要 destroy：那会让客户端只看到 ECONNRESET，拿不到这条 JSON 错误说明。
                // 暂停读取，把请求体留在 socket 缓冲区，让上层先把 413 响应写出去。
                req.pause();
                reject(Object.assign(new Error('请求体超过上限 ' + Math.round(limit / 1024 / 1024) + 'MB'), { statusCode: 413 }));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(Buffer.concat(chunks));
        });
        req.on('error', (err) => {
            if (settled) return;
            settled = true;
            reject(err);
        });
    });
}

function readJsonBody(req, limit) {
    return readBody(req, limit || MAX_JSON_BODY).then((buf) => {
        if (!buf.length) return {};
        try {
            return JSON.parse(buf.toString('utf8'));
        } catch (e) {
            throw Object.assign(new Error('请求体不是合法 JSON'), { statusCode: 400 });
        }
    });
}

function parseDataUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(value);
    if (!m) return null;
    const mime = (m[1] || 'application/octet-stream').toLowerCase();
    const isBase64 = !!m[2];
    const payload = m[3] || '';
    let buffer;
    try {
        buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
    } catch (e) {
        return null;
    }
    return { mime, buffer };
}

function isHttpUrl(value) {
    return typeof value === 'string' && /^(https?:)?\/\//i.test(value);
}

async function ensureDir(dir) {
    await fsp.mkdir(dir, { recursive: true });
}

async function writeJsonAtomic(file, data) {
    await ensureDir(path.dirname(file));
    const tmp = file + '.tmp-' + crypto.randomBytes(4).toString('hex');
    await fsp.writeFile(tmp, JSON.stringify(data, null, 4), 'utf8');
    await fsp.rename(tmp, file);
}

async function readJsonFile(file) {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
}

async function exists(file) {
    try {
        await fsp.access(file);
        return true;
    } catch (e) {
        return false;
    }
}

async function removeDirSafe(dir) {
    try {
        await fsp.rm(dir, { recursive: true, force: true });
    } catch (e) {
        log('清理目录失败', dir, e.message);
    }
}

// ------------------------------------------------------- 局域网地址 / 分享链接

const VIRTUAL_ADAPTER_HINTS = [
    /virtual/i, /vmware/i, /vbox/i, /hyper-?v/i, /vethernet/i, /wsl/i, /loopback/i,
    /tailscale/i, /zerotier/i, /radmin/i, /npcap/i, /tap/i, /tun/i, /vpn/i, /bluetooth/i
];

function collectLanCandidates() {
    const ifaces = os.networkInterfaces();
    const list = [];
    Object.keys(ifaces).forEach((name) => {
        (ifaces[name] || []).forEach((info) => {
            const family = typeof info.family === 'string' ? info.family : (info.family === 4 ? 'IPv4' : 'IPv6');
            if (family !== 'IPv4' || info.internal) return;
            const addr = info.address;
            if (!addr || addr.startsWith('169.254.')) return;
            if (addr === '127.0.0.1') return;
            const virtual = VIRTUAL_ADAPTER_HINTS.some((re) => re.test(name));
            let score = 0;
            if (/^192\.168\./.test(addr)) score += 100;
            else if (/^10\./.test(addr)) score += 60;
            else if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) score += 30;
            else score += 10;
            if (virtual) score -= 200;
            if (/^(wlan|wi-?fi|无线)/i.test(name)) score += 15;
            if (/^192\.168\.137\./.test(addr)) score += 10;   // Windows 移动热点网段，手机通常可达
            list.push({ name, address: addr, score });
        });
    });
    list.sort((a, b) => b.score - a.score);
    return list;
}

let cachedLanAddress = null;
let cachedLanAt = 0;

function getLanAddress() {
    const now = Date.now();
    if (cachedLanAddress && now - cachedLanAt < 30000) return cachedLanAddress;
    const list = collectLanCandidates();
    cachedLanAddress = list.length ? list[0].address : '127.0.0.1';
    cachedLanAt = now;
    return cachedLanAddress;
}

function getBaseUrl(req) {
    if (process.env.BASE_URL) return String(process.env.BASE_URL).replace(/\/+$/, '');
    return 'http://' + getLanAddress() + ':' + PORT;
}

function cardShareUrl(req, id) {
    return getBaseUrl(req) + '/integrated.html?blessingid=' + encodeURIComponent(id);
}

// ------------------------------------------------------------- 推荐资源 / 祝福语

let configCache = null;
let blessingCache = null;

function normalizeAssetUrl(u) {
    if (typeof u !== 'string' || !u) return u;
    if (isHttpUrl(u) || u.startsWith('data:')) return u;
    if (u.startsWith('/')) return u;
    return '/' + u.replace(/^\.\//, '');
}

async function loadDefaultAssets() {
    if (configCache) return configCache;
    const file = path.join(ROOT, 'default-assets-config.json');
    const raw = await readJsonFile(file);
    const data = raw.data || {};
    const imageGroups = (data.imageGroups || [])
        .filter((g) => g && g.enabled !== false && Array.isArray(g.images) && g.images.length)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((g) => Object.assign({}, g, { images: g.images.map(normalizeAssetUrl) }));
    const musicItems = (data.musicItems || [])
        .filter((m) => m && m.enabled !== false && m.url)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((m) => Object.assign({}, m, { url: normalizeAssetUrl(m.url) }));
    configCache = { code: 200, msg: raw.msg || '操作成功', data: Object.assign({}, data, { imageGroups, musicItems }) };
    return configCache;
}

async function findImageGroup(id) {
    if (!id) return null;
    const cfg = await loadDefaultAssets();
    return cfg.data.imageGroups.find((g) => g.id === id) || null;
}

async function findMusicItem(key) {
    if (!key) return null;
    const cfg = await loadDefaultAssets();
    return cfg.data.musicItems.find((m) => m.id === key || m.key === key) || null;
}

async function loadBlessings() {
    if (blessingCache) return blessingCache;
    const raw = await readJsonFile(path.join(ROOT, 'blessing-messages.json'));
    const items = (raw.data || [])
        .filter((x) => x && x.enabled !== false && x.message)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    blessingCache = items;
    return items;
}

// ------------------------------------------------------------------ 贺卡存储

function cardDir(id) {
    return path.join(CARDS_DIR, id);
}

async function loadCardFile(id) {
    const file = path.join(cardDir(id), 'card.json');
    if (!(await exists(file))) return null;
    try {
        return await readJsonFile(file);
    } catch (e) {
        log('card.json 解析失败', id, e.message);
        return null;
    }
}

async function loadDemoRecord() {
    if (!(await exists(DEMO_FILE))) return null;
    try {
        const raw = await readJsonFile(DEMO_FILE);
        return raw && raw.data ? raw.data : raw;
    } catch (e) {
        log('演示数据解析失败', e.message);
        return null;
    }
}

/** 把内部存储字段转换成前端期望的字段名（图片/音频统一为可直接访问的 URL） */
function toReport(record) {
    const id = record.id || '';
    const base = id ? '/data/cards/' + id + '/' : '';
    const report = {
        id: id,
        userName: record.userName || '',
        birthday: record.birthday || '',
        sender: record.sender || '',
        celebrantEmail: record.celebrantEmail || '',
        emailSendTime: record.emailSendTime || null,
        fontFamily: record.fontFamily || null,
        blessingMessage: record.blessingMessage || '',
        templateType: typeof record.templateType === 'number' ? record.templateType : 1,
        audio: null,
        audioUrl: record.audioFile ? base + record.audioFile : (record.audioUrl || null),
        timeDisplay: record.timeDisplay || '0',
        automationMusicData: null,
        automationMusicUrl: record.musicFile ? base + record.musicFile : (record.automationMusicUrl || null),
        birthcakeMusicData: null,
        memoriesMusicData: null,
        themeColor: record.themeColor || 'pink',
        recommendedImageGroup: record.recommendedImageGroup || '',
        recommendedMusicKey: record.recommendedMusicKey || '',
        // true 表示用户明确删除了背景音乐，贺卡页必须保持静音而不是回落到默认音乐
        musicDisabled: record.musicDisabled === true,
        images: (record.images || []).map((f) => (isHttpUrl(f) || String(f).startsWith('/') ? f : base + f))
    };
    TEXT_FIELDS.forEach((k) => { report[k] = record[k] || ''; });
    return report;
}

async function saveUploadedImages(id, images, subDir) {
    // subDir 为贺卡目录下的子目录名，例如 'images' 或先写入 'images.new' 再整体替换
    const saved = [];
    const targetDir = path.join(cardDir(id), subDir);
    await ensureDir(targetDir);
    for (let i = 0; i < images.length && i < 8; i++) {
        const raw = images[i];
        if (typeof raw !== 'string' || !raw) continue;
        if (isHttpUrl(raw) || raw.startsWith('/')) { saved.push(raw); continue; }
        const parsed = parseDataUrl(raw);
        if (!parsed || !parsed.buffer.length) continue;
        if (parsed.buffer.length > MAX_IMAGE_BYTES) continue;
        const ext = IMAGE_EXT_BY_MIME[parsed.mime] || '.jpg';
        // 文件写进 subDir（可能是临时目录 images.new），但记录里一律使用最终的 images/ 相对路径，
        // 因为整体替换后临时目录会被重命名为 images。
        await fsp.writeFile(path.join(cardDir(id), subDir + '/' + i + ext), parsed.buffer);
        saved.push('images/' + i + ext);
    }
    return saved;
}

async function saveUploadedAudio(id, dataUrlOrText, kind) {
    const parsed = parseDataUrl(dataUrlOrText);
    if (!parsed) return { error: '音频数据格式不正确' };
    if (!parsed.buffer.length) return { error: '音频数据为空' };
    if (parsed.buffer.length > MAX_AUDIO_BYTES) {
        return { error: '音频文件不能超过 ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB' };
    }
    const ext = AUDIO_EXT_BY_MIME[parsed.mime] || '.mp3';
    const name = kind + ext;
    await ensureDir(cardDir(id));
    await fsp.writeFile(path.join(cardDir(id), name), parsed.buffer);
    return { file: name, bytes: parsed.buffer.length };
}

async function resolveImagesForRecord(images, recommendedImageGroup) {
    if (Array.isArray(images) && images.length) return images;
    if (recommendedImageGroup) {
        const group = await findImageGroup(recommendedImageGroup);
        if (group) return group.images.slice();
    }
    return [];
}

// ------------------------------------------------------------------- 生成贺卡

async function handleGenerate(req, res) {
    let body;
    try {
        body = await readJsonBody(req);
    } catch (e) {
        return fail(res, e.statusCode || 400, e.message || '请求解析失败');
    }

    const userName = String(body.userName || '').trim();
    const birthday = String(body.birthday || '').trim();
    const sender = String(body.sender || '').trim();
    if (!userName || !birthday || !sender) {
        return fail(res, 400, '寿星姓名、生日、祝福者均为必填');
    }

    const id = randomId(ID_LENGTH);
    const dir = cardDir(id);
    await ensureDir(path.join(dir, 'images'));

    let images = [];
    try {
        images = await saveUploadedImages(id, Array.isArray(body.images) ? body.images : [], 'images');
    } catch (e) {
        log('图片写入失败', id, e.message);
    }
    images = await resolveImagesForRecord(images, body.recommendedImageGroup);

    let audioFile = null;
    if (body.audio) {
        const r = await saveUploadedAudio(id, body.audio, 'audio');
        if (r.error) {
            await removeDirSafe(dir);
            return fail(res, 400, r.error);
        }
        audioFile = r.file;
    }

    let musicFile = null;
    let automationMusicUrl = null;
    let recommendedMusicKey = String(body.recommendedMusicKey || '');
    if (body.automationMusicData) {
        const r = await saveUploadedAudio(id, body.automationMusicData, 'music');
        if (r.error) {
            await removeDirSafe(dir);
            return fail(res, 400, r.error);
        }
        musicFile = r.file;
        recommendedMusicKey = '';
    } else if (recommendedMusicKey) {
        const item = await findMusicItem(recommendedMusicKey);
        if (item) automationMusicUrl = item.url;
        else recommendedMusicKey = '';
    }
    if (!musicFile && !automationMusicUrl) {
        automationMusicUrl = DEFAULT_MUSIC_URL;
    }

    const now = new Date().toISOString();
    const record = {
        id: id,
        userName: userName,
        birthday: birthday,
        sender: sender,
        celebrantEmail: String(body.celebrantEmail || ''),
        emailSendTime: body.emailSendTime || null,
        fontFamily: body.fontFamily || null,
        blessingMessage: String(body.blessingMessage || ''),
        templateType: 1,
        timeDisplay: String(body.timeDisplay || '0'),
        themeColor: String(body.themeColor || 'pink'),
        recommendedImageGroup: String(body.recommendedImageGroup || ''),
        recommendedMusicKey: recommendedMusicKey,
        images: images,
        audioFile: audioFile,
        musicFile: musicFile,
        automationMusicUrl: automationMusicUrl,
        createdAt: now,
        updatedAt: now
    };
    TEXT_FIELDS.forEach((k) => { record[k] = String(body[k] || ''); });

    try {
        await writeJsonAtomic(path.join(dir, 'card.json'), record);
    } catch (e) {
        // card.json 写不进去时目录里已经有一堆图片/音频，必须回滚，否则留下永远无法访问的孤儿目录
        log('card.json 写入失败，回滚贺卡目录', id, e.message);
        await removeDirSafe(dir);
        return fail(res, 500, '贺卡保存失败，请重试');
    }
    log('生成贺卡', id, userName, 'images=' + images.length, 'audio=' + (audioFile || '无'), 'music=' + (musicFile || automationMusicUrl || '无'));

    return ok(res, { id: id, url: cardShareUrl(req, id), blessingId: id }, '生成成功');
}

// ------------------------------------------------------------------- 读取贺卡

async function handleGetReport(req, res, id) {
    const wantDemo = !id || id === 'demo' || id === 'default';
    let record = null;
    if (!wantDemo) {
        if (!isPlainId(id)) return fail(res, 400, '贺卡 ID 不合法');
        record = await loadCardFile(id);
        if (!record) return fail(res, 404, '贺卡不存在或已过期');
    } else {
        record = await loadDemoRecord();
        if (!record) return fail(res, 404, '演示数据缺失');
    }

    const report = toReport(record);

    // 读取即视为「仍在使用」：刷新 card.json 的修改时间，避免一张正在被访问的贺卡
    // 恰好在第 30 天被清理掉。演示数据不参与清理，无需刷新。
    if (!wantDemo && record.id) {
        try {
            const now = new Date();
            await fsp.utimes(path.join(cardDir(record.id), 'card.json'), now, now);
        } catch (e) { /* 刷新失败不影响读取 */ }
    }

    const parsed = new URL(req.url, 'http://localhost');
    if (parsed.searchParams.get('isloadbase64') === 'true' && record.id) {
        try {
            const dir = cardDir(record.id);
            if (record.audioFile) {
                const buf = await fsp.readFile(path.join(dir, record.audioFile));
                const ext = path.extname(record.audioFile).replace('.', '');
                const mime = ext === 'mp3' ? 'audio/mpeg' : (ext === 'm4a' ? 'audio/mp4' : 'audio/' + ext);
                report.audio = 'data:' + mime + ';base64,' + buf.toString('base64');
            }
            if (record.musicFile) {
                const buf = await fsp.readFile(path.join(dir, record.musicFile));
                report.automationMusicData = 'data:audio/mpeg;base64,' + buf.toString('base64');
            }
        } catch (e) {
            log('base64 读取失败', record.id, e.message);
        }
    }

    return ok(res, report);
}

// ------------------------------------------------------------------- 修改贺卡

async function handleEdit(req, res, id) {
    if (!id || !isPlainId(id)) return fail(res, 400, '缺少 blessingId');
    const record = await loadCardFile(id);
    if (!record) return fail(res, 404, '贺卡不存在或已过期');

    let body;
    try {
        body = await readJsonBody(req);
    } catch (e) {
        return fail(res, e.statusCode || 400, e.message || '请求解析失败');
    }

    const dir = cardDir(id);

    if (body.userName !== undefined) record.userName = String(body.userName || '').trim();
    if (body.birthday !== undefined) record.birthday = String(body.birthday || '').trim();
    if (body.sender !== undefined) record.sender = String(body.sender || '').trim();
    if (body.celebrantEmail !== undefined) record.celebrantEmail = String(body.celebrantEmail || '');
    if (body.emailSendTime !== undefined) record.emailSendTime = body.emailSendTime || null;
    if (body.blessingMessage !== undefined) record.blessingMessage = String(body.blessingMessage || '');
    if (body.themeColor !== undefined) record.themeColor = String(body.themeColor || 'pink');
    if (body.timeDisplay !== undefined) record.timeDisplay = String(body.timeDisplay || '0');
    TEXT_FIELDS.forEach((k) => {
        if (body[k] !== undefined) record[k] = String(body[k] || '');
    });

    if (!record.userName || !record.birthday || !record.sender) {
        return fail(res, 400, '寿星姓名、生日、祝福者均为必填');
    }

    // 图片：clearImages / recommendedImageGroup / images
    if (body.clearImages === true) {
        await removeDirSafe(path.join(dir, 'images'));
        record.images = [];
        record.recommendedImageGroup = '';
    } else if (Array.isArray(body.images) && body.images.length) {
        // 防御：编辑页在图片尚未加载完成时会送来一串空字符串（占位）。这属于「本次未提交有效图片」，
        // 必须当成「不改动图片」而不是「清空图片」，否则会永久删除用户已上传的照片。
        const usable = body.images.filter((v) => typeof v === 'string' && v.indexOf('data:') === 0);
        if (!usable.length) {
            return fail(res, 400, '图片尚未加载完成，请稍候再提交');
        }
        // 只要有一张无效就必须整体拒绝：否则会被当成「用这几张替换全部」，
        // 剩下的位置被静默丢弃并重新编号，用户会莫名其妙少掉几张照片。
        if (usable.length !== body.images.length) {
            return fail(res, 400, '图片数据不完整（' + (body.images.length - usable.length) + ' 张无效），已停止更新以避免照片丢失，请重新选择图片');
        }
        // 先写临时目录，全部成功后再整体替换，避免写失败把原有图片清空
        const staging = 'images.new';
        await removeDirSafe(path.join(dir, staging));
        let saved;
        try {
            saved = await saveUploadedImages(id, usable, staging);
        } catch (e) {
            await removeDirSafe(path.join(dir, staging));
            log('图片写入失败', id, e.message);
            return fail(res, 500, '图片保存失败，请重试');
        }
        if (!saved.length) {
            await removeDirSafe(path.join(dir, staging));
            return fail(res, 400, '图片保存失败，请重新选择图片');
        }
        await removeDirSafe(path.join(dir, 'images'));
        await fsp.rename(path.join(dir, staging), path.join(dir, 'images'));
        record.images = saved;
        record.recommendedImageGroup = '';
    } else if (body.recommendedImageGroup) {
        const group = await findImageGroup(body.recommendedImageGroup);
        if (!group) return fail(res, 400, '推荐图片组不存在');
        record.images = group.images.slice();
        record.recommendedImageGroup = group.id;
    } else if (body.recommendedImageGroup === '' && body.clearRecommendedImages === true) {
        record.recommendedImageGroup = '';
    }

    // 录音：clearVoice / audio
    if (body.clearVoice === true) {
        if (record.audioFile) await fsp.rm(path.join(dir, record.audioFile), { force: true });
        record.audioFile = null;
        record.audioUrl = null;
        record.timeDisplay = '0';
    } else if (body.audio) {
        // 先保存新文件，成功后再删除旧文件；顺序反了会在校验失败时留下指向已删除文件的 card.json
        const r = await saveUploadedAudio(id, body.audio, 'audio');
        if (r.error) return fail(res, 400, r.error);
        if (record.audioFile && record.audioFile !== r.file) {
            await fsp.rm(path.join(dir, record.audioFile), { force: true });
        }
        record.audioFile = r.file;
        record.audioUrl = null;
        if (body.timeDisplay !== undefined) record.timeDisplay = String(body.timeDisplay || '0');
    }

    // 背景音乐：clearAutomationMusic / automationMusicData / recommendedMusicKey
    let musicCleared = false;
    if (body.clearAutomationMusic === true) {
        if (record.musicFile) await fsp.rm(path.join(dir, record.musicFile), { force: true });
        record.musicFile = null;
        record.recommendedMusicKey = '';
        record.automationMusicUrl = null;
        // 用户明确删除音乐后必须保持静音，否则下面的兜底会把默认音乐又加回来
        record.musicDisabled = true;
        musicCleared = true;
    } else if (body.automationMusicData) {
        // 同录音：先落盘成功，再删除旧文件
        const r = await saveUploadedAudio(id, body.automationMusicData, 'music');
        if (r.error) return fail(res, 400, r.error);
        if (record.musicFile && record.musicFile !== r.file) {
            await fsp.rm(path.join(dir, record.musicFile), { force: true });
        }
        record.musicFile = r.file;
        record.recommendedMusicKey = '';
        record.automationMusicUrl = null;
        record.musicDisabled = false;
    } else if (body.recommendedMusicKey) {
        const item = await findMusicItem(body.recommendedMusicKey);
        if (!item) return fail(res, 400, '推荐背景音乐不存在');
        if (record.musicFile) await fsp.rm(path.join(dir, record.musicFile), { force: true });
        record.musicFile = null;
        record.recommendedMusicKey = item.id || item.key;
        record.automationMusicUrl = item.url;
        record.musicDisabled = false;
    }

    if (!musicCleared && record.musicDisabled !== true && !record.musicFile && !record.automationMusicUrl) {
        record.automationMusicUrl = DEFAULT_MUSIC_URL;
    }

    record.updatedAt = new Date().toISOString();
    await writeJsonAtomic(path.join(dir, 'card.json'), record);
    log('修改贺卡', id, record.userName);

    return ok(res, { id: id, url: cardShareUrl(req, id) }, '更新成功');
}

// ------------------------------------------------------------- 音频直通（不转码）

function parseMultipart(buffer, boundary) {
    const parts = [];
    const mark = Buffer.from('--' + boundary);

    // 只有出现在行首（body 开头，或前面紧跟 CRLF）的 --boundary 才是真正的分隔符。
    // 否则上传的二进制数据里恰好包含这几个字节时会被当成边界，导致文件被静默截断。
    function findBoundary(from) {
        let at = buffer.indexOf(mark, from);
        while (at !== -1) {
            const atLineStart = at === 0 || (buffer[at - 2] === 13 && buffer[at - 1] === 10);
            if (atLineStart) return at;
            at = buffer.indexOf(mark, at + 1);
        }
        return -1;
    }

    let cursor = findBoundary(0);
    while (cursor !== -1) {
        const next = findBoundary(cursor + mark.length);
        if (next === -1) break;
        let start = cursor + mark.length;
        if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;
        else if (buffer[start] === 10) start += 1;
        let end = next;
        if (buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;
        else if (buffer[end - 1] === 10) end -= 1;
        if (end > start) parts.push(buffer.slice(start, end));
        cursor = next;
    }
    return parts.map((part) => {
        const split = part.indexOf('\r\n\r\n');
        if (split === -1) return null;
        const headerText = part.slice(0, split).toString('utf8');
        const body = part.slice(split + 4);
        const nameMatch = /name="([^"]*)"/i.exec(headerText);
        const fileMatch = /filename="([^"]*)"/i.exec(headerText);
        const typeMatch = /Content-Type:\s*([^\r\n;]+)/i.exec(headerText);
        return {
            name: nameMatch ? nameMatch[1] : '',
            filename: fileMatch ? fileMatch[1] : '',
            contentType: typeMatch ? typeMatch[1].trim() : '',
            body: body
        };
    }).filter(Boolean);
}

async function handleTranscodeMp3(req, res) {
    // 本地直通：不做 FFmpeg 转码，原样回传上传的音频字节，保证前端预览与生成一致。
    const contentType = String(req.headers['content-type'] || '');
    let filePart = null;

    if (contentType.indexOf('multipart/form-data') !== -1) {
        const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : '';
        if (!boundary) return fail(res, 400, '缺少 multipart boundary');
        let buf;
        try {
            buf = await readBody(req, MAX_JSON_BODY);
        } catch (e) {
            return fail(res, e.statusCode || 400, e.message || '上传失败');
        }
        const parts = parseMultipart(buf, boundary);
        filePart = parts.find((p) => p.name === 'file') || parts.find((p) => p.filename) || null;
        if (!filePart) return fail(res, 400, '未找到上传的文件');
    } else {
        // 非 multipart 时只接受「原始音频字节」上传；JSON/表单等显然不是音频，直接拒绝，
        // 避免把任意请求体当作音频原样回传。
        if (contentType.indexOf('application/json') !== -1 || contentType.indexOf('application/x-www-form-urlencoded') !== -1) {
            return fail(res, 400, '请以 multipart/form-data 上传音频文件');
        }
        let buf;
        try {
            buf = await readBody(req, MAX_JSON_BODY);
        } catch (e) {
            return fail(res, e.statusCode || 400, e.message || '上传失败');
        }
        filePart = { body: buf, contentType: contentType || 'audio/mpeg', filename: 'audio' };
    }

    if (!filePart.body || !filePart.body.length) return fail(res, 400, '上传内容为空');
    if (filePart.body.length > MAX_AUDIO_BYTES) {
        return fail(res, 413, '音频文件不能超过 ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB');
    }

    let outType = filePart.contentType || '';
    if (!outType || outType === 'application/octet-stream') {
        const ext = path.extname(filePart.filename || '').toLowerCase();
        outType = MIME[ext] || 'audio/mpeg';
    }
    log('音频直通', filePart.filename || '(未命名)', outType, filePart.body.length + ' bytes');

    res.writeHead(200, {
        'Content-Type': outType,
        'Content-Length': filePart.body.length,
        'Cache-Control': 'no-store',
        'X-Transcode-Mode': 'passthrough'
    });
    res.end(filePart.body);
}

// ------------------------------------------------------------------ token 校验

// token 授权名单：data/tokens.json（数组，或 { tokens: [...] }）。
// 文件存在且非空时按名单校验；不存在时退化为形状校验，保证开箱可用。
// 该文件已在 isBlockedPath 中禁止静态访问。
let tokenAllowlist = null;

async function loadTokenAllowlist() {
    if (tokenAllowlist) return tokenAllowlist;
    try {
        const raw = await readJsonFile(path.join(DATA_DIR, 'tokens.json'));
        const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.tokens) ? raw.tokens : []);
        tokenAllowlist = list.map((t) => String(t).trim()).filter(Boolean);
    } catch (e) {
        tokenAllowlist = [];
    }
    return tokenAllowlist;
}

async function handleTokenValidate(req, res) {
    const parsed = new URL(req.url, 'http://localhost');
    const token = String(parsed.searchParams.get('token') || '').trim();
    if (!token) return ok(res, false, '缺少 token');
    const shapeOk = token.length >= 6 && token.length <= 128 && /^[A-Za-z0-9._-]+$/.test(token);
    if (!shapeOk) return ok(res, false, 'token 无效');
    const allow = await loadTokenAllowlist();
    if (allow.length) {
        const valid = allow.indexOf(token) !== -1;
        return ok(res, valid, valid ? '操作成功' : 'token 不在授权列表中');
    }
    return ok(res, true, '操作成功');
}

// ------------------------------------------------- 本地内容：更新日志 / 精选博客

// 原站的更新日志与首页精选博客来自远端接口，本机没有对应后端，页面 fetch 会拿到 404：
// 控制台刷出 Failed to load resource，并且把「暂无更新日志」覆盖成
// 「加载更新日志失败，请稍后再试」。这里按 /api/default-assets/config、
// /api/blessingmessage/enabled 同样的思路改成读本地数据，文件缺失或内容为空时
// 返回 { code: 200, data: [] }，让页面原有的空态分支自己生效。
//
//   data/changelog.json   数组，或 { data: [ { title, updateDate, details } ] }
//   data/blog.json        数组，或 { data: [ { title, summary, publishDate, url } ] }
//
// 这两个文件都是可选的，仓库里默认不存在 -> 首页显示「暂无更新日志」/「暂无博客内容」。
// 不缓存：文件很小，按请求读取，改完文件刷新页面即可生效，和静态页的刷新行为一致。

async function loadLocalContent(relPath) {
    const file = path.join(ROOT, relPath);
    if (!(await exists(file))) return [];
    let raw;
    try {
        raw = await readJsonFile(file);
    } catch (e) {
        // 内容文件写坏了也降级为空列表（同时在这里留下服务端日志），
        // 不能让访客看到「加载失败」这类字样。
        log('本地内容解析失败', relPath, e.message);
        return [];
    }
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
    return list.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
}

function clampLimit(rawValue, fallback, max) {
    const n = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, max);
}

/** 按给定日期字段倒序排序；没有可解析日期的条目视为最旧，并保持它们原有的相对顺序。 */
function sortByDateDesc(list, fields) {
    const stamp = (item) => {
        for (const key of fields) {
            const t = Date.parse(item[key]);
            if (Number.isFinite(t)) return t;
        }
        return 0;
    };
    return list.slice().sort((a, b) => stamp(b) - stamp(a));
}

async function handleChangelogsLatest(req, res, parsed) {
    const list = await loadLocalContent('data/changelog.json');
    const limit = clampLimit(parsed.searchParams.get('limit'), 2, 50);
    return ok(res, sortByDateDesc(list, ['updateDate', 'createdAt']).slice(0, limit));
}

async function handleBlogsLatest(req, res, parsed) {
    const list = await loadLocalContent('data/blog.json');
    const limit = clampLimit(parsed.searchParams.get('limit'), 3, 50);
    return ok(res, sortByDateDesc(list, ['publishDate', 'updateDate', 'createdAt']).slice(0, limit));
}

// -------------------------------------------------------------------- 留言提交

// 留言表单：本地部署没有接收留言的服务端，也没有可用的收件邮箱，所以语义是
// 「收下 + 写到本机控制台 + 返回成功」。不落盘是刻意的：留言里常带手机号/邮箱，
// 而 data/ 目录是静态可访问的（见 serveStatic），写进去等于把访客的联系方式
// 暴露给整个局域网。
async function handleMessage(req, res) {
    let body;
    try {
        body = await readJsonBody(req, MAX_MESSAGE_BYTES);
    } catch (e) {
        return fail(res, e.statusCode || 400, e.message || '请求解析失败');
    }
    const content = String(body.content || '').trim();
    if (!content) return fail(res, 400, '留言内容不能为空');
    const contact = String(body.contact || '').trim();
    log('收到留言', '联系方式=' + (contact ? contact.slice(0, 64) : '（未填写）'),
        '内容=' + content.slice(0, 200).replace(/\s+/g, ' '));
    return ok(res, { received: true }, '留言已收到');
}

// ------------------------------------------------------------------ 静态资源

// 全部小写，且都是「去掉前导斜杠」后的相对路径形式（见 isBlockedPath 调用处）。
// NTFS 大小写不敏感，因此比较前必须统一小写，否则 /SERVER.JS 会绕过黑名单直接读到源码。
const BLOCKED_PREFIXES = ['server.js', '_verify', 'node_modules', '.git', 'server'];
const BLOCKED_NAMES = new Set(['server.js', 'package.json', 'package-lock.json', 'card.json', 'tokens.json']);

function isBlockedPath(relPosix) {
    // Windows 上 path.join 会把 '\' 也当分隔符，而 URL 里的 %5C 解码后就是反斜杠，
    // 所以必须先归一化分隔符，否则 'a\..\server.js' 会被当成一个普通文件名段而绕过点段检查。
    const rel = String(relPosix).replace(/\\/g, '/').toLowerCase();
    if (!rel) return true;
    if (rel.split('/').some((seg) => seg.startsWith('.') && seg !== '.')) return true;
    if (BLOCKED_NAMES.has(path.posix.basename(rel))) return true;
    return BLOCKED_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'));
}

async function serveStatic(req, res, pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch (e) {
        return fail(res, 400, '路径编码不合法');
    }
    const relPosix = path.posix.normalize(decoded).replace(/^\/+/, '');
    if (isBlockedPath(relPosix)) return fail(res, 404, 'Not Found');

    const abs = path.join(ROOT, relPosix);
    // 用 path.relative 判断包含关系：比 startsWith 更严格，避免同前缀兄弟目录与分隔符花样
    const relCheck = path.relative(ROOT, abs);
    if (relCheck.startsWith('..') || path.isAbsolute(relCheck) || !relCheck) {
        return fail(res, 403, 'Forbidden');
    }

    let stat;
    try {
        stat = await fsp.stat(abs);
    } catch (e) {
        return fail(res, 404, 'Not Found: /' + relPosix);
    }

    let target = abs;
    if (stat.isDirectory()) {
        target = path.join(abs, 'index.html');
        if (!(await exists(target))) return fail(res, 404, 'Not Found: /' + relPosix);
        stat = await fsp.stat(target);
    }
    if (!stat.isFile()) return fail(res, 404, 'Not Found');

    const ext = path.extname(target).toLowerCase();
    const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Last-Modified': stat.mtime.toUTCString()
    };
    if (ext === '.html' || ext === '.htm' || ext === '.js' || ext === '.css' || ext === '.json') {
        headers['Cache-Control'] = 'no-cache';
    } else {
        headers['Cache-Control'] = 'public, max-age=86400';
    }

    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        return res.end();
    }

    res.writeHead(200, headers);
    fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
}

// --------------------------------------------------------------- 30 天自动清理

async function cleanupExpiredCards() {
    if (!(CARD_TTL_DAYS > 0)) return 0;
    let entries;
    try {
        entries = await fsp.readdir(CARDS_DIR, { withFileTypes: true });
    } catch (e) {
        return 0;
    }
    const cutoff = Date.now() - CARD_TTL_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(CARDS_DIR, entry.name);
        try {
            const cardFile = path.join(dir, 'card.json');
            let ts;
            if (await exists(cardFile)) {
                ts = (await fsp.stat(cardFile)).mtimeMs;
            } else {
                ts = (await fsp.stat(dir)).mtimeMs;
            }
            if (ts < cutoff) {
                await removeDirSafe(dir);
                removed++;
                log('已清理过期贺卡', entry.name);
            }
        } catch (e) {
            log('清理检查失败', entry.name, e.message);
        }
    }
    if (removed) log('清理完成，共删除 ' + removed + ' 个过期贺卡目录');
    return removed;
}

// --------------------------------------------------------------------- 主路由

async function route(req, res) {
    const parsed = new URL(req.url, 'http://localhost');
    const pathname = parsed.pathname;
    const method = req.method || 'GET';

    if (pathname === '/api/health') {
        return ok(res, {
            status: 'ok',
            port: PORT,
            lanAddress: getLanAddress(),
            baseUrl: getBaseUrl(req),
            cardTtlDays: CARD_TTL_DAYS,
            maxAudioMb: Math.round(MAX_AUDIO_BYTES / 1024 / 1024)
        });
    }

    if (pathname === '/api/generate' && method === 'POST') return handleGenerate(req, res);

    let m = /^\/api\/birthdayreport\/([^/]+)\/?$/.exec(pathname);
    if (m && method === 'GET') return handleGetReport(req, res, decodeURIComponent(m[1]));

    if (pathname === '/api/birthdayreport' && method === 'GET') {
        return handleGetReport(req, res, String(parsed.searchParams.get('blessingId') || parsed.searchParams.get('id') || ''));
    }

    if (pathname === '/api/edit' && method === 'POST') {
        const id = String(parsed.searchParams.get('blessingId') || parsed.searchParams.get('blessingid') || parsed.searchParams.get('id') || '');
        return handleEdit(req, res, id);
    }

    if (pathname === '/api/default-assets/config' && method === 'GET') {
        try {
            const cfg = await loadDefaultAssets();
            return jsonResponse(res, 200, cfg);
        } catch (e) {
            return fail(res, 500, '推荐资源配置读取失败');
        }
    }

    if (pathname === '/api/blessingmessage/enabled' && method === 'GET') {
        try {
            const items = await loadBlessings();
            const rel = String(parsed.searchParams.get('relationship') || parsed.searchParams.get('blessingRelationship') || '').trim();
            let list = items;
            if (rel) {
                const matched = items.filter((x) => String(x.relationship || '') === rel);
                if (matched.length) list = matched;
            }
            return ok(res, list);
        } catch (e) {
            return fail(res, 500, '祝福语读取失败');
        }
    }

    if (pathname === '/api/changelogs/latest' && method === 'GET') return handleChangelogsLatest(req, res, parsed);

    if (pathname === '/api/blogs/latest' && method === 'GET') return handleBlogsLatest(req, res, parsed);

    if (pathname === '/api/message' && method === 'POST') return handleMessage(req, res);

    if (pathname === '/api/media/transcode-mp3' && method === 'POST') return handleTranscodeMp3(req, res);

    if (pathname === '/api/token/validate' && method === 'GET') return handleTokenValidate(req, res);

    if (pathname.startsWith('/api/')) return fail(res, 404, '接口不存在: ' + pathname);

    // 静态资源只允许 GET/HEAD。这个判断必须放在下面的重定向与首页分支之前，
    // 否则 POST / 和任意方法的 /html/integrated.html 都会被执行。
    if (method !== 'GET' && method !== 'HEAD') return fail(res, 405, 'Method Not Allowed');

    if (pathname === '/html/integrated.html') {
        const qs = parsed.search || '';
        res.writeHead(302, { Location: '/integrated.html' + qs, 'Cache-Control': 'no-store' });
        return res.end();
    }

    if (pathname === '/' || pathname === '') {
        return serveStatic(req, res, '/index.audio.html');
    }

    return serveStatic(req, res, pathname);
}

const server = http.createServer((req, res) => {
    // 所有页面都与接口同源，不需要 CORS。去掉 Access-Control-Allow-Origin: *
    // 可避免任意网页在用户浏览器里驱动这台局域网主机写入贺卡。
    if (req.method === 'OPTIONS') {
        res.writeHead(204, { Allow: 'GET, POST, HEAD, OPTIONS' });
        return res.end();
    }
    const started = Date.now();
    res.on('finish', () => {
        if (req.url && req.url.startsWith('/api/')) {
            log(req.method, req.url.split('?')[0], res.statusCode, (Date.now() - started) + 'ms');
        }
    });
    Promise.resolve()
        .then(() => route(req, res))
        .catch((err) => {
            const status = (err && err.statusCode) || 500;
            log('请求处理异常', req.method, req.url, err && err.stack ? err.stack : err);
            if (res.headersSent) {
                res.destroy();
                return;
            }
            if (status === 413) {
                // 请求体超限时我们停止了读取，需要显式 close，并在响应写完后才断开，
                // 尽量让客户端读到这条 413 说明，而不是一个 ECONNRESET。
                res.setHeader('Connection', 'close');
                res.on('finish', () => req.destroy());
                return fail(res, 413, (err && err.message) || '请求体过大');
            }
            fail(res, status, status === 500 ? '服务器内部错误' : (err && err.message) || '请求失败');
        });
});

server.requestTimeout = 0;
server.headersTimeout = 120000;
server.keepAliveTimeout = 65000;

(async function main() {
    await ensureDir(CARDS_DIR);
    await ensureDir(path.join(DATA_DIR, 'demo'));

    server.listen(PORT, HOST, () => {
        const lan = getLanAddress();
        const candidates = collectLanCandidates();
        console.log('');
        console.log('  数字糖果铺 · 本地生日贺卡系统已启动');
        console.log('  ------------------------------------------------');
        console.log('  本机访问 : http://127.0.0.1:' + PORT + '/');
        console.log('  局域网访问: http://' + lan + ':' + PORT + '/');
        console.log('  分享地址将使用: ' + getBaseUrl(null));
        console.log('  贺卡目录 : ' + CARDS_DIR);
        console.log('  自动清理 : ' + CARD_TTL_DAYS + ' 天未更新');
        console.log('  单文件上限: 录音/音乐 ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB');
        if (candidates.length > 1) {
            console.log('  其他网卡 : ' + candidates.slice(1).map((c) => c.address + '(' + c.name + ')').join(', '));
        }
        console.log('  ------------------------------------------------');
        console.log('  手机扫码打不开时，请放行防火墙端口：');
        console.log('  New-NetFirewallRule -DisplayName "Birthday Local ' + PORT + '" -Direction Inbound -Protocol TCP -LocalPort ' + PORT + ' -Action Allow -Profile Private');
        console.log('');
    });

    cleanupExpiredCards().catch(() => {});
    setInterval(() => { cleanupExpiredCards().catch(() => {}); }, 6 * 60 * 60 * 1000);
})().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
});

process.on('SIGINT', () => { log('收到中断信号，正在关闭…'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
