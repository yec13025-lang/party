/**
 * 制作页内嵌修改模式：?blessingid=xxx&mode=edit
 * 使用独立 /api/edit 入口，仅提交当前页字段；未改动的录音/音乐/图片不会提交、不会被服务端触碰。
 */
(function () {
    'use strict';

    var editingBlessingId = '';
    var editModeActive = false;
    var editPageType = 'base';
    var loadingBlessing = false;
    var userClearedVoice = false;
    var userClearedMusic = false;
    var loadedImageCount = 0;

    function parseUrlParams() {
        try {
            return new URLSearchParams(window.location.search);
        } catch (e) {
            return new URLSearchParams();
        }
    }

    function resolveBlessingIdFromUrl() {
        var params = parseUrlParams();
        var fromQuery = params.get('blessingid') || params.get('blessingId') || params.get('id') || '';
        if (fromQuery && typeof extractBlessingId === 'function') {
            return extractBlessingId(fromQuery) || fromQuery;
        }
        return fromQuery;
    }

    function resolveEditPageType() {
        var path = (window.location.pathname || '').toLowerCase();
        if (path.indexOf('index.picture') !== -1) return 'picture';
        if (path.indexOf('index.audio') !== -1) return 'audio';
        return 'base';
    }

    function isEditMode() {
        return editModeActive && !!editingBlessingId;
    }

    function getEditingBlessingId() {
        return editingBlessingId;
    }

    function getEl(id) {
        return document.getElementById(id);
    }

    function hasEl(id) {
        return !!getEl(id);
    }

    function setInputValue(id, value) {
        var el = getEl(id);
        if (el) el.value = value != null ? value : '';
    }

    function resetUserClearFlags() {
        userClearedVoice = false;
        userClearedMusic = false;
        loadedImageCount = 0;
    }

    function bindUserClearListeners() {
        var deleteAudioBtn = getEl('deleteAudioBtn');
        if (deleteAudioBtn && !deleteAudioBtn.dataset.hbEditBound) {
            deleteAudioBtn.dataset.hbEditBound = '1';
            deleteAudioBtn.addEventListener('click', function () {
                userClearedVoice = true;
            });
        }
        var deleteMusicBtn = getEl('deleteMusicBtn');
        if (deleteMusicBtn && !deleteMusicBtn.dataset.hbEditBound) {
            deleteMusicBtn.dataset.hbEditBound = '1';
            deleteMusicBtn.addEventListener('click', function () {
                userClearedMusic = true;
            });
        }
    }

    function triggerThemeColorChange(value) {
        if (!value || !document.querySelector('input[name="themeColor"]')) return;
        var radio = document.querySelector('input[name="themeColor"][value="' + value + '"]');
        if (!radio) return;
        document.querySelectorAll('input[name="themeColor"]').forEach(function (el) {
            el.checked = false;
        });
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function applyBlessingVoiceEchoFromReport(d) {
        if (!hasEl('audioPreview') && !hasEl('deleteAudioBtn') && !hasEl('recordPlayerIframe')) return;
        if (typeof clearBlessingVoiceLocalState === 'function') {
            clearBlessingVoiceLocalState();
        } else if (window.__audioState) {
            window.__audioState.audioBlob = null;
            window.__audioState.audioChunks = [];
        }
        var audioPreview = getEl('audioPreview');
        var recordingTime = getEl('recordingTime');
        var timeDisplay = getEl('timeDisplay');
        var recordIframe = getEl('recordPlayerIframe');
        var recordWrap = getEl('recordAudioPlayerWrap');
        var src = d && (d.audio || d.audioUrl);
        if (src) {
            if (recordWrap) recordWrap.classList.remove('hidden');
            if (audioPreview) {
                audioPreview.classList.remove('hidden');
                audioPreview.style.display = 'block';
            }
            if (recordingTime) {
                recordingTime.classList.remove('hidden');
                recordingTime.style.display = 'block';
            }
            if (timeDisplay) {
                var digits = d.timeDisplay != null ? String(d.timeDisplay).replace(/\D/g, '') : '';
                timeDisplay.innerText = digits || '0';
            }
            if (recordIframe) {
                recordIframe.onload = function () {
                    try {
                        recordIframe.contentWindow.postMessage({ type: 'player:reset' }, '*');
                        recordIframe.contentWindow.postMessage({
                            type: 'initAudio',
                            src: src,
                            fileName: '已保存的录音'
                        }, '*');
                    } catch (e) { /* ignore */ }
                };
                recordIframe.src = './html/player.html?v=' + Date.now();
            }
        } else {
            if (audioPreview) {
                audioPreview.classList.add('hidden');
                audioPreview.style.display = '';
            }
            if (recordingTime) {
                recordingTime.classList.add('hidden');
                recordingTime.style.display = 'none';
            }
            if (timeDisplay) timeDisplay.innerText = '0';
            if (recordIframe) recordIframe.src = './html/player.html?v=' + Date.now();
            if (recordWrap) recordWrap.classList.remove('hidden');
        }
    }

    function applyEditModeChrome() {
        var titleEl = getEl('pageModeTitle');
        if (titleEl) {
            titleEl.textContent = titleEl.getAttribute('data-title-edit') || '生日二维码(修改页)';
        }
        var genBtn = document.querySelector('.generate-btn');
        if (genBtn) {
            if (!genBtn.dataset.hbGenerateOrigHtml) {
                genBtn.dataset.hbGenerateOrigHtml = genBtn.getAttribute('data-label-create') || genBtn.innerHTML;
            }
            genBtn.innerHTML = genBtn.getAttribute('data-label-edit') || '✨ 立即更新 ✨';
        }
    }

    // 图片直读 COS（与音频/背景音乐直读一致，不经过服务器代理，无双份流量）。
    // 跨域 fetch 依赖 COS 控制台 CORS 规则放行；未配 CORS 会报「No 'Access-Control-Allow-Origin'」。
    // 编辑页需将图片转 dataURL 进上传预览，故用 fetch+blob（与 <audio> 直读不同，必须 CORS）。
    async function fetchImageDirect(url) {
        var resp = await fetch(url);
        if (!resp.ok) {
            throw new Error('图片加载失败: ' + url);
        }
        return resp;
    }

    // 逐张转 dataURL：优先复用现有逻辑，简单封装以便并行
    function readImageBlobToDataUrl(blob) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                resolve(e.target.result);
            };
            reader.readAsDataURL(blob);
        });
    }

    async function loadImagesFromReport(data) {
        if (!hasEl('imageUpload')) return;
        window.uploadedImages = window.uploadedImages || [];
        window.uploadedImages.length = 0;
        window.__recommendedImageGroup = data.recommendedImageGroup || '';
        loadedImageCount = (data.images && data.images.length) || 0;
        if (data.images && data.images.length > 0) {
            // 先铺「加载中」占位并立即刷新预览，让用户看到图片容器与加载状态
            for (var k = 0; k < data.images.length; k++) {
                window.uploadedImages.push({ data: '', file: null, isLoading: true });
            }
            if (typeof updateImagePreview === 'function') {
                updateImagePreview();
            }
            // 各图并行加载，完成一张即原位替换该格（增量刷新，不整区重建，更快更顺）
            await Promise.all(data.images.map(function (url, idx) {
                return fetchImageDirect(url)
                    .then(function (imgResp) { return imgResp.blob(); })
                    .then(function (blob) { return readImageBlobToDataUrl(blob); })
                    .then(function (dataUrl) {
                        window.uploadedImages[idx] = { data: dataUrl, file: null };
                        if (typeof updateImagePreviewAtIndex === 'function') {
                            updateImagePreviewAtIndex(idx);
                        } else if (typeof updateImagePreview === 'function') {
                            updateImagePreview();
                        }
                    })
                    .catch(function () {
                        window.uploadedImages[idx] = { data: '', file: null, loadError: true };
                        if (typeof updateImagePreviewAtIndex === 'function') {
                            updateImagePreviewAtIndex(idx);
                        } else if (typeof updateImagePreview === 'function') {
                            updateImagePreview();
                        }
                    });
            }));
        } else if (typeof updateImagePreview === 'function') {
            updateImagePreview();
        }
    }

    async function loadBlessingIntoForm(blessingId) {
        if (!blessingId || loadingBlessing) return false;
        loadingBlessing = true;
        resetUserClearFlags();
        try {
            var response = await fetch(
                '/api/birthdayreport/' + encodeURIComponent(blessingId) +
                    '?isloadimg=true&isloadaudio=true&isloadbase64=false'
            );
            if (!response.ok) throw new Error('获取祝福信息失败');
            var json = await response.json();
            if (json.code !== 200 || !json.data) {
                throw new Error(json.msg || '获取祝福信息失败');
            }
            var data = json.data;

            if (hasEl('name')) setInputValue('name', data.userName || '');
            if (hasEl('sender')) setInputValue('sender', data.sender || '');
            if (hasEl('blessingMessage')) setInputValue('blessingMessage', data.blessingMessage || '');

            if (hasEl('birthday') && data.birthday) {
                var birthdayInput = getEl('birthday');
                var dateValue = window.hbBirthday
                    ? window.hbBirthday.mmddToDateValue(data.birthday)
                    : data.birthday;
                if (window.hbWheelPicker && typeof window.hbWheelPicker.setBirthdayYmd === 'function') {
                    window.hbWheelPicker.setBirthdayYmd(birthdayInput, dateValue);
                } else if (birthdayInput) {
                    birthdayInput.value = dateValue || birthdayInput.value;
                }
            }

            for (var i = 1; i <= 9; i++) {
                var field = getEl('text' + i);
                if (field) field.value = data['text' + i] || '';
            }

            if (data.themeColor && document.querySelector('input[name="themeColor"]')) {
                triggerThemeColorChange(data.themeColor);
            }

            if (hasEl('email')) setInputValue('email', data.celebrantEmail || '');

            await loadImagesFromReport(data);
            applyBlessingVoiceEchoFromReport(data);

            var applyMusicEcho =
                typeof window.hbApplyEchoMusicFromReport === 'function'
                    ? window.hbApplyEchoMusicFromReport
                    : typeof window.hbUpdateApplyEchoMusicFromReport === 'function'
                      ? window.hbUpdateApplyEchoMusicFromReport
                      : null;
            if (applyMusicEcho) {
                await applyMusicEcho(data);
            }

            return true;
        } catch (err) {
            console.error('[hbEditMode] load failed', err);
            if (window.showToast) {
                showToast({ title: '加载失败', message: err.message || '无法加载贺卡信息' }, 'error', 2400);
            } else {
                alert('加载失败，请检查链接是否正确');
            }
            return false;
        } finally {
            loadingBlessing = false;
        }
    }

    function validateEditForm() {
        var birthday = getEl('birthday') ? getEl('birthday').value.trim() : '';
        var email = hasEl('email') ? getEl('email').value.trim() : '';

        if (birthday && window.hbBirthday) {
            var bv = window.hbBirthday.validateBirthday(birthday, false);
            if (!bv.valid) {
                alert(bv.message);
                return false;
            }
        }
        if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            alert('邮箱格式不正确，请检查');
            return false;
        }
        return true;
    }

    function buildEditPayload() {
        var nameEl = getEl('name');
        var birthdayEl = getEl('birthday');
        var senderEl = getEl('sender');
        if (!nameEl || !birthdayEl || !senderEl) {
            alert('页面缺少必要表单字段');
            return null;
        }

        var userName = nameEl.value.trim();
        if (userName.length > 16) {
            alert('寿星姓名最多输入16个字符');
            return null;
        }

        var payload = {
            editPage: editPageType,
            userName: userName,
            birthday: window.hbBirthday
                ? window.hbBirthday.normalizeBirthdayInput(birthdayEl.value.trim())
                : birthdayEl.value.trim(),
            sender: senderEl.value.trim()
        };

        var blessingMessageEl = getEl('blessingMessage');
        if (blessingMessageEl) {
            payload.blessingMessage = blessingMessageEl.value.trim();
        }

        if (document.querySelector('input[name="themeColor"]')) {
            var selectedTheme = document.querySelector('input[name="themeColor"]:checked');
            if (selectedTheme) payload.themeColor = selectedTheme.value;
        }

        if (hasEl('email')) {
            payload.celebrantEmail = getEl('email').value.trim();
        }

        if (editPageType === 'picture' || editPageType === 'audio') {
            for (var i = 1; i <= 9; i++) {
                var textEl = getEl('text' + i);
                if (textEl) payload['text' + i] = textEl.value.trim();
            }
        }

        return payload;
    }

    function appendPicturePayload(payload) {
        if (editPageType !== 'picture' && editPageType !== 'audio') return;
        if (!hasEl('imageUpload')) return;

        var uploadedImages = window.uploadedImages || [];
        var shouldClearImages = loadedImageCount > 0
            && uploadedImages.length === 0
            && !window.__recommendedImageGroup;

        if (shouldClearImages) {
            payload.clearImages = true;
            return;
        }
        if (window.__recommendedImageGroup) {
            payload.recommendedImageGroup = window.__recommendedImageGroup;
        } else if (uploadedImages.length > 0) {
            var ready = uploadedImages.filter(function (img) {
                return img && typeof img.data === 'string' && img.data.indexOf('data:') === 0;
            });
            if (ready.length !== uploadedImages.length) {
                // 有图片仍在加载或加载失败：不能提交，否则服务端会把残缺的 images 当作「清空」处理，导致照片被永久删除
                var failedCount = 0;
                uploadedImages.forEach(function (img) {
                    if (!img || typeof img.data !== 'string' || img.data.indexOf('data:') !== 0) failedCount++;
                });
                var hasLoadError = uploadedImages.some(function (img) { return !!(img && img.loadError); });
                throw new Error(hasLoadError
                    ? '有 ' + failedCount + ' 张图片加载失败，已停止更新以避免原有照片被清空。请重新选择这些图片后再点击更新。'
                    : '图片尚未加载完成（还有 ' + failedCount + ' 张），请稍候再点击更新。');
            }
            payload.images = ready.map(function (img) { return img.data; });
        }
    }

    async function appendAudioPayload(payload) {
        if (editPageType !== 'audio') return;

        if (window.__audioState && window.__audioState.audioBlob) {
            userClearedVoice = false;
            var timeDisplay = getEl('timeDisplay') ? getEl('timeDisplay').innerText : '0';
            var blob = window.__audioState.audioBlob;
            // 原始类型：直通后端若没回显 Content-Type，用它兜底，绝不谎称 audio/mpeg
            var sourceType = (blob && blob.type) ? blob.type : '';
            if (typeof hbTranscodeToMp3 === 'function') {
                try {
                    var inputType = sourceType || 'audio/webm';
                    var ext = inputType.indexOf('mp4') !== -1 ? 'm4a' : 'webm';
                    var sourceFile = new File([blob], 'recorded.' + ext, { type: inputType });
                    var out = await hbTranscodeToMp3(sourceFile, 'voice');
                    // /api/media/transcode-mp3 是直通实现（原样回传字节并回显真实 Content-Type），
                    // 因此保留 blob 自身真实 type；type 为空时才回退到源文件类型。
                    // 绝不能把非 MP3 字节标记成 audio/mpeg：convertBlobToBase64 依赖 blob.type 生成
                    // data URL 的 MIME，服务端再按 MIME 决定存储扩展名（audio/webm → .webm）。
                    if (out) {
                        var outType = (out.type || sourceType || '');
                        blob = (out instanceof Blob) ? out : new Blob([out], { type: outType });
                        if (!blob.type && outType) {
                            blob = new Blob([blob], { type: outType });
                        }
                    }
                } catch (e) { /* fallback original */ }
            }
            payload.audio = await convertBlobToBase64(blob);
            payload.timeDisplay = timeDisplay;
        } else if (userClearedVoice) {
            payload.clearVoice = true;
        }

        if (!hasEl('automationMusic')) return;

        var automationMusicFile = getEl('automationMusic').files[0];
        if (automationMusicFile) {
            userClearedMusic = false;
            payload.automationMusicData = await convertFileToBase64(automationMusicFile);
        } else if (window.__recommendedMusicKey) {
            userClearedMusic = false;
            payload.recommendedMusicKey = window.__recommendedMusicKey;
        } else if (userClearedMusic) {
            payload.clearAutomationMusic = true;
        }
    }

    async function updateBlessing() {
        if (!isEditMode()) return;
        var blessingId = editingBlessingId;
        var name = getEl('name') ? getEl('name').value.trim() : '';
        var birthday = getEl('birthday') ? getEl('birthday').value.trim() : '';
        var sender = getEl('sender') ? getEl('sender').value.trim() : '';

        if (!name || !birthday || !sender) {
            if (window.showToast) {
                showToast({ title: '提示', message: '该字段必填' }, 'warning', 2200);
            } else {
                alert('该字段必填');
            }
            return;
        }
        if (!validateEditForm()) return;

        var btn = document.querySelector('.generate-btn');
        var origHtml = btn ? (btn.dataset.hbGenerateOrigHtml || btn.innerHTML) : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i><span>更新中...</span>';
        }
        try {
            var payload = buildEditPayload();
            if (!payload) return;
            appendPicturePayload(payload);
            await appendAudioPayload(payload);

            var response = await fetch('/api/edit?blessingId=' + encodeURIComponent(blessingId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var data = await response.json();
            if (!response.ok || data.code !== 200) {
                throw new Error(data.msg || '更新失败');
            }

            var url = window.location.origin + '/integrated.html?blessingid=' + blessingId;
            var themeColor = payload.themeColor || 'pink';
            if (window.hbResultModal && typeof window.hbResultModal.showResultModal === 'function') {
                var posterDataUrl = await createPosterMobile(url, sender, name, themeColor, false);
                if (!posterDataUrl) throw new Error('贺卡图片生成失败，请重试');
                await window.hbResultModal.showResultModal(url, false, posterDataUrl, {
                    celebrantName: name,
                    senderName: sender
                });
                if (typeof window.hbResultModal.updateHistoryItem === 'function') {
                    window.hbResultModal.updateHistoryItem(url, {
                        updatedAt: new Date().toISOString(),
                        celebrantName: name,
                        senderName: sender
                    });
                }
            } else if (window.showToast) {
                showToast({ title: '更新成功', message: '贺卡已更新' }, 'success', 2200);
            }
        } catch (err) {
            console.error('[hbEditMode] update failed', err);
            if (window.showToast) {
                showToast({ title: '更新失败', message: err.message || '请稍后重试' }, 'error', 2400);
            } else {
                alert('更新失败：' + (err.message || '请稍后重试'));
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = btn.getAttribute('data-label-edit') || origHtml;
            }
        }
    }

    async function initFromUrl() {
        var params = parseUrlParams();
        if (params.get('mode') !== 'edit') return;
        var id = resolveBlessingIdFromUrl();
        if (!id) return;

        editingBlessingId = id;
        editPageType = resolveEditPageType();
        editModeActive = true;
        applyEditModeChrome();
        bindUserClearListeners();
        await loadBlessingIntoForm(id);
    }

    window.hbEditMode = {
        initFromUrl: initFromUrl,
        isEditMode: isEditMode,
        getEditingBlessingId: getEditingBlessingId,
        loadBlessingIntoForm: loadBlessingIntoForm,
        applyEditModeChrome: applyEditModeChrome,
        updateBlessing: updateBlessing
    };
})();
