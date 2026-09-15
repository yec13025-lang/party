// region 录音共享模块
window.__audioState = {
    mediaRecorder: null,
    audioChunks: [],
    recordingTimer: null,
    recordingTime: 0,
    countdownTimer: null,
    audioBlob: null,
    recordUploadObjectUrl: null
};

function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 真实 MIME → 文件扩展名。用于在「直通」后端回传真实 Content-Type 后，
// 为新 File 选择与内容一致的扩展名，避免把 WebM/WAV/M4A 字节谎称为 .mp3。
var HB_AUDIO_EXT_BY_MIME = {
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
    'video/webm': '.webm',
    'video/x-msvideo': '.avi',
    'video/x-matroska': '.mkv',
    'video/mpeg': '.mpeg',
    'video/3gpp': '.3gp'
};

// 未知 MIME 返回 ''（调用方自行决定回退到原文件名扩展名）
function audioExtForMime(mime) {
    var key = String(mime || '').toLowerCase().split(';')[0].trim();
    return HB_AUDIO_EXT_BY_MIME[key] || '';
}

window.hbAudioExtForMime = audioExtForMime;

function ensureVoiceUploadProgressSlot() {
    const input = document.getElementById('audioFileUpload');
    if (!input || !input.parentElement) {
        return null;
    }
    let slot = document.getElementById('audioFileUploadProgress');
    if (!slot) {
        slot = document.createElement('div');
        slot.id = 'audioFileUploadProgress';
        slot.style.cssText = 'margin-top:10px;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;min-height:36px;text-align:left;';
        input.parentElement.appendChild(slot);
    }
    return slot;
}

function createVoiceUploadProgressRenderer(file) {
    const slot = ensureVoiceUploadProgressSlot();
    if (!slot) {
        return { onProgress: function () {}, dispose: function () {} };
    }
    if (window.hbMusicUpload && typeof window.hbMusicUpload.createProgressRenderer === 'function') {
        return window.hbMusicUpload.createProgressRenderer(slot, file);
    }
    slot.textContent = '正在处理…';
    return {
        onProgress: function (info) {
            const pct = Math.max(0, Math.min(100, Number(info && info.percent) || 0));
            slot.textContent = '音频文件格式转换中 ' + pct.toFixed(0) + '%';
        },
        dispose: function () {
            slot.textContent = '';
        }
    };
}

function removeVoiceUploadProgressSlot() {
    const slot = document.getElementById('audioFileUploadProgress');
    if (slot && slot.parentNode) {
        slot.parentNode.removeChild(slot);
    }
}

