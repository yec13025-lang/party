// 生成结果大弹窗：链接复制 + 二维码预览 + 全屏查看
(function () {
    const opts = window.HB_RESULT_MODAL_OPTIONS || {};
    let modalEl = null;
    let fullscreenEl = null;
    /** 全屏贺卡大图时临时隐藏的制作页标题条（粉色彩带）、顶栏，以及浏览器标签标题 */
    let fullscreenHiddenBannerEl = null;
    let fullscreenBannerPrevDisplay = '';
    let fullscreenHiddenHeaderEl = null;
    let fullscreenHeaderPrevDisplay = '';
    let fullscreenPrevDocumentTitle = '';
    let fullscreenDidOverrideTitle = false;
    let historyFabEl = null;
    let historyPanelEl = null;
    let historyTransitioning = false;
    const HISTORY_KEY_BASE = opts.historyKey || 'hb_result_history_v1';
    const HISTORY_LIMIT = opts.historyLimit || 20;
    const historyEnabled = window.HB_DISABLE_MY_WORKS !== true;

    function getHistoryStorageKey() {
        if (typeof opts.getHistoryScopeId === 'function') {
            var scope = opts.getHistoryScopeId();
            if (!scope) {
                return null;
            }
            return HISTORY_KEY_BASE + '_' + scope;
        }
        return HISTORY_KEY_BASE;
    }

    function isLowPerfOverlay() {
        const ua = navigator.userAgent || '';
        const ios = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform));
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        return ios || coarse;
    }

    function getModalOverlayBaseClass() {
        if (isLowPerfOverlay()) {
            return 'fixed inset-0 bg-black/55 flex items-center justify-center z-[120] p-4 overflow-y-auto';
        }
        return 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 overflow-y-auto';
    }

    function readHistory() {
        try {
            const key = getHistoryStorageKey();
            if (!key) return [];
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(item => item && item.url)
                .map(function (item) {
                    return {
                        url: item.url,
                        ts: item.ts,
                        createdAt: item.createdAt || (item.ts ? new Date(item.ts).toISOString() : ''),
                        updatedAt: item.updatedAt || null,
                        celebrantName: item.celebrantName || '',
                        senderName: item.senderName || ''
                    };
                })
                .sort(function (a, b) {
                    return (Number(b && b.ts) || 0) - (Number(a && a.ts) || 0);
                })
                .slice(0, HISTORY_LIMIT);
        } catch (e) {
            return [];
        }
    }

    function writeHistory(items) {
        try {
            const key = getHistoryStorageKey();
            if (!key) return false;
            localStorage.setItem(key, JSON.stringify((items || []).slice(0, HISTORY_LIMIT)));
            return true;
        } catch (e) {
            console.error('[result-modal] writeHistory failed', e);
            return false;
        }
    }

    function extractBlessingId(url) {
        if (typeof opts.extractId === 'function') {
            return opts.extractId(url) || '';
        }
        try {
            const u = new URL(url, window.location.origin);
            const fromQuery = u.searchParams.get('blessingid');
            if (fromQuery) return fromQuery;
            const parts = u.pathname.split('/').filter(Boolean);
            return parts.length ? parts[parts.length - 1] : '';
        } catch (e) {
            return '';
        }
    }

    /** 在当前页 query 上追加 blessingid、mode=edit，保留 token 等既有参数 */
    function buildEditModeNavigateUrl(blessingId) {
        if (!blessingId) return window.location.pathname + window.location.search;
        var params = new URLSearchParams(window.location.search);
        params.set('blessingid', blessingId);
        params.set('mode', 'edit');
        var qs = params.toString();
        return window.location.pathname + (qs ? '?' + qs : '');
    }

    async function enrichHistoryItem(item) {
        if (!item || !item.url) return item;
        if (item.celebrantName && item.senderName) return item;
        const blessingId = extractBlessingId(item.url);
        if (!blessingId) return item;
        try {
            const apiUrl = typeof opts.enrichApi === 'function'
                ? opts.enrichApi(blessingId)
                : ('/api/birthdayreport/' + encodeURIComponent(blessingId));
            const resp = await fetch(apiUrl, { method: 'GET' });
            const data = await resp.json();
            if (resp.ok && data && data.code === 200 && data.data) {
                if (typeof opts.mapEnrich === 'function') {
                    const mapped = opts.mapEnrich(data.data) || {};
                    item.celebrantName = mapped.celebrantName || mapped.toName || item.celebrantName || '';
                    item.senderName = mapped.senderName || mapped.fromName || item.senderName || '';
                } else {
                    item.celebrantName = data.data.userName || '';
                    item.senderName = data.data.sender || '';
                }
                if (!item.birthday && data.data.birthday) {
                    item.birthday = data.data.birthday;
                }
            }
        } catch (e) {
        }
        return item;
    }

    async function saveHistory(url, meta) {
        if (!historyEnabled) return;
        if (!url) return;
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const allItems = readHistory();
        const existing = allItems.find(item => item.url === url);
        const old = allItems.filter(item => item.url !== url);
        const current = {
            url: url,
            ts: now,
            createdAt: (existing && existing.createdAt) || nowIso,
            updatedAt: (existing && existing.updatedAt) || null,
            celebrantName: (meta && meta.celebrantName) || (existing && existing.celebrantName) || '',
            senderName: (meta && meta.senderName) || (existing && existing.senderName) || '',
            birthday: (meta && meta.birthday) || (existing && existing.birthday) || ''
        };
        if (!current.celebrantName || !current.senderName) {
            await enrichHistoryItem(current);
        }
        old.unshift(current);
        writeHistory(old);
        await renderHistoryPanel();
    }

    function updateHistoryItem(url, patch) {
        if (!historyEnabled || !url) return false;
        const items = readHistory();
        let found = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].url === url) {
                if (patch.updatedAt) {
                    items[i].updatedAt = patch.updatedAt;
                    items[i].ts = Date.parse(patch.updatedAt) || items[i].ts;
                }
                if (patch.celebrantName) items[i].celebrantName = patch.celebrantName;
                if (patch.senderName) items[i].senderName = patch.senderName;
                if (patch.birthday) items[i].birthday = patch.birthday;
                if (!items[i].createdAt && items[i].ts) {
                    items[i].createdAt = new Date(items[i].ts).toISOString();
                }
                found = true;
                break;
            }
        }
        if (found) {
            writeHistory(items);
            renderHistoryPanel();
        }
        return found;
    }

    function updateHistoryPanelPosition() {
        if (!historyPanelEl) return;
        historyPanelEl.style.left = '1.5rem';
        historyPanelEl.style.right = 'auto';
        historyPanelEl.style.width = 'min(90vw, 24rem)';
        historyPanelEl.style.maxWidth = '24rem';
        var fab = historyFabEl || document.getElementById('myWorksFab');
        if (fab) {
            var rect = fab.getBoundingClientRect();
            var gap = 10;
            historyPanelEl.style.bottom = (window.innerHeight - rect.top + gap) + 'px';
            return;
        }
        historyPanelEl.style.bottom = '5rem';
    }

    function bumpToastZIndex() {
        const toastEl = document.getElementById('customToast');
        if (toastEl) {
            toastEl.style.zIndex = '160';
        }
    }

    function updateFabPositionAvoidDraft() {
        if (!historyFabEl) return;
        const draftBtn = document.getElementById('draft-box-button');
        if (draftBtn) {
            historyFabEl.style.left = '0.5rem';
            historyFabEl.style.bottom = '4.5rem';
        } else {
            historyFabEl.style.left = '0.5rem';
            historyFabEl.style.bottom = '1.5rem';
        }
    }

    function ensureModal() {
        if (modalEl) return modalEl;
        modalEl = document.createElement('div');
        modalEl.id = 'resultModal';
        modalEl.className = getModalOverlayBaseClass() + ' hidden';
        const posterTitle = opts.posterSectionTitle || '贺卡图片，请长按图片或点击图片截图保存';
        const linkTitle = opts.linkSectionTitle || '生日祝福链接，请复制保存';
        modalEl.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 md:p-7 max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain my-auto">
                <div class="flex items-center justify-end mb-3 shrink-0">
                    <button type="button" id="resultModalCloseBtn" class="text-gray-500 hover:text-gray-700 text-xl"><i class="fa fa-times"></i></button>
                </div>
                <div class="space-y-4 result-box">
                    <div class="text-base font-semibold text-headline text-center pt-2">${posterTitle}</div>
                    <div id="resultModalBirthdaySection" class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center hidden">
                        <p class="text-sm text-amber-800 font-medium">
                            🔑 生日密码：<span id="resultModalBirthdayValue" class="font-bold">----</span>
                        </p>
                        <p class="text-xs text-amber-600 mt-0.5">接收人需输入此密码查看贺卡</p>
                    </div>
                    <div class="flex justify-center">
                        <img id="resultModalQrImage" alt="贺卡图片" class="w-full max-w-[340px] h-auto rounded-lg shadow-md cursor-zoom-in object-contain bg-white border border-gray-100 p-0">
                    </div>
                    <div class="text-base font-semibold text-headline text-center">${linkTitle}</div>
                    <div class="result-link p-4 bg-gradient-to-r from-primary/5 to-white border border-primary/20 rounded-xl word-break break-all">
                        <input id="resultModalLinkInput" type="text" readonly class="w-full bg-transparent outline-none text-sm text-gray-700 break-all">
                    </div>
                    <button type="button" id="resultModalCopyBtn" class="copy-btn w-full bg-links hover:bg-links/90 text-white font-medium py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-links/30">✨ 复制链接 ✨</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        const closeBtn = document.getElementById('resultModalCloseBtn');
        closeBtn.addEventListener('click', closeResultModal);
        modalEl.addEventListener('click', function (e) {
            if (e.target === modalEl) {
                closeResultModal();
            }
        });
        document.getElementById('resultModalCopyBtn').addEventListener('click', copyResultLink);
        document.getElementById('resultModalQrImage').addEventListener('click', openFullscreenQr);
        return modalEl;
    }

    function ensureHistoryUI() {
        if (!historyEnabled) return;
        if (!historyFabEl) {
            historyFabEl = document.createElement('button');
            historyFabEl.type = 'button';
            historyFabEl.id = 'myWorksFab';
            historyFabEl.className = 'fixed px-3 py-1.5 z-[90] bg-links/80 hover:bg-links text-white rounded-lg shadow-lg flex items-center justify-center text-xs cursor-pointer transition-all transform hover:scale-105';
            historyFabEl.innerHTML = '<span>我的制作</span>';
            historyFabEl.title = '我的制作';
            historyFabEl.setAttribute('aria-label', '我的制作');
            historyFabEl.addEventListener('click', function () {
                if (historyTransitioning) return;
                const panel = ensureHistoryPanel();
                const isOpen = panel.classList.contains('opacity-100');
                if (isOpen) {
                    closeHistoryPanel();
                } else {
                    openHistoryPanel();
                }
                renderHistoryPanel();
            });
            document.body.appendChild(historyFabEl);
        }
        updateFabPositionAvoidDraft();
        setTimeout(updateFabPositionAvoidDraft, 300);
        setTimeout(updateHistoryPanelPosition, 320);
        ensureHistoryPanel();
    }

    function ensureHistoryPanel() {
        if (!historyEnabled) return null;
        if (historyPanelEl) return historyPanelEl;
        historyPanelEl = document.createElement('div');
        historyPanelEl.id = 'myWorksPanel';
        historyPanelEl.className = 'fixed bg-white rounded-xl shadow-2xl p-4 max-w-sm w-[90%] z-[91] transform -translate-y-full opacity-0 transition-all duration-300 pointer-events-none';
        historyPanelEl.innerHTML = `
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <div class="font-semibold text-headline">我的制作</div>
                <button type="button" id="myWorksCloseBtn" class="text-gray-400 hover:text-gray-700"><i class="fa fa-times"></i></button>
            </div>
            <p id="myWorksScopeHint" class="text-xs text-gray-500 mt-3 mb-3">📌 已生成的祝福卡记录，可快速重新打开链接和二维码</p>
            <div id="myWorksList" class="max-h-60 overflow-y-auto mb-4"></div>
        `;
        document.body.appendChild(historyPanelEl);
        updateHistoryPanelPosition();
        historyPanelEl.querySelector('#myWorksCloseBtn').addEventListener('click', function () {
            closeHistoryPanel();
        });
        document.addEventListener('click', function (e) {
            if (!historyPanelEl || !historyPanelEl.classList.contains('opacity-100')) return;
            const inPanel = historyPanelEl.contains(e.target);
            const onFab = historyFabEl && historyFabEl.contains(e.target);
            if (!inPanel && !onFab) {
                closeHistoryPanel();
            }
        });
        // 与草稿箱联动：点击草稿箱按钮时，先收起“我的制作”面板，避免两个面板同时展开
        document.addEventListener('click', function (e) {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            if (target.closest('#draft-box-button')) {
                closeHistoryPanel();
            }
        }, true);
        return historyPanelEl;
    }

    function getHistoryItemTitle(item) {
        if (typeof opts.historyItemTitle === 'function') {
            return opts.historyItemTitle(item);
        }
        const celebrant = item.celebrantName || '寿星';
        return '送给' + celebrant + '的生日贺卡';
    }

    function openHistoryPanel() {
        const panel = ensureHistoryPanel();
        if (window.createDraftBox && typeof window.createDraftBox.closeDraftBox === 'function') {
            window.createDraftBox.closeDraftBox();
        }
        updateHistoryPanelPosition();
        historyTransitioning = true;
        panel.classList.remove('opacity-0', '-translate-y-full', 'pointer-events-none');
        panel.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
        setTimeout(function () { historyTransitioning = false; }, 320);
    }

    function closeHistoryPanel() {
        const panel = ensureHistoryPanel();
        historyTransitioning = true;
        panel.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
        panel.classList.add('opacity-0', '-translate-y-full', 'pointer-events-none');
        setTimeout(function () { historyTransitioning = false; }, 320);
    }

    async function renderHistoryPanel() {
        if (!historyEnabled) return;
        const panel = ensureHistoryPanel();
        if (!panel) return;
        const listEl = panel.querySelector('#myWorksList');
        const items = readHistory();
        let changed = false;
        for (let i = 0; i < items.length; i++) {
            const beforeName = (items[i].celebrantName || '') + '|' + (items[i].senderName || '');
            await enrichHistoryItem(items[i]);
            const afterName = (items[i].celebrantName || '') + '|' + (items[i].senderName || '');
            if (beforeName !== afterName) changed = true;
        }
        if (changed) {
            writeHistory(items);
        }
        if (!items.length) {
            listEl.innerHTML = '<div class="text-sm text-gray-500 text-center py-6">暂无记录</div>';
            return;
        }
        listEl.innerHTML = items.map(function (item) {
            const createdText = item.createdAt
                ? new Date(item.createdAt).toLocaleString()
                : new Date(item.ts || Date.now()).toLocaleString();
            const updatedText = item.updatedAt
                ? new Date(item.updatedAt).toLocaleString()
                : '';
            const title = getHistoryItemTitle(item);
            const blessingId = extractBlessingId(item.url);
            const timeLines = updatedText
                ? '创建：' + createdText + '<br>更新：' + updatedText
                : '创建：' + createdText;
            var birthdayHtml = (item.birthday && item.birthday.length === 4)
                ? '<span class="text-xs text-amber-700 ml-1">🔑 ' + item.birthday.slice(0,2) + '/' + item.birthday.slice(2) + '</span>'
                : '';
            return `
                <div class="bg-gray-50 p-3 rounded-lg mb-2">
                    <div class="flex justify-between items-start">
                        <div style="min-width: 0; flex: 1;">
                            <h4 class="font-medium text-headline" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title} ${birthdayHtml}</h4>
                            <p class="text-xs text-gray-500 mt-1">${timeLines}</p>
                        </div>
                        <div class="flex space-x-2" style="flex-shrink: 0; margin-left: 0.5rem;">
                            <button type="button" class="my-work-open text-xs bg-primary text-white py-1 px-3 rounded-full hover:bg-primary/90 transition-colors" data-url="${encodeURIComponent(item.url)}">查看</button>
                            <button type="button" class="my-work-edit text-xs bg-red-100 text-red-700 py-1 px-3 rounded-full hover:bg-red-200 transition-colors" data-blessing-id="${encodeURIComponent(blessingId)}">修改</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        Array.from(listEl.querySelectorAll('.my-work-open')).forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const url = decodeURIComponent(btn.dataset.url || '');
                if (!url) return;
                await showResultModal(url, false);
                closeHistoryPanel();
            });
        });
        Array.from(listEl.querySelectorAll('.my-work-edit')).forEach(function (btn) {
            btn.addEventListener('click', function () {
                const id = decodeURIComponent(btn.dataset.blessingId || '');
                if (!id) return;
                closeHistoryPanel();
                window.location.assign(buildEditModeNavigateUrl(id));
            });
        });
    }

    function findMakerPageTitleBanner() {
        return document.querySelector('main .rounded-3xl.shadow-xl > .bg-links.text-white');
    }

    function restoreFullscreenPageChrome() {
        if (fullscreenHiddenBannerEl) {
            fullscreenHiddenBannerEl.style.display = fullscreenBannerPrevDisplay;
            fullscreenHiddenBannerEl = null;
            fullscreenBannerPrevDisplay = '';
        }
        if (fullscreenHiddenHeaderEl) {
            fullscreenHiddenHeaderEl.style.display = fullscreenHeaderPrevDisplay;
            fullscreenHiddenHeaderEl = null;
            fullscreenHeaderPrevDisplay = '';
        }
        if (fullscreenDidOverrideTitle) {
            document.title = fullscreenPrevDocumentTitle;
            fullscreenDidOverrideTitle = false;
            fullscreenPrevDocumentTitle = '';
        }
    }

    function resolveFullscreenTitle() {
        if (typeof opts.getFullscreenTitle === 'function') {
            var custom = opts.getFullscreenTitle();
            if (custom) {
                return String(custom).trim();
            }
        }
        if (opts.fullscreenTitle) {
            return String(opts.fullscreenTitle).trim();
        }
        return '生日快乐';
    }

    function applyFullscreenPageChrome() {
        restoreFullscreenPageChrome();

        const banner = findMakerPageTitleBanner();
        if (banner) {
            fullscreenHiddenBannerEl = banner;
            fullscreenBannerPrevDisplay = banner.style.display;
            banner.style.display = 'none';
        }

        const header = document.getElementById('header');
        if (header) {
            fullscreenHiddenHeaderEl = header;
            fullscreenHeaderPrevDisplay = header.style.display;
            header.style.display = 'none';
        }

        fullscreenPrevDocumentTitle = document.title;
        fullscreenDidOverrideTitle = true;
        document.title = resolveFullscreenTitle();
    }

    function ensureFullscreen() {
        if (fullscreenEl) return fullscreenEl;
        fullscreenEl = document.createElement('div');
        fullscreenEl.id = 'qrFullscreenViewer';
        fullscreenEl.className = 'fixed inset-0 bg-white hidden items-center justify-center z-[130] p-4';
        fullscreenEl.innerHTML = `
            <img id="qrFullscreenImage" alt="贺卡大图预览" class="max-w-[95vw] max-h-[95vh] object-contain cursor-pointer touch-manipulation">
        `;
        document.body.appendChild(fullscreenEl);
        fullscreenEl.addEventListener('click', function (e) {
            if (e.target === fullscreenEl) {
                closeFullscreenQr();
            }
        });
        document.getElementById('qrFullscreenImage').addEventListener('click', function (e) {
            e.stopPropagation();
            closeFullscreenQr();
        });
        return fullscreenEl;
    }

    function closeResultModal() {
        const modal = ensureModal();
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (opts.showCloseToast === false) {
            return;
        }
        if (typeof window.showToast === 'function') {
            bumpToastZIndex();
            showToast({
                title: '提示',
                message: opts.closeToastMessage || '点击左下角「我的制作」，也可以查看祝福链接和二维码~'
            }, 'info', 2200);
            setTimeout(bumpToastZIndex, 0);
        }
    }

    function openFullscreenQr() {
        const qrImg = document.getElementById('resultModalQrImage');
        if (!qrImg || !qrImg.src) return;
        applyFullscreenPageChrome();
        const fullscreen = ensureFullscreen();
        const fullscreenImg = document.getElementById('qrFullscreenImage');
        fullscreenImg.src = qrImg.src;
        fullscreen.classList.remove('hidden');
        fullscreen.classList.add('flex');
    }

    function closeFullscreenQr() {
        const fullscreen = ensureFullscreen();
        fullscreen.classList.add('hidden');
        fullscreen.classList.remove('flex');
        restoreFullscreenPageChrome();
    }

    async function copyResultLink() {
        const input = document.getElementById('resultModalLinkInput');
        if (!input) return;
        const text = input.value;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                input.select();
                document.execCommand('copy');
            }
            if (window.showToast) {
                bumpToastZIndex();
                showToast({ title: '复制成功', message: '链接已复制到剪贴板' }, 'success', 1500);
                setTimeout(bumpToastZIndex, 0);
            }
        } catch (error) {
            if (window.showToast) {
                bumpToastZIndex();
                showToast({ title: '复制失败', message: '请手动复制链接' }, 'error', 2000);
                setTimeout(bumpToastZIndex, 0);
            }
        }
    }

    async function buildPosterDataUrl(url) {
        if (!url || typeof window.createPosterMobile !== 'function') return '';
        const blessingId = extractBlessingId(url);
        let sender = 'Ta';
        let userName = '亲爱的朋友';
        let themeColor = 'pink';
        if (blessingId) {
            try {
                const resp = await fetch('/api/birthdayreport/' + encodeURIComponent(blessingId), { method: 'GET' });
                const data = await resp.json();
                if (resp.ok && data && data.code === 200 && data.data) {
                    sender = data.data.sender || sender;
                    userName = data.data.userName || userName;
                    themeColor = data.data.themeColor || themeColor;
                }
            } catch (e) {
            }
        }
        const posterDataUrl = await window.createPosterMobile(url, sender, userName, themeColor, false);
        return posterDataUrl || window.__posterDataUrl || '';
    }

    async function resolvePosterDataUrl(url) {
        if (typeof opts.rebuildPoster === 'function') {
            try {
                var rebuilt = await opts.rebuildPoster(url);
                if (rebuilt) return rebuilt;
            } catch (e) {
            }
        }
        return await buildPosterDataUrl(url);
    }

    async function showResultModal(url, autoSave, posterDataUrl, meta) {
        const modal = ensureModal();
        if (historyEnabled) {
            ensureHistoryUI();
        }
        const linkInput = document.getElementById('resultModalLinkInput');
        const qrImg = document.getElementById('resultModalQrImage');
        linkInput.value = url || '';
        let finalPosterDataUrl = posterDataUrl || '';
        if (!finalPosterDataUrl) {
            finalPosterDataUrl = await resolvePosterDataUrl(url);
        }
        if (!finalPosterDataUrl) {
            if (window.showToast) {
                bumpToastZIndex();
                showToast({ title: '生成失败', message: '贺卡图片生成失败，请重试' }, 'warning', 2400);
                setTimeout(bumpToastZIndex, 0);
            }
            return;
        }
        qrImg.src = finalPosterDataUrl;

        if (autoSave !== false) {
            await saveHistory(url, meta);
        }
        var birthdaySection = document.getElementById('resultModalBirthdaySection');
        var birthdaySpan = document.getElementById('resultModalBirthdayValue');
        var birthdayVal = (meta && meta.birthday) || '';
        if (!birthdayVal && historyEnabled) {
            var historyItems = readHistory();
            var found = historyItems.find(function (h) { return h.url === url; });
            if (found && found.birthday) {
                birthdayVal = found.birthday;
            }
        }
        if (!birthdayVal && url) {
            var blessingId = extractBlessingId(url);
            if (blessingId) {
                try {
                    fetch('/api/birthdayreport/' + encodeURIComponent(blessingId), { method: 'GET' })
                        .then(function (r) { return r.json(); })
                        .then(function (d) {
                            if (d && d.code === 200 && d.data && d.data.birthday) {
                                birthdayVal = d.data.birthday;
                                if (birthdaySpan) birthdaySpan.textContent = birthdayVal;
                                if (birthdaySection) birthdaySection.classList.remove('hidden');
                            }
                        }).catch(function () {});
                } catch (e) {}
            }
        }
        if (birthdayVal && birthdaySection && birthdaySpan) {
            birthdaySpan.textContent = birthdayVal;
            birthdaySection.classList.remove('hidden');
        } else if (birthdaySection) {
            birthdaySection.classList.add('hidden');
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    window.hbResultModal = {
        showResultModal,
        closeResultModal,
        updateHistoryPanelPosition,
        renderHistoryPanel,
        updateHistoryItem
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            if (historyEnabled) {
                ensureHistoryUI();
                renderHistoryPanel();
            }
        });
    } else {
        if (historyEnabled) {
            ensureHistoryUI();
            renderHistoryPanel();
        }
    }
})();

