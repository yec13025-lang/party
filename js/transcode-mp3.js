/**
 * 上传阶段调用服务端 FFmpeg 转为 MP3，便于 player.html 预览并提前发现转码失败（含已是 MP3 的重新编码与校验）。
 *
 * 进度模型：
 *   upload     0% -> 90%  （XHR.upload.onprogress 真实字节进度）
 *   transcode  90% -> 99% （后端同步阻塞期间无真实进度，前端按 1 - exp(-t/τ) 渐近曲线估算）
 *   done       100%       （收到响应）
 *
 * 兼容性：purpose=voice 时始终附带 voiceDenoise；无 #voiceDenoise 控件则传 false。music 不变。
 */

/**
 * @param {File} file
 * @param {string} purpose  'music' | 'voice'
 * @param {{ onProgress?: (info: { phase: 'upload'|'transcode'|'done', percent: number, loaded?: number, total?: number }) => void, voiceDenoise?: boolean }} [options]
 * @returns {Promise<Blob>}
 */
// 本地后端 /api/media/transcode-mp3 为「直通」实现（原样回传上传字节，不做 FFmpeg 转码）。
// false → 走本地直通接口，前端仍按真实 MIME 上报，player.html 预览与生成结果一致。
var HB_LOCAL_NO_TRANSCODE = false;

function hbTranscodeToMp3(file, purpose, options) {
    var onProgress = (options && typeof options.onProgress === 'function') ? options.onProgress : function () {};
    options = options || {};

    if (HB_LOCAL_NO_TRANSCODE) {
        onProgress({ phase: 'done', percent: 100 });
        return Promise.resolve(file);
    }

    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var purposeNorm = String(purpose || 'music').toLowerCase();
        var url = '/api/media/transcode-mp3?purpose=' + encodeURIComponent(purposeNorm);
        if (purposeNorm === 'voice') {
            var vd = false;
            if (typeof options.voiceDenoise === 'boolean') {
                vd = options.voiceDenoise;
            } else {
                var vdEl = document.getElementById('voiceDenoise');
                if (vdEl) {
                    vd = !!vdEl.checked;
                }
            }
            url += '&voiceDenoise=' + (vd ? 'true' : 'false');
        }

        var estimatorTimer = null;
        var estimatorStartedAt = 0;
        var lastTranscodePercent = 90;

        function clearEstimator() {
            if (estimatorTimer) {
                clearInterval(estimatorTimer);
                estimatorTimer = null;
            }
        }

        function startTranscodeEstimator(fileSize) {
            clearEstimator();
            estimatorStartedAt = Date.now();
            lastTranscodePercent = 90;
            // τ 越大曲线越缓；按文件大小经验估算（最少 2s，最多 60s）
            var sizeMb = Math.max(0.1, (fileSize || 0) / (1024 * 1024));
            var tau = Math.min(60, Math.max(2, sizeMb * 1.2));
            estimatorTimer = setInterval(function () {
                var elapsed = (Date.now() - estimatorStartedAt) / 1000;
                // 90 + 9 * (1 - e^(-t/τ))，渐近 99%
                var pct = 90 + 9 * (1 - Math.exp(-elapsed / tau));
                // 确保单调不回退
                if (pct > lastTranscodePercent) {
                    lastTranscodePercent = pct;
                    onProgress({ phase: 'transcode', percent: Math.min(99, pct) });
                }
            }, 200);
        }

        function safeReject(err) {
            clearEstimator();
            reject(err);
        }

        try {
            xhr.open('POST', url, true);
            xhr.responseType = 'blob';
        } catch (e) {
            safeReject(new Error('请求初始化失败：' + (e && e.message ? e.message : e)));
            return;
        }

        if (xhr.upload) {
            xhr.upload.onprogress = function (e) {
                if (e && e.lengthComputable && e.total > 0) {
                    var pct = Math.min(90, Math.round(e.loaded * 90 / e.total));
                    onProgress({ phase: 'upload', percent: pct, loaded: e.loaded, total: e.total });
                }
            };
            xhr.upload.onload = function () {
                onProgress({ phase: 'upload', percent: 90 });
                startTranscodeEstimator(file ? file.size : 0);
            };
            xhr.upload.onerror = function () {
                safeReject(new Error('文件上传失败，请检查网络后重试'));
            };
            xhr.upload.onabort = function () {
                safeReject(new Error('文件上传已取消'));
            };
        }

        xhr.onload = function () {
            clearEstimator();
            var status = xhr.status;
            var ct = (xhr.getResponseHeader('Content-Type') || '').toLowerCase();
            var body = xhr.response;

            // 错误响应：后端可能返回 JSON 错误体
            if (status < 200 || status >= 300 || ct.indexOf('application/json') !== -1) {
                parseErrorBlob(body, ct).then(function (msg) {
                    reject(new Error(msg || '提取音频失败，请重新上传文件，或联系客服处理！'));
                }).catch(function () {
                    reject(new Error('提取音频失败，请重新上传文件，或联系客服处理！'));
                });
                return;
            }

            onProgress({ phase: 'done', percent: 100 });
            resolve(body);
        };

        xhr.onerror = function () {
            safeReject(new Error('网络错误，请检查网络后重试'));
        };
        xhr.ontimeout = function () {
            safeReject(new Error('请求超时，请尝试更小的文件或稍后重试'));
        };
        xhr.onabort = function () {
            safeReject(new Error('请求已取消'));
        };

        var fd = new FormData();
        fd.append('file', file);
        try {
            xhr.send(fd);
        } catch (e) {
            safeReject(new Error('发送请求失败：' + (e && e.message ? e.message : e)));
        }
    });
}

/**
 * 把后端返回的错误 Blob 解析为可读文案。
 * @param {Blob|null} blob
 * @param {string} contentType
 * @returns {Promise<string>}
 */
function parseErrorBlob(blob, contentType) {
    if (!blob) {
        return Promise.resolve('');
    }
    return blob.text().then(function (text) {
        if (!text) {
            return '';
        }
        if (contentType && contentType.indexOf('application/json') !== -1) {
            try {
                var j = JSON.parse(text);
                return (j && (j.msg || j.message)) || '';
            } catch (e) {
                return text;
            }
        }
        return text;
    }).catch(function () {
        return '';
    });
}