// 非 MP3 / 视频先走服务端转码，再用 player.html 预览（与生成时一致）
async function handleAudioFileUpload(file) {
    const s = window.__audioState;

    const allowedAudioTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/mp4',
        'audio/ogg',
        'audio/webm',
        'audio/aac',
        'audio/flac',
        'audio/x-m4a',
        'audio/mp3',
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo',
        'video/x-matroska',
        'video/mpeg',
        'video/3gpp'
    ];

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac', 'mp4', 'mov', 'mkv', 'avi', 'mpeg', '3gp', 'ncm', 'kwm', 'kgm', 'mflac', 'mgg', 'qmc0', 'qmc2', 'qmc3'];
    const typeOk = allowedAudioTypes.includes(file.type) || allowedExtensions.includes(fileExtension)
        || (file.type && file.type.startsWith('audio/'));

    if (!typeOk) {
        alert('请上传有效的音频或带声音的视频');
        const audioFileUpload = document.getElementById('audioFileUpload');
        if (audioFileUpload) audioFileUpload.value = '';
        return;
    }

    const maxSize = 60 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('文件大小不能超过60MB');
        const audioFileUpload = document.getElementById('audioFileUpload');
        if (audioFileUpload) audioFileUpload.value = '';
        return;
    }

    let workingFile = file;
    let recSkipTranscode = false;

    // 加密格式预处理（NCM 等），使用 hb-music-upload.js 管线（processUpload 含解密+转码）
    var hbUpload = window.hbMusicUpload;
    if (hbUpload) {
        var recEncryptExts = ['.ncm', '.kwm', '.kgm', '.mflac', '.mgg', '.qmc0', '.qmc2', '.qmc3'];
        var recIsEncrypted = recEncryptExts.some(function(e) { return file.name.toLowerCase().endsWith(e); });
        if (recIsEncrypted) {
            try {
                var recProgressSlot = ensureVoiceUploadProgressSlot();
                var recProcessedFile = await hbUpload.processUpload(file, document.getElementById('audioFileUpload'), recProgressSlot, 'voice');
                workingFile = recProcessedFile;
                recSkipTranscode = true;
            } catch (e) {
                alert(e.message || '提取音频失败，请重新上传文件，或联系客服处理！');
                var audioFileUpload = document.getElementById('audioFileUpload');
                if (audioFileUpload) audioFileUpload.value = '';
                return;
            }
        }
    }

    if (!recSkipTranscode && typeof hbTranscodeToMp3 === 'function') {
        const renderer = createVoiceUploadProgressRenderer(file);
        try {
            const out = await hbTranscodeToMp3(file, 'voice', { onProgress: renderer.onProgress });
            const base = file.name.replace(/\.[^.]+$/, '');
            // 本地后端 /api/media/transcode-mp3 是「直通」实现：原样回传上传字节，并回显真实 Content-Type。
            // 因此必须沿用响应里的真实 MIME 与对应扩展名，绝不能把非 MP3 字节改名为 .mp3 / audio/mpeg
            // （否则 iOS Safari 无法解码 WebM/Opus，贺卡在手机上静音）。
            const outType = (out && out.type) ? out.type : (file.type || 'application/octet-stream');
            const outExt = audioExtForMime(outType) || ('.' + (file.name.split('.').pop() || 'bin'));
            workingFile = (out instanceof File) ? out : new File([out], base + outExt, { type: outType });
            renderer.dispose();
            removeVoiceUploadProgressSlot();
        } catch (e) {
            renderer.dispose();
            removeVoiceUploadProgressSlot();
            const errorMsg = e.message || '音频转换失败';
            alert(errorMsg + '\n请检查文件是否损坏，或尝试更换文件重新上传。如果问题持续，请联系客服。');
            const audioFileUpload = document.getElementById('audioFileUpload');
            if (audioFileUpload) audioFileUpload.value = '';
            return;
        }
    } else if (!recSkipTranscode) {
        const nameSlot = ensureVoiceUploadProgressSlot();
        if (nameSlot) nameSlot.textContent = workingFile.name;
    }

    // 清理之前的Blob URL（如果存在）
    if (s.recordUploadObjectUrl) {
        URL.revokeObjectURL(s.recordUploadObjectUrl);
        s.recordUploadObjectUrl = null;
    }

    const audioWrap = document.getElementById('recordAudioPlayerWrap');
    if (audioWrap) audioWrap.classList.remove('hidden');

    function finishPreview() {
        const prev = document.getElementById('audioPreview');
        if (prev) prev.style.display = 'block';
        removeVoiceUploadProgressSlot();
    }

    function failRead(errorDetail) {
        const suggestion = errorDetail || '请检查文件是否损坏，或尝试更换文件重新上传';
        alert('音频文件读取失败\n' + suggestion);
        const audioFileUpload = document.getElementById('audioFileUpload');
        if (audioFileUpload) audioFileUpload.value = '';
        removeVoiceUploadProgressSlot();
    }

    // 修复：使用FileReader直接读取文件为base64，与背景音乐上传逻辑保持一致
    // 避免使用Blob URL和Audio预加载，解决iOS微信环境下的兼容性问题
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const base64 = e.target.result;
            s.audioBlob = workingFile;
            
            // 尝试从文件名中获取时长信息，或使用默认值
            // 注意：由于移除了Audio预加载，无法准确获取音频时长
            // 播放器会自行解析时长，这里使用0表示未知
            s.recordingTime = 0;

            const playerIframe = document.querySelector('#audioPreview .music-player iframe');
            if (playerIframe) {
                playerIframe.src = `./html/player.html`;
                playerIframe.onload = () => {
                    try {
                        playerIframe.contentWindow.postMessage({
                            type: 'initAudio',
                            src: base64,
                            duration: s.recordingTime,
                            mimeType: workingFile.type || 'audio/mpeg',
                            fileName: workingFile.name || '录音内容'
                        }, '*');
                    } catch (postError) {
                        console.error('播放器初始化失败:', postError);
                        failRead('播放器初始化失败，请刷新页面后重试');
                        return;
                    }
                };
            }
            finishPreview();
        } catch (error) {
            console.error('处理音频数据时出错:', error);
            failRead('处理音频数据时出错，请重试');
        }
    };
    
    reader.onerror = function (error) {
        console.error('FileReader读取失败:', error);
        failRead('文件读取失败，请检查文件是否损坏');
    };
    
    reader.onabort = function () {
        console.warn('FileReader读取被中断');
        failRead('文件读取被中断，请重试');
    };
    
    try {
        reader.readAsDataURL(workingFile);
    } catch (readError) {
        console.error('启动文件读取失败:', readError);
        failRead('启动文件读取失败，请重试');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // 仅保留音频文件上传：本地 HTTP/局域网环境无法使用 getUserMedia，麦克风录音已整体移除
    const audioFileUpload = document.getElementById('audioFileUpload');
    if (audioFileUpload) {
        audioFileUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                handleAudioFileUpload(file).catch(function (err) {
                    console.error(err);
                });
            }
        });
    }

    const delBtn = document.getElementById('deleteAudioBtn');
    if (delBtn) delBtn.addEventListener('click', function () {
        const s = window.__audioState;
        const audioFileUpload = document.getElementById('audioFileUpload');
        if (audioFileUpload) {
            audioFileUpload.value = '';
        }
        // 停止预览播放器（原独立函数逻辑已就地内联）
        const previewIframe = document.querySelector('#audioPreview .music-player iframe');
        if (previewIframe && previewIframe.contentWindow) {
            previewIframe.contentWindow.postMessage({type: 'player:pause'}, '*');
        }
        if (previewIframe) {
            previewIframe.src = './html/player.html';
        }
        if (s.recordUploadObjectUrl) {
            URL.revokeObjectURL(s.recordUploadObjectUrl);
            s.recordUploadObjectUrl = null;
        }
        s.audioBlob = null;
        removeVoiceUploadProgressSlot();
        const wrap = document.getElementById('recordAudioPlayerWrap');
        if (wrap) wrap.classList.remove('hidden');
        const prev = document.getElementById('audioPreview');
        if (prev) prev.style.display = 'none';
    });
});
// endregion


