/**
 * 背景音乐上传：校验 → 加密格式预处理（unpack-worker.js）→ 服务端 FFmpeg 转 MP3 → 预览
 */
(function () {
    'use strict';

    var MAX_BYTES = 60 * 1024 * 1024;
    var FAIL_MSG = '提取音频失败，请重新上传文件，或联系客服处理！';
    var WORKER_URL = '/js/unpack-worker.js';

    var VALID_TYPES = [
        'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/x-m4a', 'audio/mp3',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska', 'video/mpeg', 'video/3gpp'
    ];

    var VALID_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac', '.flac', '.mp4', '.mov', '.mkv', '.avi', '.mpeg', '.3gp'];

    var ENCRYPT_EXT = {
        mflac: 1, mgg: 1, qmcflac: 1, qmcogg: 1, qmc0: 1, qmc2: 1, qmc3: 1,
        tkm: 1, tm0: 1, tm2: 1, tm3: 1, tm6: 1,
        ncm: 1,
        kgm: 1, kgma: 1, kgg: 1, vpr: 1,
        kwm: 1
    };

    var QQ_PREFIXES = ['mflac', 'mgg', 'qmc', 'tm'];
    var PLAIN_DECOY_EXTS = { flac: 1, mp3: 1, m4a: 1, ogg: 1, wav: 1, aac: 1 };
    var NCM_MAGIC = [0x43, 0x54, 0x45, 0x4e, 0x46, 0x44, 0x41, 0x4d];

    var unpackWorkerPromise = null;

    function hasEncryptExtInName(filename) {
        return !!resolveEncryptExtFromFilename(filename);
    }

    function bytesHasPrefix(data, prefix) {
        if (!data || prefix.length > data.length) {
            return false;
        }
        for (var i = 0; i < prefix.length; i++) {
            if (data[i] !== prefix[i]) {
                return false;
            }
        }
        return true;
    }

    function isPlainAudioMagic(buffer) {
        if (!buffer || buffer.byteLength < 4) {
            return false;
        }
        var u8 = new Uint8Array(buffer);
        if (bytesHasPrefix(u8, [0x66, 0x4c, 0x61, 0x43])) return true;
        if (bytesHasPrefix(u8, [0x49, 0x44, 0x33])) return true;
        if (bytesHasPrefix(u8, [0x4f, 0x67, 0x67, 0x53])) return true;
        if (bytesHasPrefix(u8, [0x52, 0x49, 0x46, 0x46])) return true;
        if (u8.length >= 8 && bytesHasPrefix(u8.slice(4), [0x66, 0x74, 0x79, 0x70])) return true;
        if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return true;
        return false;
    }

    function matchesEncryptSegment(seg) {
        if (!seg) {
            return null;
        }
        var lower = seg.toLowerCase();
        if (ENCRYPT_EXT[lower]) {
            return lower;
        }
        var i;
        for (i = 0; i < QQ_PREFIXES.length; i++) {
            var p = QQ_PREFIXES[i];
            if (lower.indexOf(p) === 0 && lower.length > p.length) {
                return lower;
            }
        }
        return null;
    }

    function resolveEncryptExtFromFilename(filename) {
        if (!filename || filename.indexOf('.') < 0) {
            return null;
        }
        var parts = filename.split('.');
        if (parts.length < 2) {
            return null;
        }
        var i;
        for (i = parts.length - 1; i >= 0; i--) {
            var seg = parts[i].toLowerCase();
            if (PLAIN_DECOY_EXTS[seg]) {
                continue;
            }
            var hit = matchesEncryptSegment(seg);
            if (hit) {
                return hit;
            }
            break;
        }
        return null;
    }

    function rewriteWorkerName(filename, encryptExt) {
        if (!filename || !encryptExt) {
            return filename;
        }
        var suffix = '.' + encryptExt;
        var idx = filename.toLowerCase().lastIndexOf(suffix.toLowerCase());
        if (idx >= 0) {
            return filename.substring(0, idx) + suffix;
        }
        return filename.replace(/\.[^.]+$/, '') + suffix;
    }

    function needsUnpackWorker(file, buffer) {
        var name = file && file.name ? file.name : '';
        var encryptExt = resolveEncryptExtFromFilename(name);
        if (encryptExt) {
            return { needsWorker: true, workerName: rewriteWorkerName(name, encryptExt) };
        }
        if (buffer && bytesHasPrefix(new Uint8Array(buffer), NCM_MAGIC)) {
            var ncmName = rewriteWorkerName(name, 'ncm');
            return {
                needsWorker: true,
                workerName: ncmName.indexOf('.ncm') >= 0 ? ncmName : (name.replace(/\.[^.]+$/, '') + '.ncm')
            };
        }
        if (buffer && isPlainAudioMagic(buffer)) {
            return { needsWorker: false, workerName: null };
        }
        return { needsWorker: false, workerName: null };
    }

    function getUnpackWorkerProxy() {
        var threads = window.threads;
        if (!threads || typeof threads.spawn !== 'function') {
            return Promise.reject(new Error('threads 未加载'));
        }
        if (!unpackWorkerPromise) {
            var worker = (typeof threads.Worker === 'function')
                ? new threads.Worker(WORKER_URL)
                : new Worker(WORKER_URL);
            unpackWorkerPromise = threads.spawn(worker, { timeout: 120000 });
        }
        return unpackWorkerPromise;
    }

    /** 直接调用 unpack-worker.js；raw 须为 File/Blob（Worker 内用 FileReader / .arrayBuffer() 读取） */
    function unpackViaWorker(rawInput, workerName) {
        var payload = { raw: rawInput, name: workerName };
        return getUnpackWorkerProxy().then(function (proxy) {
            return proxy(payload, {});
        });
    }

    function workerResultToFile(result, fallbackName) {
        if (!result || !result.blob) {
            throw new Error(FAIL_MSG);
        }
        var ext = (result.ext || 'mp3').replace(/^\./, '');
        var outName = (result.title || fallbackName.replace(/\.[^.]+$/, '')) + '.' + ext;
        outName = outName.replace(/[\\/:*?"<>|]/g, '_');
        return new File([result.blob], outName, { type: result.mime || 'application/octet-stream' });
    }

    function hbMusicValidate(file) {
        if (!file) {
            return '请选择文件';
        }
        var ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        var plainOk = VALID_TYPES.indexOf(file.type) >= 0 || VALID_EXT.indexOf(ext) >= 0
            || (file.type && file.type.indexOf('audio/') === 0)
            || (file.type && file.type.indexOf('video/') === 0);
        if (!plainOk && !hasEncryptExtInName(file.name)) {
            return '请选择有效的音频或带声音的视频';
        }
        if (file.size > MAX_BYTES) {
            return '文件大小不能超过60MB';
        }
        return null;
    }

    function createProgressRenderer(nameEl, file) {
        if (!nameEl) {
            return { onProgress: function () {}, dispose: function () {} };
        }

        nameEl.textContent = '';
        nameEl.style.display = 'block';

        var wrap = document.createElement('div');
        wrap.className = 'hb-tx';
        wrap.style.cssText = 'width:100%;text-align:left;';

        var nameLine = document.createElement('div');
        nameLine.className = 'hb-tx__name';
        nameLine.style.cssText = 'font-size:13px;color:#374151;word-break:break-all;margin-bottom:6px;';
        nameLine.textContent = file && file.name ? file.name : '';

        var bar = document.createElement('div');
        bar.className = 'hb-tx__bar';
        bar.style.cssText = 'width:100%;height:6px;background:#e5e7eb;border-radius:9999px;overflow:hidden;';

        var fill = document.createElement('div');
        fill.className = 'hb-tx__fill';
        fill.style.cssText = 'height:100%;width:0%;background:#FF6B8B;transition:width 200ms ease;';
        bar.appendChild(fill);

        var phase = document.createElement('div');
        phase.className = 'hb-tx__phase';
        phase.style.cssText = 'margin-top:6px;font-size:12px;color:#6b7280;';
        phase.textContent = '准备中…';

        wrap.appendChild(nameLine);
        wrap.appendChild(bar);
        wrap.appendChild(phase);
        nameEl.appendChild(wrap);

        var disposed = false;

        function onProgress(info) {
            if (disposed || !info) {
                return;
            }
            var pct = Math.max(0, Math.min(100, Number(info.percent) || 0));
            fill.style.width = pct.toFixed(0) + '%';
            phase.textContent = '音频文件格式转换中 ' + pct.toFixed(0) + '%';
        }

        function dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            if (wrap && wrap.parentNode === nameEl) {
                nameEl.removeChild(wrap);
            }
        }

        return { onProgress: onProgress, dispose: dispose };
    }

    function hbMusicTranscodeReplaceInput(file, input, nameEl, purpose) {
        if (typeof hbTranscodeToMp3 !== 'function') {
            return Promise.reject(new Error('转码脚本未加载'));
        }
        var renderer = createProgressRenderer(nameEl, file);
        return hbTranscodeToMp3(file, purpose || 'music', { onProgress: renderer.onProgress }).then(function (blob) {
            var base = file.name.replace(/\.[^.]+$/, '');
            // /api/media/transcode-mp3 是「直通」实现：原样回传上传字节并回显真实 Content-Type。
            // 因此必须沿用真实 MIME 与对应扩展名，不能把 WebM/WAV/M4A 字节谎称为 .mp3 / audio/mpeg，
            // 否则 iOS Safari 无法解码，贺卡在手机上静音。
            var outType = (blob && blob.type) ? blob.type : (file.type || 'application/octet-stream');
            var outExt = (typeof audioExtForMime === 'function' ? audioExtForMime(outType) : '')
                || ('.' + (file.name.split('.').pop() || 'bin'));
            var displayFile = (blob instanceof File) ? blob : new File([blob], base + outExt, { type: outType });
            var dt = new DataTransfer();
            dt.items.add(displayFile);
            input.files = dt.files;
            renderer.dispose();
            if (nameEl) {
                nameEl.textContent = displayFile.name;
            }
            return displayFile;
        }).catch(function () {
            input.value = '';
            renderer.dispose();
            if (nameEl) {
                nameEl.textContent = '';
            }
            throw new Error(FAIL_MSG);
        });
    }

    function hbMusicProcessUpload(file, input, nameEl, purpose) {
        var chain = Promise.resolve(file);

        if (window.threads) {
            chain = file.arrayBuffer().then(function (buffer) {
                var info = needsUnpackWorker(file, buffer);
                if (!info.needsWorker) {
                    return file;
                }
                return unpackViaWorker(file, info.workerName).then(function (result) {
                    return workerResultToFile(result, file.name);
                });
            }).catch(function (err) {
                console.error('[hbMusicProcessUpload] 预处理失败:', err);
                throw new Error(FAIL_MSG);
            });
        }

        return chain.then(function (workingFile) {
            return hbMusicTranscodeReplaceInput(workingFile, input, nameEl, purpose);
        });
    }

    function hbMusicInitPlayer(iframe, playerPath, dataUrl, mimeType, fileName, accentColor) {
        if (!iframe) {
            return;
        }
        var path = playerPath || '/html/player.html';
        var bust = '_=' + Date.now();
        var sep = path.indexOf('?') >= 0 ? '&' : '?';
        iframe.src = path + sep + bust;
        var payload = {
            type: 'initAudio',
            src: dataUrl,
            mimeType: mimeType || 'audio/mpeg',
            fileName: fileName || '背景音乐',
            accentColor: accentColor || ''
        };
        iframe.onload = function () {
            iframe.contentWindow.postMessage(payload, '*');
        };
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(payload, '*');
        }
    }

    window.hbMusicUpload = {
        maxBytes: MAX_BYTES,
        failMessage: FAIL_MSG,
        validate: hbMusicValidate,
        transcodeReplaceInput: hbMusicTranscodeReplaceInput,
        processUpload: hbMusicProcessUpload,
        initPlayer: hbMusicInitPlayer,
        createProgressRenderer: createProgressRenderer
    };
})();
