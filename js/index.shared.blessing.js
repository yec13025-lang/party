// 祝福语共享逻辑：按配置的排序权重依次轮换（与默认图片/背景音乐一致），非纯随机
(function () {
    let isLoading = false;
    const ROUND_ROBIN_KEY = 'hbBlessingMessageRoundRobin';

    let cachedItems = null;
    let loadPromise = null;

    function getEls() {
        return {
            blessingMessage: document.getElementById('blessingMessage'),
            randomBtn: document.getElementById('randomBlessingBtn'),
            clearBtn: document.getElementById('clearBlessingBtn')
        };
    }

    function getRelationshipParam() {
        const el = document.getElementById('blessingRelationship');
        if (el && el.value && String(el.value).trim()) {
            return encodeURIComponent(String(el.value).trim());
        }
        return '';
    }

    function loadEnabledBlessings() {
        if (cachedItems) {
            return Promise.resolve(cachedItems);
        }
        if (loadPromise) {
            return loadPromise;
        }
        const rel = getRelationshipParam();
        const url = '/api/blessingmessage/enabled' + (rel ? ('?relationship=' + rel) : '');
        loadPromise = fetch(url, { method: 'GET' })
            .then(function (response) {
                return response.json().then(function (payload) {
                    return { ok: response.ok, payload: payload };
                });
            })
            .then(function (_ref) {
                const payload = _ref.payload;
                if (!_ref.ok || payload.code !== 200 || !payload.data || !payload.data.length) {
                    throw new Error((payload && payload.msg) || '获取祝福语失败，请稍后重试');
                }
                cachedItems = payload.data;
                return cachedItems;
            })
            .catch(function (err) {
                loadPromise = null;
                throw err;
            });
        return loadPromise;
    }

    function pickNextMessage(items) {
        let idx = parseInt(sessionStorage.getItem(ROUND_ROBIN_KEY) || '0', 10);
        if (!Number.isFinite(idx) || idx < 0) {
            idx = 0;
        }
        const row = items[idx % items.length];
        sessionStorage.setItem(ROUND_ROBIN_KEY, String(idx + 1));
        return row && row.message ? row.message : '';
    }

    async function requestNextBlessingInOrder() {
        const items = await loadEnabledBlessings();
        const message = pickNextMessage(items);
        if (!message) {
            throw new Error('暂无可用祝福语内容');
        }
        return message;
    }

    async function handleRandomBlessing() {
        const { blessingMessage, randomBtn } = getEls();
        if (!blessingMessage || !randomBtn || isLoading) return;
        isLoading = true;
        randomBtn.disabled = true;
        const iconEl = randomBtn.querySelector('i');
        const oldIconClass = iconEl ? iconEl.className : '';
        if (iconEl) {
            iconEl.className = 'fa fa-spinner fa-spin';
        }

        try {
            const message = await requestNextBlessingInOrder();
            blessingMessage.value = message;
        } catch (error) {
            if (window.showToast) {
                showToast({ title: '获取失败', message: error.message || '请稍后重试' }, 'error', 2600);
            } else {
                alert(error.message || '请稍后重试');
            }
        } finally {
            randomBtn.disabled = false;
            if (iconEl) {
                iconEl.className = oldIconClass || 'fa fa-random';
            }
            isLoading = false;
        }
    }

    function handleClearBlessing() {
        const { blessingMessage } = getEls();
        if (!blessingMessage) return;
        blessingMessage.value = '';
    }

    document.addEventListener('DOMContentLoaded', function () {
        const { blessingMessage, randomBtn, clearBtn } = getEls();
        if (!blessingMessage || !randomBtn) return;
        randomBtn.addEventListener('click', handleRandomBlessing);
        if (clearBtn) {
            clearBtn.addEventListener('click', handleClearBlessing);
        }
        if (!blessingMessage.value.trim()) {
            handleRandomBlessing();
        }
    });
})();
