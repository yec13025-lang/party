// 本地后端接口联调脚本（只读 + 自建测试数据，跑完自行清理）
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail) {
    if (cond) { pass++; console.log('  PASS  ' + name); }
    else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : '')); }
}

async function req(method, url, opts = {}) {
    const res = await fetch(BASE + url, { method, redirect: 'manual', ...opts });
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) { try { body = await res.json(); } catch (e) { body = null; } }
    else body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, ct, body, headers: res.headers, location: res.headers.get('location') };
}

// 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
// 伪 MP3 载荷（仅验证服务端存储/回传路径，不校验解码）
const MP3 = 'data:audio/mpeg;base64,' + Buffer.alloc(2048, 7).toString('base64');
const MP3_BIN = Buffer.alloc(4096, 9);

(async function main() {
    console.log('\n=== 1. 健康检查与静态页面 ===');
    let r = await req('GET', '/api/health');
    check('GET /api/health -> 200 且 code=200', r.status === 200 && r.body && r.body.code === 200, JSON.stringify(r.body));
    check('health.baseUrl 使用局域网 IP 而非 127.0.0.1',
        !!r.body.data && /^http:\/\/\d+\.\d+\.\d+\.\d+:8000$/.test(r.body.data.baseUrl) && !r.body.data.baseUrl.includes('127.0.0.1'),
        r.body.data && r.body.data.baseUrl);
    check('health.maxAudioMb = 60', r.body.data && r.body.data.maxAudioMb === 60, String(r.body.data && r.body.data.maxAudioMb));
    check('health.cardTtlDays = 30', r.body.data && r.body.data.cardTtlDays === 30, String(r.body.data && r.body.data.cardTtlDays));

    r = await req('GET', '/');
    check('GET / -> 200 html(表单页)', r.status === 200 && r.ct.includes('text/html') && r.body.toString().includes('index.audio') === false && r.body.length > 1000, 'status=' + r.status + ' bytes=' + r.body.length);

    r = await req('GET', '/index.audio.html');
    check('GET /index.audio.html -> 200', r.status === 200 && r.ct.includes('text/html'), 'status=' + r.status);

    r = await req('GET', '/integrated.html');
    check('GET /integrated.html -> 200 html(贺卡页)', r.status === 200 && r.ct.includes('text/html'), 'status=' + r.status);

    r = await req('GET', '/html/integrated.html?blessingid=abc');
    check('GET /html/integrated.html -> 302 到 /integrated.html 且保留查询串',
        r.status === 302 && r.location === '/integrated.html?blessingid=abc', 'status=' + r.status + ' loc=' + r.location);

    r = await req('GET', '/error.html');
    check('GET /error.html -> 200（token 失败跳转目标存在）', r.status === 200, 'status=' + r.status);

    console.log('\n=== 2. 安全：源码与遍历防护 ===');
    r = await req('GET', '/server.js');
    check('GET /server.js 被拒绝（非 200）', r.status !== 200, 'status=' + r.status);
    r = await req('GET', '/_verify/api_test.mjs');
    check('GET /_verify/... 被拒绝', r.status !== 200, 'status=' + r.status);
    for (const p of ['/../server.js', '/..%2fserver.js', '/%2e%2e%2fserver.js', '/....//server.js', '/data/../../server.js']) {
        const rr = await req('GET', p);
        const leaked = rr.status === 200 && rr.body.toString().includes('require(');
        check('遍历尝试被拦截 ' + p, !leaked, 'status=' + rr.status);
    }

    console.log('\n=== 3. 推荐资源与祝福语 ===');
    r = await req('GET', '/api/default-assets/config');
    const cfg = r.body && r.body.data;
    check('GET /api/default-assets/config -> code=200', r.status === 200 && r.body.code === 200, JSON.stringify(r.body && r.body.code));
    check('imageGroups 存在且已重写为根绝对路径',
        !!(cfg && cfg.imageGroups && cfg.imageGroups.length && cfg.imageGroups.every(g => g.images.every(u => u.startsWith('/img/')))) ,
        cfg && cfg.imageGroups && JSON.stringify(cfg.imageGroups[0].images.slice(0, 1)));
    check('musicItems 存在且 url 为根绝对路径',
        !!(cfg && cfg.musicItems && cfg.musicItems.length && cfg.musicItems.every(m => m.url.startsWith('/music/'))),
        cfg && cfg.musicItems && JSON.stringify(cfg.musicItems.map(m => m.url)));
    // 推荐图片与音乐真实可访问
    const firstImg = cfg.imageGroups[0].images[0];
    r = await req('GET', firstImg);
    check('推荐图片实际可访问 ' + firstImg, r.status === 200 && r.ct.startsWith('image/'), 'status=' + r.status + ' ct=' + r.ct);
    const firstMusic = cfg.musicItems[0].url;
    r = await req('GET', firstMusic);
    check('推荐音乐实际可访问 ' + firstMusic, r.status === 200, 'status=' + r.status);

    r = await req('GET', '/api/blessingmessage/enabled');
    check('GET /api/blessingmessage/enabled -> code=200 且非空数组',
        r.status === 200 && r.body.code === 200 && Array.isArray(r.body.data) && r.body.data.length > 0,
        'len=' + (r.body.data && r.body.data.length));
    const allCount = r.body.data.length;
    r = await req('GET', '/api/blessingmessage/enabled?relationship=' + encodeURIComponent('朋友'));
    check('不匹配的关系退回全部祝福语（不会返回空数组导致前端报错）',
        r.status === 200 && r.body.code === 200 && Array.isArray(r.body.data) && r.body.data.length === allCount,
        'len=' + (r.body.data && r.body.data.length) + ' expected=' + allCount);
    r = await req('GET', '/api/blessingmessage/enabled?relationship=' + encodeURIComponent('其他'));
    check('匹配的关系正常过滤', r.status === 200 && r.body.data.length > 0, 'len=' + (r.body.data && r.body.data.length));

    console.log('\n=== 4. token 校验 ===');
    r = await req('GET', '/api/token/validate?token=2094973763414822912');
    check('有效 token -> code=200 且 data=true', r.status === 200 && r.body.code === 200 && r.body.data === true, JSON.stringify(r.body));
    r = await req('GET', '/api/token/validate');
    check('缺 token -> data=false', r.body.data === false, JSON.stringify(r.body));
    r = await req('GET', '/api/token/validate?token=ab');
    check('过短 token -> data=false', r.body.data === false, JSON.stringify(r.body));
    r = await req('GET', '/api/token/validate?token=' + encodeURIComponent('bad token!!'));
    check('非法字符 token -> data=false', r.body.data === false, JSON.stringify(r.body));
    r = await req('GET', '/api/token/validate?token=' + 'a'.repeat(200));
    check('超长 token -> data=false', r.body.data === false, JSON.stringify(r.body));

    console.log('\n=== 5. 演示数据（无 blessingid）===');
    r = await req('GET', '/api/birthdayreport/demo');
    check('GET /api/birthdayreport/demo -> code=200', r.status === 200 && r.body.code === 200, 'status=' + r.status);
    const demo = r.body.data;
    check('演示数据寿星为 NAME', demo && demo.userName === 'NAME', demo && demo.userName);
    check('演示数据祝福者为 ONE', demo && demo.sender === 'ONE', demo && demo.sender);
    check('演示数据 birthday=1014', demo && demo.birthday === '1014', demo && demo.birthday);
    check('演示图片为根绝对路径且 8 张',
        demo.images.length === 8 && demo.images.every(u => u.startsWith('/img/')), JSON.stringify(demo.images.slice(0, 1)) + ' len=' + demo.images.length);
    check('演示 audioUrl 为根绝对路径', demo.audioUrl && demo.audioUrl.startsWith('/audio/'), demo.audioUrl);
    check('演示 automationMusicUrl 为根绝对路径', demo.automationMusicUrl && demo.automationMusicUrl.startsWith('/music/'), demo.automationMusicUrl);
    check('演示 text1..text9 齐备', ['text1', 'text2', 'text3', 'text4', 'text5', 'text6', 'text7', 'text8', 'text9'].every(k => typeof demo[k] === 'string'));
    check('演示 blessingMessage 非空', typeof demo.blessingMessage === 'string' && demo.blessingMessage.length > 0);
    r = await req('GET', '/api/birthdayreport');
    check('GET /api/birthdayreport（无 id）也返回演示数据', r.status === 200 && r.body.code === 200 && r.body.data.userName === 'NAME');
    for (const u of [demo.images[0], demo.audioUrl, demo.automationMusicUrl]) {
        const rr = await req('GET', u);
        check('演示资源可访问 ' + u, rr.status === 200 && rr.body.length > 0, 'status=' + rr.status + ' bytes=' + rr.body.length);
    }

    console.log('\n=== 6. 生成贺卡 POST /api/generate ===');
    r = await req('POST', '/api/generate', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName: '联调测试',
            birthday: '0520',
            sender: '自动化',
            celebrantEmail: '',
            emailSendTime: '',
            images: [PNG, PNG],
            blessingMessage: '第一行祝福。\n第二行祝福',
            themeColor: 'blue',
            text1: 'T1', text2: 'T2', text3: 'T3', text4: 'T4', text5: 'T5',
            text6: 'T6', text7: 'T7', text8: 'T8', text9: 'T9',
            audio: MP3,
            timeDisplay: '3',
            automationMusicData: MP3,
            recommendedImageGroup: '',
            recommendedMusicKey: ''
        })
    });
    check('POST /api/generate -> code=200', r.status === 200 && r.body.code === 200, JSON.stringify(r.body).slice(0, 300));
    const genId = r.body.data && r.body.data.id;
    const genUrl = r.body.data && r.body.data.url;
    check('返回 id 长度为 16 的 base62', typeof genId === 'string' && /^[A-Za-z0-9]{16}$/.test(genId), String(genId));
    check('返回 url 为局域网 http 地址 + /integrated.html?blessingid=<id>',
        !!genUrl && genUrl === 'http://192.168.137.246:8000/integrated.html?blessingid=' + genId, String(genUrl));
    check('返回 blessingId 与 id 一致', r.body.data.blessingId === genId);

    r = await req('POST', '/api/generate', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: '', birthday: '0520', sender: 'x' }) });
    check('缺 userName -> 400 且 code!=200', r.status === 400 && r.body.code !== 200, JSON.stringify(r.body));
    r = await req('POST', '/api/generate', { headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
    check('非法 JSON -> 400（不是 HTML 500 页）', r.status === 400 && r.body && r.body.code === 400, 'status=' + r.status);

    console.log('\n=== 7. 读取生成的贺卡 GET /api/birthdayreport/<id> ===');
    r = await req('GET', '/api/birthdayreport/' + genId);
    const rep = r.body.data;
    check('GET 生成贺卡 -> code=200', r.status === 200 && r.body.code === 200, 'status=' + r.status);
    check('userName 回读一致', rep.userName === '联调测试', rep.userName);
    check('birthday 回读一致', rep.birthday === '0520', rep.birthday);
    check('themeColor 回读一致', rep.themeColor === 'blue', rep.themeColor);
    check('text1/text9 回读一致', rep.text1 === 'T1' && rep.text9 === 'T9', rep.text1 + '/' + rep.text9);
    check('blessingMessage 保留换行', rep.blessingMessage === '第一行祝福。\n第二行祝福', JSON.stringify(rep.blessingMessage));
    check('images 转换为 /data/cards/<id>/images/ 路径 2 张',
        rep.images.length === 2 && rep.images.every(u => u.startsWith('/data/cards/' + genId + '/images/')), JSON.stringify(rep.images));
    check('audioUrl 指向 /data/cards/<id>/audio', rep.audioUrl && rep.audioUrl.startsWith('/data/cards/' + genId + '/audio'), String(rep.audioUrl));
    check('automationMusicUrl 指向 /data/cards/<id>/music', rep.automationMusicUrl && rep.automationMusicUrl.startsWith('/data/cards/' + genId + '/music'), String(rep.automationMusicUrl));
    check('timeDisplay 回读一致', rep.timeDisplay === '3', rep.timeDisplay);
    check('isloadbase64 默认不返回 base64 audio', rep.audio === null, String(rep.audio));

    // 客户端两种消费方式都必须可用
    for (const u of rep.images.concat([rep.audioUrl, rep.automationMusicUrl])) {
        const rr = await req('GET', u);
        check('生成资源可访问 ' + u, rr.status === 200 && rr.body.length > 0, 'status=' + rr.status + ' bytes=' + rr.body.length);
    }
    r = await req('GET', '/api/birthdayreport/' + genId + '?isloadimg=true&isloadaudio=true&isloadbase64=false');
    check('编辑页请求参数组合可用（images 仍为可 fetch 的路径）',
        r.status === 200 && r.body.code === 200 && r.body.data.images.every(u => u.startsWith('/')), 'status=' + r.status);
    r = await req('GET', '/api/birthdayreport/' + genId + '?isloadbase64=true');
    check('isloadbase64=true 时返回 data URL audio',
        r.status === 200 && typeof r.body.data.audio === 'string' && r.body.data.audio.startsWith('data:audio/'), String(r.body.data.audio).slice(0, 40));

    r = await req('GET', '/api/birthdayreport/DoesNotExist12345');
    check('不存在的 id -> 404 且 code=404', r.status === 404 && r.body.code === 404, 'status=' + r.status + ' ' + JSON.stringify(r.body));
    r = await req('GET', '/api/birthdayreport/' + encodeURIComponent('bad id!!'));
    check('非法 id -> 400', r.status === 400, 'status=' + r.status);

    console.log('\n=== 8. 修改贺卡 POST /api/edit ===');
    r = await req('POST', '/api/edit?blessingId=' + genId, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editPage: 'audio', userName: '改名后', sender: '新发送者', birthday: '0101', blessingMessage: '改过的祝福', themeColor: 'green', text1: 'N1', text9: 'N9' })
    });
    check('POST /api/edit -> code=200', r.status === 200 && r.body.code === 200, JSON.stringify(r.body).slice(0, 200));
    r = await req('GET', '/api/birthdayreport/' + genId);
    const rep2 = r.body.data;
    check('编辑后 userName 更新', rep2.userName === '改名后', rep2.userName);
    check('编辑后 sender 更新', rep2.sender === '新发送者', rep2.sender);
    check('编辑后 themeColor 更新', rep2.themeColor === 'green', rep2.themeColor);
    check('编辑后 text1/text9 更新', rep2.text1 === 'N1' && rep2.text9 === 'N9', rep2.text1 + '/' + rep2.text9);
    check('未提交的字段保持原值（局部合并）：images 仍 2 张', rep2.images.length === 2, 'len=' + rep2.images.length);
    check('未提交的字段保持原值：audioUrl 仍在', !!rep2.audioUrl, String(rep2.audioUrl));

    // 清空录音
    r = await req('POST', '/api/edit?blessingId=' + genId, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearVoice: true }) });
    check('clearVoice -> code=200', r.body.code === 200, JSON.stringify(r.body));
    r = await req('GET', '/api/birthdayreport/' + genId);
    check('clearVoice 后 audioUrl 为 null', r.body.data.audioUrl === null, String(r.body.data.audioUrl));

    // 清空图片
    r = await req('POST', '/api/edit?blessingId=' + genId, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearImages: true }) });
    check('clearImages -> code=200', r.body.code === 200, JSON.stringify(r.body));
    r = await req('GET', '/api/birthdayreport/' + genId);
    check('clearImages 后 images 为空数组', Array.isArray(r.body.data.images) && r.body.data.images.length === 0, JSON.stringify(r.body.data.images));

    // 使用推荐图片组
    const grpId = cfg.imageGroups[0].id;
    r = await req('POST', '/api/edit?blessingId=' + genId, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recommendedImageGroup: grpId }) });
    check('recommendedImageGroup -> code=200', r.body.code === 200, JSON.stringify(r.body));
    r = await req('GET', '/api/birthdayreport/' + genId);
    const rep3 = r.body.data;
    check('推荐图片组展开为可访问的 8 张图', rep3.images.length === 8 && rep3.images.every(u => u.startsWith('/img/')), 'len=' + rep3.images.length);
    check('recommendedImageGroup 已记录', rep3.recommendedImageGroup === grpId, rep3.recommendedImageGroup);
    r = await req('GET', rep3.images[0]);
    check('推荐组图片实际可访问', r.status === 200, 'status=' + r.status);

    // 推荐音乐
    const mKey = cfg.musicItems[0].id || cfg.musicItems[0].key;
    r = await req('POST', '/api/edit?blessingId=' + genId, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recommendedMusicKey: mKey }) });
    check('recommendedMusicKey -> code=200', r.body.code === 200, JSON.stringify(r.body));
    r = await req('GET', '/api/birthdayreport/' + genId);
    check('推荐音乐解析为可播放 URL', !!r.body.data.automationMusicUrl && r.body.data.automationMusicUrl.startsWith('/music/'), String(r.body.data.automationMusicUrl));
    check('推荐音乐 key 已记录', r.body.data.recommendedMusicKey === mKey, r.body.data.recommendedMusicKey);

    r = await req('POST', '/api/edit?blessingId=DoesNotExist12345', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'x' }) });
    check('编辑不存在的贺卡 -> 404', r.status === 404, 'status=' + r.status);
    r = await req('POST', '/api/edit', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'x' }) });
    check('缺少 blessingId -> 400', r.status === 400, 'status=' + r.status);
    r = await req('POST', '/api/edit?blessingId=' + genId, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: '' }) });
    check('编辑时必填校验生效 -> 400', r.status === 400, JSON.stringify(r.body));
    r = await req('POST', '/api/edit?blessingId=' + genId, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: '恢复名', birthday: '0520', sender: '自动化' }) });
    check('恢复必填字段 -> code=200', r.body.code === 200, JSON.stringify(r.body));

    console.log('\n=== 9. 音频直通 POST /api/media/transcode-mp3 ===');
    const boundary = '----hbTestBoundary' + Date.now();
    const mk = (parts) => {
        const bufs = [];
        for (const p of parts) {
            bufs.push(Buffer.from('--' + boundary + '\r\n'));
            bufs.push(Buffer.from('Content-Disposition: form-data; name="' + p.name + '"' + (p.filename ? '; filename="' + p.filename + '"' : '') + '\r\n'));
            bufs.push(Buffer.from('Content-Type: ' + (p.type || 'application/octet-stream') + '\r\n\r\n'));
            bufs.push(Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data));
            bufs.push(Buffer.from('\r\n'));
        }
        bufs.push(Buffer.from('--' + boundary + '--\r\n'));
        return Buffer.concat(bufs);
    };
    const mp3Body = mk([
        { name: 'purpose', data: 'music' },
        { name: 'file', filename: 'song.mp3', type: 'audio/mpeg', data: MP3_BIN }
    ]);
    r = await req('POST', '/api/media/transcode-mp3?purpose=music', { headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary }, body: mp3Body });
    check('直通上传 mp3 -> 200 且非 JSON', r.status === 200 && !r.ct.includes('application/json'), 'status=' + r.status + ' ct=' + r.ct);
    check('直通回传字节与上传一致（无转码）', Buffer.isBuffer(r.body) && r.body.length === MP3_BIN.length && r.body.equals(MP3_BIN), 'bytes=' + (r.body && r.body.length) + ' expected=' + MP3_BIN.length);
    check('直通回传 Content-Type 保留 audio/mpeg', r.ct.includes('audio/mpeg'), r.ct);
    check('标记 X-Transcode-Mode=passthrough', r.headers.get('x-transcode-mode') === 'passthrough', String(r.headers.get('x-transcode-mode')));

    const b2 = '----hbTestBoundaryVoice';
    const voiceBody = Buffer.concat([
        Buffer.from('--' + b2 + '\r\nContent-Disposition: form-data; name="file"; filename="voice.wav"\r\nContent-Type: audio/wav\r\n\r\n'),
        Buffer.alloc(1500, 3),
        Buffer.from('\r\n--' + b2 + '--\r\n')
    ]);
    r = await req('POST', '/api/media/transcode-mp3?purpose=voice&voiceDenoise=false', { headers: { 'Content-Type': 'multipart/form-data; boundary=' + b2 }, body: voiceBody });
    check('voice 用途直通 -> 200 且保留 audio/wav', r.status === 200 && r.ct.includes('audio/wav'), 'status=' + r.status + ' ct=' + r.ct);

    r = await req('POST', '/api/media/transcode-mp3', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'x' }) });
    check('无 multipart 且无有效内容 -> 4xx', r.status >= 400, 'status=' + r.status);

    console.log('\n=== 10. 未知接口与错误处理 ===');
    r = await req('GET', '/api/does-not-exist');
    check('未知 /api 路由 -> 404 JSON（不是 HTML）', r.status === 404 && r.ct.includes('application/json') && r.body.code === 404, 'status=' + r.status + ' ct=' + r.ct);
    r = await req('DELETE', '/index.audio.html');
    check('静态路径非 GET/HEAD -> 405 JSON', r.status === 405 && r.ct.includes('application/json'), 'status=' + r.status + ' ct=' + r.ct);
    r = await req('GET', '/css/integrated.css');
    check('贺卡样式可访问 /css/integrated.css', r.status === 200 && r.ct.includes('text/css'), 'status=' + r.status);
    r = await req('GET', '/css/integrated-theme.css');
    check('贺卡主题样式可访问', r.status === 200, 'status=' + r.status);
    for (const p of ['/js/jquery-2.1.1.min.js', '/js/integrated.js', '/js/integrated-theme.js', '/js/integrated-music.js', '/js/integrated-animation.js', '/js/integrated-font.js', '/js/font-config.js', '/html/player.html', '/css/player.css', '/js/player.page.js', '/js/theme.js', '/favicon.ico']) {
        const rr = await req('GET', p);
        check('贺卡依赖可访问 ' + p, rr.status === 200, 'status=' + rr.status);
    }
    r = await req('GET', '/js/token-validation.js');
    check('/js/token-validation.js 可访问（已启用）', r.status === 200, 'status=' + r.status);

    console.log('\n=== 11. 清理测试数据 ===');
    console.log('  生成并编辑过的测试贺卡 id = ' + genId + '（保留在 data/cards 下，便于浏览器端验证）');

    console.log('\n================ 汇总 ================');
    console.log('PASS: ' + pass + '   FAIL: ' + fail);
    if (failures.length) { console.log('\n失败项：'); failures.forEach(f => console.log('  - ' + f)); }
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试脚本自身异常:', e); process.exit(2); });
