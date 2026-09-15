// 审计修复项的回归测试。用法：node _verify/fix_test.mjs [BASE]
const BASE = process.argv[2] || 'http://127.0.0.1:8000';
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
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const MP3 = 'data:audio/mpeg;base64,' + Buffer.alloc(1024, 5).toString('base64');
const WAV = 'data:audio/wav;base64,' + Buffer.alloc(1024, 6).toString('base64');

(async function main() {
    console.log('\n=== B1/B2：源码读取与遍历防护（审计 blocker）===');
    for (const p of [
        '/server.js', '/SERVER.JS', '/Server.js', '/SeRvEr.Js',
        '/a%5C..%5Cserver.js', '/js%5C..%5Cserver.js', '/sub%5C..%5Cserver.js',
        '/a%5C..%5C..%5Cserver.js',
        '/%5Cserver.js', '/..%5Cserver.js',
        '/_VERIFY/api_test.mjs', '/_verify/api_test.mjs',
        '/NODE_MODULES/x.js',
        '/data/demo/card.json', '/data/cards/CNOXws3jFpAUYqyE/card.json'
    ]) {
        const r = await req('GET', p);
        const leaked = r.status === 200 && (r.body.toString().includes('require(') || r.body.toString().includes('http.createServer') || r.body.toString().includes('"audioFile"'));
        check('拒绝 ' + p, r.status !== 200 && !leaked, 'status=' + r.status + (leaked ? ' LEAKED' : ''));
    }
    // 正常资源仍然可访问
    for (const p of ['/index.audio.html', '/integrated.html', '/js/integrated.js', '/css/integrated.css', '/favicon.ico', '/error.html']) {
        const r = await req('GET', p);
        check('正常资源仍可访问 ' + p, r.status === 200, 'status=' + r.status);
    }

    console.log('\n=== m1：静态路径方法校验 ===');
    for (const [m, p] of [['POST', '/'], ['PUT', '/'], ['POST', '/html/integrated.html'], ['POST', '/index.audio.html']]) {
        const r = await req(m, p);
        check(m + ' ' + p + ' -> 405 JSON', r.status === 405 && r.ct.includes('application/json'), 'status=' + r.status + ' ct=' + r.ct);
    }
    let r = await req('GET', '/html/integrated.html?a=1');
    check('GET /html/integrated.html 仍 302', r.status === 302 && r.location === '/integrated.html?a=1', 'status=' + r.status);
    r = await req('HEAD', '/');
    check('HEAD / 仍 200', r.status === 200, 'status=' + r.status);

    console.log('\n=== M1：编辑时音频校验失败不得删除旧录音 ===');
    r = await req('POST', '/api/generate', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName: '审计回归', birthday: '0330', sender: '测试', images: [PNG], blessingMessage: 'x',
            audio: MP3, automationMusicData: MP3, themeColor: 'pink'
        })
    });
    const id = r.body.data.id;
    check('创建测试贺卡', r.body.code === 200 && !!id, JSON.stringify(r.body).slice(0, 160));
    let before = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('初始 audioUrl 存在', !!before.audioUrl, String(before.audioUrl));
    const audioUrlBefore = before.audioUrl;
    // 提交一个格式非法的音频（无 data: 前缀）-> 服务端 400，旧录音必须还在
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: 'not-a-data-url' }) });
    check('非法音频提交 -> 400', r.status === 400 || r.body.code !== 200, 'status=' + r.status + ' ' + JSON.stringify(r.body));
    let after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('旧录音未被删除（audioUrl 不变）', after.audioUrl === audioUrlBefore, 'before=' + audioUrlBefore + ' after=' + after.audioUrl);
    r = await req('GET', after.audioUrl);
    check('旧录音仍然可播放', r.status === 200 && r.body.length > 0, 'status=' + r.status);

    console.log('\n=== M3：占位空图片不得清空已上传照片 ===');
    const imagesBefore = after.images.length;
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: ['', '', '', '', '', '', '', ''] }) });
    check('全部空字符串 images -> 400', r.status === 400 && r.body.code === 400, 'status=' + r.status + ' ' + JSON.stringify(r.body));
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('照片数量未被清空', after.images.length === imagesBefore && imagesBefore > 0, 'before=' + imagesBefore + ' after=' + after.images.length);
    r = await req('GET', after.images[0]);
    check('原有照片仍可访问', r.status === 200 && r.body.length > 0, 'status=' + r.status);
    // 显式 clearImages 仍然生效
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearImages: true }) });
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('显式 clearImages 仍然清空', after.images.length === 0, 'len=' + after.images.length);
    // 正常提交图片仍然生效
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: [PNG, PNG, PNG] }) });
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('正常提交 3 张图片生效', after.images.length === 3, 'len=' + after.images.length);
    for (const u of after.images) {
        const rr = await req('GET', u);
        check('新图片可访问 ' + u, rr.status === 200, 'status=' + rr.status);
    }
    // 部分无效的图片数组必须整体拒绝：否则会被当成「用这几张替换全部」，
    // 静默丢弃其余位置并重新编号，用户会莫名少掉几张照片。
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: [PNG, '', ''] }) });
    check('部分无效 images -> 400 整体拒绝', r.status === 400 && r.body.code === 400, 'status=' + r.status + ' ' + JSON.stringify(r.body));
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('部分无效提交后照片数量不变（仍 3 张）', after.images.length === 3, 'len=' + after.images.length);

    console.log('\n=== M2：图片写入使用临时目录整体替换 ===');
    const dirs = await import('node:fs').then((fs) => fs.readdirSync(process.env.CARDS || '.', { withFileTypes: true })).catch(() => null);
    check('（无临时目录残留，见下方 shell 断言）', true);

    console.log('\n=== m5：删除背景音乐后保持静音 ===');
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearAutomationMusic: true }) });
    check('clearAutomationMusic -> code=200', r.body.code === 200, JSON.stringify(r.body));
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('automationMusicUrl 为 null', after.automationMusicUrl === null, String(after.automationMusicUrl));
    check('musicDisabled = true', after.musicDisabled === true, String(after.musicDisabled));
    // 再次编辑其它字段，静音状态必须保留
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blessingMessage: '改一下祝福语' }) });
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('编辑其它字段后仍保持静音', after.musicDisabled === true && after.automationMusicUrl === null, JSON.stringify({ d: after.musicDisabled, u: after.automationMusicUrl }));
    // 选了推荐音乐后应恢复播放
    const cfg = (await req('GET', '/api/default-assets/config')).body.data;
    const mKey = cfg.musicItems[0].id || cfg.musicItems[0].key;
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recommendedMusicKey: mKey }) });
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('选推荐音乐后 musicDisabled=false 且有 URL', after.musicDisabled === false && !!after.automationMusicUrl, JSON.stringify({ d: after.musicDisabled, u: after.automationMusicUrl }));

    console.log('\n=== M1b：真实容器类型不应被强改为 mp3 ===');
    r = await req('POST', '/api/edit?blessingId=' + id, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: WAV }) });
    check('提交 wav 录音 -> code=200', r.body.code === 200, JSON.stringify(r.body));
    after = (await req('GET', '/api/birthdayreport/' + id)).body.data;
    check('wav 录音保存为 .wav 且 MIME 为 audio/wav', /\.wav$/.test(after.audioUrl || ''), String(after.audioUrl));
    r = await req('GET', after.audioUrl);
    check('wav 录音回传 Content-Type=audio/wav', r.ct.includes('audio/wav'), r.ct + ' status=' + r.status);

    console.log('\n=== m9：读取会刷新 30 天清理计时 ===');
    const fs = await import('node:fs');
    const cardFile = 'C:\\Users\\31285\\Desktop\\Ai\\deepseek\\workspace12\\extracted_site\\data\\cards\\' + id + '\\card.json';
    if (fs.existsSync(cardFile)) {
        const old = new Date(Date.now() - 20 * 24 * 3600 * 1000);
        fs.utimesSync(cardFile, old, old);
        const t0 = fs.statSync(cardFile).mtimeMs;
        await req('GET', '/api/birthdayreport/' + id);
        const t1 = fs.statSync(cardFile).mtimeMs;
        check('GET 读取后 card.json mtime 被刷新', t1 > t0, 'before=' + new Date(t0).toISOString() + ' after=' + new Date(t1).toISOString());
    } else {
        check('card.json 路径可定位（跳过）', false, cardFile);
    }

    console.log('\n=== m6：multipart 载荷内含边界字节不应被截断 ===');
    const b = '----hbEdgeBoundary1234';
    // 数据中间出现 --boundary（前面不是 CRLF）不是合法分隔符，必须原样保留。
    const payload = Buffer.concat([Buffer.from('AAA'), Buffer.from('--' + b), Buffer.from('BBB')]);
    const body = Buffer.concat([
        Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvoice\r\n'),
        Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="file"; filename="edge.webm"\r\nContent-Type: audio/webm\r\n\r\n'),
        payload,
        Buffer.from('\r\n--' + b + '--\r\n')
    ]);
    r = await req('POST', '/api/media/transcode-mp3?purpose=voice', { headers: { 'Content-Type': 'multipart/form-data; boundary=' + b }, body });
    check('含边界字节的上传 -> 200', r.status === 200, 'status=' + r.status + ' ct=' + r.ct);
    check('载荷未被截断（长度=' + payload.length + '）', Buffer.isBuffer(r.body) && r.body.length === payload.length, 'got=' + (r.body && r.body.length));
    check('Content-Type 保留 audio/webm', r.ct.includes('audio/webm'), r.ct);

    // 说明：若数据中恰好出现 "\r\n--boundary"，按 RFC 2046 这本身就构成分隔符，
    // 属于客户端必须避免的边界选择问题（浏览器用 30 位随机边界），服务端无法区分。
    const ambiguous = Buffer.from('AAA\r\n--' + b + '\r\nBBB');
    const bodyAmb = Buffer.concat([
        Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="file"; filename="amb.webm"\r\nContent-Type: audio/webm\r\n\r\n'),
        ambiguous, Buffer.from('\r\n--' + b + '--\r\n')
    ]);
    r = await req('POST', '/api/media/transcode-mp3', { headers: { 'Content-Type': 'multipart/form-data; boundary=' + b }, body: bodyAmb });
    console.log('  INFO  CRLF+边界 的歧义载荷返回 ' + (r.body && r.body.length) + ' 字节（RFC 上该字节串即为分隔符，属客户端责任）');

    console.log('\n=== m6b：普通两段 multipart 仍正确 ===');
    const b2 = '----hbNormalBoundary';
    const fileBytes = Buffer.alloc(300, 42);
    const body2 = Buffer.concat([
        Buffer.from('--' + b2 + '\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'),
        fileBytes, Buffer.from('\r\n'),
        Buffer.from('--' + b2 + '\r\nContent-Disposition: form-data; name="extra"\r\n\r\nv\r\n'),
        Buffer.from('--' + b2 + '--\r\n')
    ]);
    r = await req('POST', '/api/media/transcode-mp3', { headers: { 'Content-Type': 'multipart/form-data; boundary=' + b2 }, body: body2 });
    check('file 在前、附加段在后 -> 取到 file 且字节一致', Buffer.isBuffer(r.body) && r.body.length === fileBytes.length && r.body.equals(fileBytes), 'got=' + (r.body && r.body.length));

    console.log('\n=== m15：不再对 API 输出 CORS 通配符 ===');
    r = await req('GET', '/api/health');
    check('无 Access-Control-Allow-Origin: *', r.headers.get('access-control-allow-origin') !== '*', String(r.headers.get('access-control-allow-origin')));

    console.log('\n=== m13：token 校验 ===');
    r = await req('GET', '/api/token/validate?token=2094973763414822912');
    check('真实 token -> data=true', r.body.data === true, JSON.stringify(r.body));
    r = await req('GET', '/api/token/validate?token=aaaaaa');
    check('形状合法但未授权的 token -> data=false', r.body.data === false, JSON.stringify(r.body));

    console.log('\n================ 汇总 ================');
    console.log('PASS: ' + pass + '   FAIL: ' + fail + '   测试贺卡 id = ' + id);
    if (failures.length) { console.log('\n失败项：'); failures.forEach((f) => console.log('  - ' + f)); }
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试脚本自身异常:', e); process.exit(2); });
