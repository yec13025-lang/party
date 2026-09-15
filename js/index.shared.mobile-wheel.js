/**
 * mobile-select 滚轮封装（仅作用于触发 input + 浮层，不引入整页框架 CSS）。
 * 依赖：mobile-select@1.4.0（先于本文件加载）。
 */
(function () {
    'use strict';

    function getMobileSelect() {
        try {
            if (typeof window !== 'undefined' && window.MobileSelect) {
                return window.MobileSelect;
            }
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    /** 从 transform 字符串解析 Y（px）；兼容 translate3d / translate / matrix */
    function hbParseTranslateYFromTransform(tr) {
        if (!tr || typeof tr !== 'string') {
            return null;
        }
        var m3 = tr.match(/translate3d\(\s*[^,]+,\s*([^,]+?)\s*,/i);
        if (m3) {
            return parseFloat(m3[1]);
        }
        var m2 = tr.match(/translate\(\s*[^,]+,\s*([^)]+?)\)/i);
        if (m2) {
            return parseFloat(m2[1]);
        }
        var mat = tr.match(/matrix\(\s*([^)]+)\)/i);
        if (mat) {
            var parts = mat[1].split(',');
            if (parts.length >= 6) {
                return parseFloat(parts[parts.length - 1].trim());
            }
        }
        return null;
    }

    /** 用真实 DOM 行高刷新 optionHeight，避免 WebKit 下选中框与文字竖向错位 */
    function syncMsOptionHeight(inst) {
        if (!inst || !inst.mobileSelect) {
            return;
        }
        var li = inst.mobileSelect.querySelector('.ms-select-container li');
        if (!li) {
            return;
        }
        var h = li.getBoundingClientRect().height;
        if (h > 0) {
            inst.optionHeight = Math.round(h * 1000) / 1000;
        }
    }

    /**
     * mobile-select@1.4.0：touchmove 里对 clientY 使用 Math.floor，慢拖时相邻 move 的 Y 常相同，
     * offsetY 恒为 0 导致无法滚动（iOS Safari 尤其明显）。另 updateCurDistance 用 parseInt 解析
     * transform 在部分环境下不稳健。此处打补丁，不改变 touchend 与库的其它逻辑。
     */
    function patchMobileSelectTouchPrecision() {
        var Ctor = getMobileSelect();
        if (!Ctor || !Ctor.prototype || Ctor.prototype._hbMsTouchPrecisionPatch) {
            return;
        }
        Ctor.prototype._hbMsTouchPrecisionPatch = true;
        var origTouch = Ctor.prototype.touch;
        var origUpdateCur = Ctor.prototype.updateCurDistance;

        Ctor.prototype.updateCurDistance = function (ul, col) {
            try {
                var tr = ul && ul.style ? ul.style.transform : '';
                var y = hbParseTranslateYFromTransform(tr);
                if (y !== null && Number.isFinite(y)) {
                    this.curDistance[col] = y;
                    return;
                }
            } catch (eUc) {
                /* fall through */
            }
            return origUpdateCur.apply(this, arguments);
        };

        Ctor.prototype.touch = function (t) {
            var path = t.composedPath && t.composedPath();
            var wheel =
                path &&
                path.find(function (el) {
                    return el && el.classList && el.classList.contains('ms-wheel');
                });
            if (!wheel) {
                return;
            }
            var ul = wheel.firstChild;
            var col = parseInt(wheel.getAttribute('data-index') || '0', 10);
            var type = t.type;

            function applyWheelDelta(deltaY) {
                if (!deltaY) {
                    return;
                }
                var scrollSpeed =
                    this.config && this.config.scrollSpeed != null ? this.config.scrollSpeed : 1;
                ul.style.transition = 'none 0s ease-out';
                this.updateCurDistance(ul, col);
                this.curDistance[col] = this.curDistance[col] + deltaY * scrollSpeed;
                this.movePosition(ul, this.curDistance[col]);
            }

            if (type === 'touchmove' || type === 'mousemove') {
                if (t.cancelable) {
                    t.preventDefault();
                }
                if (type === 'mousemove' && !this.enableClickStatus) {
                    return;
                }
                var self = this;
                var coalescedApplied = false;
                if (type === 'touchmove' && typeof t.getCoalescedEvents === 'function') {
                    var coalesced = t.getCoalescedEvents();
                    if (coalesced && coalesced.length > 0) {
                        var prevY =
                            self._hbCoalescedPrevY != null
                                ? self._hbCoalescedPrevY
                                : coalesced[0].pageY;
                        var anyDelta = false;
                        for (var ci = 0; ci < coalesced.length; ci++) {
                            var cy = coalesced[ci].pageY;
                            var d = cy - prevY;
                            if (d !== 0) {
                                self._hbTouchAcc = (self._hbTouchAcc || 0) + d;
                            }
                            if (Math.abs(self._hbTouchAcc) >= 0.5) {
                                applyWheelDelta.call(self, self._hbTouchAcc);
                                self._hbTouchAcc = 0;
                                anyDelta = true;
                            }
                            prevY = cy;
                        }
                        self._hbCoalescedPrevY = prevY;
                        self.preMoveY = prevY;
                        if (anyDelta) {
                            coalescedApplied = true;
                        }
                    }
                }
                if (!coalescedApplied) {
                    var pageY =
                        t instanceof TouchEvent
                            ? t.touches && t.touches[0]
                                ? t.touches[0].pageY
                                : 0
                            : t.pageY;
                    var rawDelta = pageY - (self.preMoveY != null ? self.preMoveY : pageY);
                    if (type === 'touchmove') {
                        // 慢速精确选择：去掉「中心磁吸」辅助——它让手指停在中线之外时
                        // 滚轮自行漂移（过灵敏），又在靠近中线时把细微位移压成 0.3px
                        // 常量（不灵敏）。改为亚像素累积：抖动被滤掉，真实慢移累到
                        // 0.5px 就施加，滚轮线性跟手、手指停住滚轮就停住。
                        if (rawDelta !== 0) {
                            self._hbTouchAcc = (self._hbTouchAcc || 0) + rawDelta;
                        }
                        if (Math.abs(self._hbTouchAcc) >= 0.5) {
                            applyWheelDelta.call(self, self._hbTouchAcc);
                            self._hbTouchAcc = 0;
                        }
                    } else {
                        applyWheelDelta.call(self, rawDelta);
                    }
                    self.moveY = pageY;
                    self.preMoveY = pageY;
                }
                return;
            }
            if (type === 'touchstart' || type === 'mousedown') {
                ul.style.transition = 'none 0s ease-out';
                var sy =
                    t instanceof TouchEvent
                        ? t.touches && t.touches[0]
                            ? t.touches[0].pageY
                            : 0
                        : t.pageY;
                this.startY = sy;
                this.preMoveY = sy;
                this._hbCoalescedPrevY = sy;
                this._hbTouchAcc = 0;
                if (type === 'mousedown') {
                    this.enableClickStatus = true;
                }
                return;
            }
            if (type === 'touchend' || type === 'touchcancel') {
                this._hbCoalescedPrevY = null;
                this._hbTouchAcc = 0;
            }
            return origTouch.call(this, t);
        };
    }

    patchMobileSelectTouchPrecision();

    /**
     * 库在 .ms-gray-layer 上绑定了 click → hide()。移动端同一次触摸结束后会再派发 click，
     * 若遮罩已显示，click 落在遮罩上会立刻 hide → 「闪一下」。延迟 show + 短暂禁用遮罩点击。
     */
    function armMsGrayLayerIgnoreClicks(ms, durationMs) {
        var msLen = durationMs != null ? durationMs : 520;
        try {
            var gl =
                (ms && ms.grayLayer) ||
                (ms && ms.mobileSelect && ms.mobileSelect.querySelector('.ms-gray-layer'));
            if (!gl) {
                return;
            }
            gl.style.pointerEvents = 'none';
            if (ms._hbGrayLayerArmTimer) {
                clearTimeout(ms._hbGrayLayerArmTimer);
            }
            ms._hbGrayLayerArmTimer = setTimeout(function () {
                gl.style.pointerEvents = '';
                ms._hbGrayLayerArmTimer = null;
            }, msLen);
        } catch (eGl) {
            /* ignore */
        }
    }

    /**
     * 多个 mobile-select 同时 ms-show 会叠层混乱；打开一个前先把其它实例收起来。
     */
    function wireExclusiveShow(ms) {
        if (!ms || typeof ms.show !== 'function') {
            return;
        }
        var rawShow = ms.show.bind(ms);
        ms.show = function () {
            if (window._hbMobileSelectInstances && window._hbMobileSelectInstances.length) {
                for (var i = 0; i < window._hbMobileSelectInstances.length; i++) {
                    var o = window._hbMobileSelectInstances[i];
                    if (o && o !== ms && typeof o.hide === 'function' && o.mobileSelect) {
                        try {
                            o.hide();
                        } catch (eH) {
                            /* ignore */
                        }
                    }
                }
            }
            clearTimeout(ms._hbShowDelayTimer);
            ms._hbShowDelayTimer = setTimeout(function () {
                ms._hbShowDelayTimer = null;
                rawShow();
                armMsGrayLayerIgnoreClicks(ms, 520);
            }, 280);
        };
    }

    /** 取消尚未执行的延迟 show，避免快速点开另一个滚轮时本实例仍 rawShow */
    function wrapMsHideToCancelPendingShow(ms) {
        if (!ms || typeof ms.hide !== 'function' || ms._hbHideWrapped) {
            return;
        }
        ms._hbHideWrapped = true;
        var rawHide = ms.hide.bind(ms);
        ms.hide = function () {
            clearTimeout(ms._hbShowDelayTimer);
            ms._hbShowDelayTimer = null;
            clearTimeout(ms._hbGrayLayerArmTimer);
            ms._hbGrayLayerArmTimer = null;
            clearTimeout(ms._hbWheelSnapTimer);
            ms._hbWheelSnapTimer = null;
            try {
                var glH =
                    ms.grayLayer ||
                    (ms.mobileSelect && ms.mobileSelect.querySelector('.ms-gray-layer'));
                if (glH) {
                    glH.style.pointerEvents = '';
                }
            } catch (eGh) {
                /* ignore */
            }
            hbCancelMobileWheelMomentum(ms);
            rawHide();
        };
    }

    function unregisterMsInstance(ms) {
        var arr = window._hbMobileSelectInstances;
        if (!arr || !ms) {
            return;
        }
        clearTimeout(ms._hbShowDelayTimer);
        ms._hbShowDelayTimer = null;
        clearTimeout(ms._hbGrayLayerArmTimer);
        ms._hbGrayLayerArmTimer = null;
        hbDetachDesktopWheelScroll(ms);
        hbDetachMobileWheelMomentum(ms);
        clearTimeout(ms._hbWheelSnapTimer);
        ms._hbWheelSnapTimer = null;
        try {
            var glU =
                ms.grayLayer ||
                (ms.mobileSelect && ms.mobileSelect.querySelector('.ms-gray-layer'));
            if (glU) {
                glU.style.pointerEvents = '';
            }
        } catch (eGu) {
            /* ignore */
        }
        var idx = arr.indexOf(ms);
        if (idx >= 0) {
            arr.splice(idx, 1);
        }
    }

    function registerMsInstance(ms) {
        if (!ms) {
            return;
        }
        window._hbMobileSelectInstances = window._hbMobileSelectInstances || [];
        window._hbMobileSelectInstances.push(ms);
        wrapMsHideToCancelPendingShow(ms);
        wireExclusiveShow(ms);
        hbAttachDesktopWheelScroll(ms);
        hbAttachMobileWheelMomentum(ms);
    }

    /** PC：鼠标滚轮滚动当前列（translate 与库内 touch 逻辑一致） */
    function hbDetachDesktopWheelScroll(ms) {
        if (ms && typeof ms._hbDesktopWheelOff === 'function') {
            try {
                ms._hbDesktopWheelOff();
            } catch (eOff) {
                /* ignore */
            }
        }
    }

    /** 滚轮停顿时对齐所有列，并触发与拖动一致的回调 */
    function hbSnapMobileSelectWheelsAfterWheel(ms) {
        if (!ms || !ms.sliderList || typeof ms.fixPosition !== 'function') {
            return;
        }
        if (!ms.optionHeight) {
            var li0 = ms.mobileSelect && ms.mobileSelect.querySelector('li');
            ms.optionHeight = li0 ? li0.offsetHeight : 40;
        }
        var oh = ms.optionHeight;
        var k;
        for (k = 0; k < ms.sliderList.length; k++) {
            var u = ms.sliderList[k];
            if (!u) {
                continue;
            }
            ms.updateCurDistance(u, k);
            var lis = u.getElementsByTagName('li');
            var ob = -(lis.length - 3) * oh;
            ms.curDistance[k] = ms.fixPosition(ms.curDistance[k]);
            if (ms.curDistance[k] > 2 * oh) {
                ms.curDistance[k] = 2 * oh;
            }
            if (ms.curDistance[k] < ob) {
                ms.curDistance[k] = ob;
            }
            hbNormalizeTripleColumnIfNeeded(ms, k);
            u.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
            ms.movePosition(u, ms.curDistance[k]);
        }
        var valArr = ms.getCurValue();
        var idxArr = ms.getIndexArr();
        if (typeof ms.config.onTransitionEnd === 'function') {
            ms.config.onTransitionEnd(valArr, idxArr, ms);
        }
        if (typeof ms.config.onChange === 'function') {
            ms.config.onChange(valArr);
        }
        requestAnimationFrame(function () {
            syncWheelRowHighlight(ms);
        });
    }

    /** 单列对齐并触发与 mobile-select touchend 一致的回调（含级联 checkRange） */
    function hbSnapMobileSelectSingleColumn(ms, col) {
        if (!ms || !ms.sliderList || typeof ms.fixPosition !== 'function') {
            return;
        }
        var u = ms.sliderList[col];
        if (!u) {
            return;
        }
        if (!ms.optionHeight) {
            var li0sc = ms.mobileSelect && ms.mobileSelect.querySelector('li');
            ms.optionHeight = li0sc ? li0sc.offsetHeight : 40;
        }
        var oh = ms.optionHeight;
        ms.updateCurDistance(u, col);
        var lis = u.getElementsByTagName('li');
        var ob = -(lis.length - 3) * oh;
        ms.curDistance[col] = ms.fixPosition(ms.curDistance[col]);
        if (ms.curDistance[col] > 2 * oh) {
            ms.curDistance[col] = 2 * oh;
        }
        if (ms.curDistance[col] < ob) {
            ms.curDistance[col] = ob;
        }
        hbNormalizeTripleColumnIfNeeded(ms, col);
        u.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        ms.movePosition(u, ms.curDistance[col]);
        try {
            if (ms.isCascade && typeof ms.checkRange === 'function') {
                ms.checkRange(col, ms.getIndexArr());
            }
        } catch (eCr) {
            /* ignore */
        }
        var valArr = ms.getCurValue();
        var idxArr = ms.getIndexArr();
        if (typeof ms.config.onTransitionEnd === 'function') {
            ms.config.onTransitionEnd(valArr, idxArr, ms);
        }
        if (typeof ms.config.onChange === 'function') {
            ms.config.onChange(valArr);
        }
        requestAnimationFrame(function () {
            syncWheelRowHighlight(ms);
        });
    }

    function hbCancelMobileWheelMomentum(ms) {
        if (!ms || !ms._hbMomRaf) {
            return;
        }
        cancelAnimationFrame(ms._hbMomRaf);
        ms._hbMomRaf = null;
    }

    function hbDetachMobileWheelMomentum(ms) {
        hbCancelMobileWheelMomentum(ms);
        if (ms && ms._hbMomAbort && typeof ms._hbMomAbort.abort === 'function') {
            try {
                ms._hbMomAbort.abort();
            } catch (eAb) {
                /* ignore */
            }
            ms._hbMomAbort = null;
        }
        if (ms) {
            ms._hbMomAttached = false;
        }
    }

    function hbWheelFromPanelEvent(e, panel) {
        var path = e.composedPath && e.composedPath();
        if (!path || !path.length) {
            return null;
        }
        var i;
        for (i = 0; i < path.length; i++) {
            var el = path[i];
            if (
                el &&
                el.classList &&
                el.classList.contains('ms-wheel') &&
                panel &&
                panel.contains(el)
            ) {
                return el;
            }
        }
        return null;
    }

    function hbEstimateTouchVelocityPxPerMs(samples, nowTs) {
        if (!samples || samples.length < 2) {
            return 0;
        }
        var cutoff = nowTs - 100;
        var startIdx = 0;
        var i;
        for (i = 0; i < samples.length; i++) {
            if (samples[i].t >= cutoff) {
                startIdx = i;
                break;
            }
        }
        if (samples.length - startIdx < 2) {
            startIdx = Math.max(0, samples.length - 3);
        }
        var a = samples[samples.length - 1];
        var b = samples[startIdx];
        var dt = a.t - b.t;
        if (dt < 8) {
            return 0;
        }
        return (a.y - b.y) / dt;
    }

    /**
     * 移动端快速甩动：touchend 后按速度惯性滑动，阻力指数衰减，再对齐刻度。
     * 通过 capture + stopImmediatePropagation 跳过库内「立即 fixPosition」逻辑。
     */
    function hbAttachMobileWheelMomentum(ms) {
        if (
            !ms ||
            !ms.panel ||
            ms._hbMomAttached ||
            typeof ms.updateCurDistance !== 'function' ||
            typeof ms.fixPosition !== 'function' ||
            typeof ms.movePosition !== 'function'
        ) {
            return;
        }
        if (typeof AbortController === 'undefined') {
            return;
        }
        ms._hbMomAttached = true;
        var ac = new AbortController();
        ms._hbMomAbort = ac;
        var sig = ac.signal;
        var samples = [];
        var MAX_SAMPLES = 10;
        var activeWheelEl = null;
        /* 快速甩动手感：MIN_VEL 以下不触发惯性（慢拖松手直接对齐）；
           MAX_VEL 封顶避免超甩飞过头；DECEL 决定滑行距离与时长。 */
        var MIN_VEL = 0.36;
        var MAX_VEL = 2.0;
        var VEL_STOP = 0.06;
        var DECEL_PER_MS = 0.005;

        function pushSample(y, t) {
            samples.push({ y: y, t: t });
            while (samples.length > MAX_SAMPLES) {
                samples.shift();
            }
        }

        function stopMomentumAnim() {
            hbCancelMobileWheelMomentum(ms);
        }

        function onTouchStart() {
            stopMomentumAnim();
            samples.length = 0;
            activeWheelEl = null;
        }

        function onTouchMove(e) {
            var w = hbWheelFromPanelEvent(e, ms.panel);
            if (w) {
                activeWheelEl = w;
            }
            if (!w || !e.touches || !e.touches[0]) {
                return;
            }
            pushSample(e.touches[0].clientY, e.timeStamp || Date.now());
        }

        function onTouchEnd(e) {
            var w = hbWheelFromPanelEvent(e, ms.panel) || activeWheelEl;
            activeWheelEl = null;
            if (!w || !ms.mobileSelect || !ms.mobileSelect.classList.contains('ms-show')) {
                samples.length = 0;
                return;
            }
            var touch = e.changedTouches && e.changedTouches[0];
            if (!touch) {
                samples.length = 0;
                return;
            }
            pushSample(touch.clientY, e.timeStamp || Date.now());
            var nowTs = e.timeStamp || Date.now();
            var vFinger = hbEstimateTouchVelocityPxPerMs(samples, nowTs);
            samples.length = 0;
            var scrollSpeed =
                ms.config && ms.config.scrollSpeed != null ? ms.config.scrollSpeed : 1;
            var vel = vFinger * scrollSpeed;
            if (!Number.isFinite(vel) || Math.abs(vel) < MIN_VEL) {
                return;
            }
            if (Math.abs(vel) > MAX_VEL) {
                vel = (vel > 0 ? 1 : -1) * MAX_VEL;
            }
            e.stopImmediatePropagation();
            if (e.cancelable) {
                e.preventDefault();
            }

            var col = parseInt(w.getAttribute('data-index') || '0', 10);
            var ul = w.firstChild;
            if (!ul) {
                return;
            }
            if (!ms.optionHeight) {
                var li0m = ms.mobileSelect.querySelector('li');
                ms.optionHeight = li0m ? li0m.offsetHeight : 40;
            }
            var oh = ms.optionHeight;
            ms.updateCurDistance(ul, col);
            var lis = ul.getElementsByTagName('li');
            var baseLenTriple = hbTripleBaseLenFromWheelUl(ul);

            var lastTs = typeof performance !== 'undefined' ? performance.now() : Date.now();

            function tick(timeNow) {
                if (!ms.mobileSelect || !ms.mobileSelect.classList.contains('ms-show')) {
                    ms._hbMomRaf = null;
                    return;
                }
                var dt = timeNow - lastTs;
                lastTs = timeNow;
                if (dt > 40) {
                    dt = 40;
                }
                if (dt < 0) {
                    dt = 0;
                }

                ms.updateCurDistance(ul, col);
                lis = ul.getElementsByTagName('li');
                var oversizeBorder = -(lis.length - 3) * oh;
                baseLenTriple = hbTripleBaseLenFromWheelUl(ul);
                var nextDist = ms.curDistance[col] + vel * dt;
                var hitHigh = nextDist > 2 * oh;
                var hitLow = nextDist < oversizeBorder;
                if (baseLenTriple && (hitHigh || hitLow)) {
                    ms.curDistance[col] = hitHigh ? 2 * oh : oversizeBorder;
                    ul.style.transition = 'none';
                    ms.movePosition(ul, ms.curDistance[col]);
                    normalizeTripleWheel(ms, col, baseLenTriple);
                    ms.updateCurDistance(ul, col);
                    var carry = hitHigh ? nextDist - 2 * oh : nextDist - oversizeBorder;
                    ms.curDistance[col] += carry;
                    ms.curDistance[col] = Math.max(oversizeBorder, Math.min(2 * oh, ms.curDistance[col]));
                    vel *= 0.9;
                } else {
                    var clamped = Math.max(oversizeBorder, Math.min(2 * oh, nextDist));
                    if (clamped !== nextDist) {
                        vel = 0;
                    }
                    ms.curDistance[col] = clamped;
                }
                ul.style.transition = 'none';
                ms.movePosition(ul, ms.curDistance[col]);
                syncWheelRowHighlight(ms);

                vel *= Math.exp(-DECEL_PER_MS * dt);
                if (Math.abs(vel) < VEL_STOP) {
                    ms._hbMomRaf = null;
                    hbSnapMobileSelectSingleColumn(ms, col);
                    return;
                }
                ms._hbMomRaf = requestAnimationFrame(tick);
            }

            ms._hbMomRaf = requestAnimationFrame(tick);
        }

        function onTouchCancel() {
            samples.length = 0;
            activeWheelEl = null;
            stopMomentumAnim();
        }

        ms.panel.addEventListener('touchstart', onTouchStart, {
            capture: true,
            passive: true,
            signal: sig
        });
        ms.panel.addEventListener('touchmove', onTouchMove, {
            capture: true,
            passive: true,
            signal: sig
        });
        ms.panel.addEventListener('touchend', onTouchEnd, {
            capture: true,
            passive: false,
            signal: sig
        });
        ms.panel.addEventListener('touchcancel', onTouchCancel, {
            capture: true,
            passive: true,
            signal: sig
        });
    }

    function hbAttachDesktopWheelScroll(ms) {
        if (
            !ms ||
            !ms.panel ||
            ms._hbDesktopWheelAttached ||
            typeof ms.updateCurDistance !== 'function' ||
            typeof ms.fixPosition !== 'function' ||
            typeof ms.movePosition !== 'function'
        ) {
            return;
        }
        ms._hbDesktopWheelAttached = true;
        var WHEEL_SNAP_IDLE_MS = 165;
        var onWheel = function (e) {
            try {
                if (!ms.mobileSelect || !ms.mobileSelect.classList.contains('ms-show')) {
                    return;
                }
                var wheelEl =
                    e.target &&
                    typeof e.target.closest === 'function' &&
                    e.target.closest('.ms-wheel');
                if (!wheelEl || !ms.panel.contains(wheelEl)) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                var col = parseInt(wheelEl.getAttribute('data-index') || '0', 10);
                var ul = wheelEl.firstChild;
                if (!ul) {
                    return;
                }
                if (!ms.optionHeight) {
                    var li0 = ms.mobileSelect.querySelector('li');
                    ms.optionHeight = li0 ? li0.offsetHeight : 40;
                }
                var oh = ms.optionHeight;
                ms.updateCurDistance(ul, col);
                var dy = e.deltaY;
                if (e.deltaMode === 1) {
                    dy *= oh;
                } else if (e.deltaMode === 2) {
                    dy *= oh * 4;
                } else {
                    dy = (dy * oh) / 100;
                }
                ms.curDistance[col] -= dy;
                var lis = ul.getElementsByTagName('li');
                var oversizeBorder = -(lis.length - 3) * oh;
                /* 滚动中只做边界夹取、不对齐刻度，数字会连续滑动 */
                ms.curDistance[col] = Math.max(oversizeBorder, Math.min(2 * oh, ms.curDistance[col]));
                ul.style.transition = 'transform 0.14s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                ms.movePosition(ul, ms.curDistance[col]);
                requestAnimationFrame(function () {
                    syncWheelRowHighlight(ms);
                });
                clearTimeout(ms._hbWheelSnapTimer);
                ms._hbWheelSnapTimer = setTimeout(function () {
                    ms._hbWheelSnapTimer = null;
                    hbSnapMobileSelectWheelsAfterWheel(ms);
                }, WHEEL_SNAP_IDLE_MS);
            } catch (errWh) {
                /* ignore */
            }
        };
        ms.panel.addEventListener('wheel', onWheel, { passive: false, capture: true });
        ms._hbDesktopWheelOff = function () {
            clearTimeout(ms._hbWheelSnapTimer);
            ms._hbWheelSnapTimer = null;
            try {
                if (ms.panel) {
                    ms.panel.removeEventListener('wheel', onWheel, { capture: true });
                }
            } catch (eR) {
                /* ignore */
            }
            ms._hbDesktopWheelAttached = false;
            ms._hbDesktopWheelOff = null;
        };
    }

    function msPanelIsOpen(inst) {
        try {
            return !!(
                inst &&
                inst.mobileSelect &&
                inst.mobileSelect.classList &&
                inst.mobileSelect.classList.contains('ms-show')
            );
        } catch (eOpen) {
            return false;
        }
    }

    /**
     * 在输入框上方叠透明 button：仅在「点击」时 show（pointerup/touchend 判定），
     * pointerdown 不拦截、不 preventDefault，避免手指滑页面经过控件就弹出。
     * 键盘用户仍可通过 Tab 聚焦 input，由 focus 打开。
     */
    function ensureWheelTapProxy(inputEl, ms) {
        if (!inputEl || !ms || typeof ms.show !== 'function' || !inputEl.parentElement) {
            return;
        }
        var wrap = inputEl.closest('.hb-wheel-input-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'hb-wheel-input-wrap';
            wrap.style.cssText = 'position:relative;width:100%;max-width:100%;display:block;';
            var parent = inputEl.parentElement;
            parent.insertBefore(wrap, inputEl);
            wrap.appendChild(inputEl);
        }
        try {
            var cs = getComputedStyle(inputEl);
            var br = cs.borderRadius;
            if (br && br !== '0px') {
                wrap.style.borderRadius = br;
            }
        } catch (eBr) {
            /* ignore */
        }

        var proxyId = 'hbWheelProxy_' + (inputEl.id || 'field');
        var btn = document.getElementById(proxyId);
        if (!btn || btn.parentElement !== wrap) {
            if (btn && btn.parentElement) {
                btn.parentElement.removeChild(btn);
            }
            btn = document.createElement('button');
            btn.type = 'button';
            btn.id = proxyId;
            btn.className = 'hb-wheel-tap-proxy';
            btn.tabIndex = -1;
            btn.setAttribute(
                'aria-label',
                inputEl.getAttribute('aria-label') ||
                    (inputEl.id === 'birthday' ? '打开生日选择' : '打开日期时间选择')
            );
            btn.style.cssText =
                'position:absolute;left:0;top:0;right:0;bottom:0;width:100%;min-height:48px;height:100%;margin:0;padding:0;border:0;background:transparent;opacity:0;z-index:4;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:pan-x pan-y;box-sizing:border-box;';
            try {
                btn.style.borderRadius = wrap.style.borderRadius || getComputedStyle(inputEl).borderRadius || '';
            } catch (eR) {
                /* ignore */
            }
            wrap.appendChild(btn);
        }

        if (btn._hbProxyAbort && typeof btn._hbProxyAbort.abort === 'function') {
            try {
                btn._hbProxyAbort.abort();
            } catch (eA) {
                /* ignore */
            }
        }
        var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
        btn._hbProxyAbort = ac;
        var sig = ac && ac.signal;

        var openPanel = function () {
            if (msPanelIsOpen(ms)) {
                return;
            }
            ms.show();
        };

        var TAP_MAX_PX = 14;
        var TAP_MAX_MS = 450;
        var tapGesture = {
            active: false,
            misfire: false,
            x0: 0,
            y0: 0,
            t0: 0,
            ptrId: null,
            docAc: null,
            consumeClick: false
        };

        function tapClearDocListeners() {
            if (tapGesture.docAc) {
                try {
                    tapGesture.docAc.abort();
                } catch (eDoc) {
                    /* ignore */
                }
                tapGesture.docAc = null;
            }
        }

        function tapAttachDocMove(startX, startY, ptrId) {
            tapClearDocListeners();
            if (typeof AbortController === 'undefined') {
                return;
            }
            var dac = new AbortController();
            tapGesture.docAc = dac;
            var dSig = dac.signal;
            var onDocMove = function (de) {
                var cx;
                var cy;
                if (de.pointerId != null && ptrId != null && de.pointerId !== ptrId) {
                    return;
                }
                if (de.touches && de.touches[0]) {
                    cx = de.touches[0].clientX;
                    cy = de.touches[0].clientY;
                } else if (de.clientX != null) {
                    cx = de.clientX;
                    cy = de.clientY;
                } else {
                    return;
                }
                if (Math.hypot(cx - startX, cy - startY) > TAP_MAX_PX) {
                    tapGesture.misfire = true;
                }
            };
            document.addEventListener('pointermove', onDocMove, {
                capture: true,
                passive: true,
                signal: dSig
            });
            document.addEventListener('touchmove', onDocMove, {
                capture: true,
                passive: true,
                signal: dSig
            });
        }

        function tapReset() {
            tapGesture.active = false;
            tapGesture.misfire = false;
            tapGesture.ptrId = null;
            tapClearDocListeners();
        }

        function tapTryOpenFromEnd(ev, clientX, clientY) {
            if (!tapGesture.active) {
                return;
            }
            tapGesture.active = false;
            tapClearDocListeners();
            if (tapGesture.misfire) {
                tapReset();
                return;
            }
            var nowTs = ev && ev.timeStamp != null ? ev.timeStamp : Date.now();
            if (nowTs - tapGesture.t0 > TAP_MAX_MS) {
                tapReset();
                return;
            }
            if (
                clientX == null ||
                clientY == null ||
                Math.hypot(clientX - tapGesture.x0, clientY - tapGesture.y0) > TAP_MAX_PX
            ) {
                tapReset();
                return;
            }
            tapGesture.consumeClick = true;
            if (ev && ev.cancelable) {
                ev.preventDefault();
            }
            openPanel();
            tapReset();
        }

        var onTapPointerDown = function (ev) {
            if (!ev) {
                return;
            }
            if (ev.pointerType === 'mouse' && ev.buttons !== 1) {
                return;
            }
            tapGesture.consumeClick = false;
            tapGesture.active = true;
            tapGesture.misfire = false;
            tapGesture.x0 = ev.clientX;
            tapGesture.y0 = ev.clientY;
            tapGesture.t0 = ev.timeStamp || Date.now();
            tapGesture.ptrId = ev.pointerId;
            tapAttachDocMove(tapGesture.x0, tapGesture.y0, ev.pointerId);
        };

        var onTapPointerUp = function (ev) {
            if (!ev || !tapGesture.active) {
                return;
            }
            if (tapGesture.ptrId != null && ev.pointerId !== tapGesture.ptrId) {
                return;
            }
            tapTryOpenFromEnd(ev, ev.clientX, ev.clientY);
        };

        var onTapPointerCancel = function (ev) {
            if (!ev || !tapGesture.active) {
                return;
            }
            if (tapGesture.ptrId != null && ev.pointerId !== tapGesture.ptrId) {
                return;
            }
            tapReset();
        };

        var onTapClickFallback = function (ev) {
            if (tapGesture.consumeClick) {
                tapGesture.consumeClick = false;
                if (ev.preventDefault) {
                    ev.preventDefault();
                }
                if (ev.stopPropagation) {
                    ev.stopPropagation();
                }
            }
        };

        var onTouchStartLegacy = function (ev) {
            if (!ev || !ev.touches || !ev.touches[0]) {
                return;
            }
            var t0 = ev.touches[0];
            tapGesture.consumeClick = false;
            tapGesture.active = true;
            tapGesture.misfire = false;
            tapGesture.x0 = t0.clientX;
            tapGesture.y0 = t0.clientY;
            tapGesture.t0 = ev.timeStamp || Date.now();
            tapGesture.ptrId = null;
            tapAttachDocMove(tapGesture.x0, tapGesture.y0, null);
        };

        var onTouchEndLegacy = function (ev) {
            if (!tapGesture.active) {
                return;
            }
            var ch = ev.changedTouches && ev.changedTouches[0];
            if (!ch) {
                tapReset();
                return;
            }
            tapTryOpenFromEnd(ev, ch.clientX, ch.clientY);
        };

        var onTouchCancelLegacy = function () {
            tapReset();
        };

        if (sig) {
            if (typeof window.PointerEvent !== 'undefined') {
                btn.addEventListener(
                    'pointerdown',
                    onTapPointerDown,
                    Object.assign({ passive: true, capture: false }, { signal: sig })
                );
                btn.addEventListener(
                    'pointerup',
                    onTapPointerUp,
                    Object.assign({ passive: false, capture: false }, { signal: sig })
                );
                btn.addEventListener(
                    'pointercancel',
                    onTapPointerCancel,
                    Object.assign({ passive: true, capture: false }, { signal: sig })
                );
                btn.addEventListener(
                    'click',
                    onTapClickFallback,
                    Object.assign({ capture: true }, { signal: sig })
                );
            } else {
                btn.addEventListener(
                    'touchstart',
                    onTouchStartLegacy,
                    Object.assign({ passive: true, capture: false }, { signal: sig })
                );
                btn.addEventListener(
                    'touchend',
                    onTouchEndLegacy,
                    Object.assign({ passive: false, capture: false }, { signal: sig })
                );
                btn.addEventListener(
                    'touchcancel',
                    onTouchCancelLegacy,
                    Object.assign({ passive: true, capture: false }, { signal: sig })
                );
                btn.addEventListener(
                    'click',
                    function (ev) {
                        if (tapGesture.consumeClick) {
                            onTapClickFallback(ev);
                            return;
                        }
                        if (tapGesture.misfire || !tapGesture.active) {
                            return;
                        }
                        if (ev.stopPropagation) {
                            ev.stopPropagation();
                        }
                        openPanel();
                    },
                    Object.assign({ capture: true }, { signal: sig })
                );
            }
        } else if (typeof window.PointerEvent !== 'undefined') {
            btn.addEventListener('pointerdown', onTapPointerDown, { passive: true, capture: false });
            btn.addEventListener('pointerup', onTapPointerUp, { passive: false, capture: false });
            btn.addEventListener('pointercancel', onTapPointerCancel, { passive: true, capture: false });
            btn.addEventListener('click', onTapClickFallback, { capture: true });
        } else {
            btn.addEventListener('touchstart', onTouchStartLegacy, { passive: true, capture: false });
            btn.addEventListener('touchend', onTouchEndLegacy, { passive: false, capture: false });
            btn.addEventListener('touchcancel', onTouchCancelLegacy, { passive: true, capture: false });
            btn.addEventListener('click', function (ev) {
                if (tapGesture.consumeClick) {
                    onTapClickFallback(ev);
                    return;
                }
                openPanel();
            }, true);
        }
    }

    function attachWheelOpenHandlers(inputEl, ms) {
        if (!inputEl || !ms || typeof ms.show !== 'function') {
            return;
        }
        if (inputEl._hbWheelOpenAbort && typeof inputEl._hbWheelOpenAbort.abort === 'function') {
            try {
                inputEl._hbWheelOpenAbort.abort();
            } catch (eAbort) {
                /* ignore */
            }
        }
        var ac =
            typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;
        inputEl._hbWheelOpenAbort = ac;
        var optsOpen = ac && ac.signal ? { signal: ac.signal } : false;

        ensureWheelTapProxy(inputEl, ms);

        var openFromKeyboard = function () {
            if (msPanelIsOpen(ms)) {
                return;
            }
            ms.show();
        };
        if (optsOpen) {
            inputEl.addEventListener('focus', openFromKeyboard, optsOpen);
        } else {
            inputEl.addEventListener('focus', openFromKeyboard);
        }
    }

    var HB_MS_VISUAL = {
        bgColor: '#ffffff',
        textColor: '#000000',
        titleColor: '#000000',
        ensureBtnColor: '#000000',
        cancelBtnColor: '#000000',
        titleBgColor: '#ffffff',
        maskOpacity: 0.35
    };

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function daysInMonth(y, m) {
        return new Date(y, m, 0).getDate();
    }

    function buildDayData(y, m) {
        var max = daysInMonth(y, m);
        var arr = [];
        for (var d = 1; d <= max; d++) {
            arr.push(pad2(d));
        }
        return arr;
    }

    /** 闰年参考年：生日只选月/日时，2 月含 29 日 */
    var BIRTHDAY_REF_YEAR = 2000;

    function formatBirthdayMonthDay(m, d) {
        return pad2(parseInt(m, 10)) + '/' + pad2(parseInt(d, 10));
    }

    /** 三段相同数据，滚动到边缘时跳回中段下标，实现循环手感 */
    function tripleLoop(baseArr) {
        var a = baseArr.slice();
        return a.concat(a).concat(a);
    }

    function normalizeTripleWheel(instance, wheelIdx, baseLen) {
        if (!instance || !baseLen || baseLen < 1) {
            return;
        }
        var idxArr = instance.getIndexArr();
        var i = idxArr[wheelIdx];
        if (i < baseLen) {
            instance.locatePosition(wheelIdx, i + baseLen);
        } else if (i >= baseLen * 2) {
            instance.locatePosition(wheelIdx, i - baseLen);
        }
    }

    function hbMsLiTrimText(li) {
        return li && li.textContent ? String(li.textContent).trim() : '';
    }

    /**
     * 仅对「三段重复同一组选项」的列做 normalize（月/日/时/分等）。
     * 邮件发送时间的年份列长度也可能为 21（整除 3），但并非 tripleLoop，误归一会把年份错拨（如跳到 2038）。
     */
    function hbColumnLooksLikeTripleLoop(lis, nLi) {
        if (nLi < 9 || nLi % 3 !== 0) {
            return false;
        }
        var third = nLi / 3;
        var a = hbMsLiTrimText(lis[0]);
        var b = hbMsLiTrimText(lis[third]);
        var c = hbMsLiTrimText(lis[third * 2]);
        return a !== '' && a === b && b === c;
    }

    /** 滚轮 ul 是否为 tripleLoop 列；否则返回 0（避免年份等单调列表被误当成三段循环） */
    function hbTripleBaseLenFromWheelUl(ul) {
        if (!ul) {
            return 0;
        }
        var lis = ul.getElementsByTagName('li');
        var nLi = lis.length;
        if (!hbColumnLooksLikeTripleLoop(lis, nLi)) {
            return 0;
        }
        return nLi / 3;
    }

    /** 三段循环滚轮：对齐到中间段，避免快滑顶到物理端点后卡在 12 月等边界 */
    function hbNormalizeTripleColumnIfNeeded(ms, col) {
        if (!ms || !ms.sliderList) {
            return;
        }
        var u = ms.sliderList[col];
        if (!u) {
            return;
        }
        var lis = u.getElementsByTagName('li');
        var nLi = lis.length;
        if (nLi >= 9 && nLi % 3 === 0 && hbColumnLooksLikeTripleLoop(lis, nLi)) {
            normalizeTripleWheel(ms, col, nLi / 3);
            ms.updateCurDistance(u, col);
        }
    }

    /**
     * 程序化 updateWheel / locatePosition 时关掉各列 ul 的 transition，
     * 否则会与用户刚结束的惯性动画叠在一起出现闪一下（如 1月31日↔其它月份、12月↔1月）。
     */
    function withSilentWheelTransitions(instance, fn) {
        if (!instance || !instance.sliderList || instance.sliderList.length === 0) {
            fn();
            return;
        }
        var list = instance.sliderList;
        var k;
        for (k = 0; k < list.length; k++) {
            list[k].style.transition = 'none';
        }
        try {
            fn();
        } finally {
            if (instance.mobileSelect) {
                void instance.mobileSelect.offsetHeight;
            }
            requestAnimationFrame(function () {
                if (!instance.sliderList) {
                    return;
                }
                for (k = 0; k < instance.sliderList.length; k++) {
                    instance.sliderList[k].style.transition = '';
                }
            });
        }
    }

    /** 仅中间选中行黑色，其余行灰色（依赖库的 getIndexArr） */
    function syncWheelRowHighlight(instance) {
        if (!instance || !instance.sliderList || typeof instance.getIndexArr !== 'function') {
            return;
        }
        var indices;
        try {
            indices = instance.getIndexArr();
        } catch (eIdx) {
            return;
        }
        var w;
        for (w = 0; w < instance.sliderList.length; w++) {
            var ul = instance.sliderList[w];
            if (!ul) {
                continue;
            }
            var lis = ul.getElementsByTagName('li');
            var ci = indices[w];
            var i;
            for (i = 0; i < lis.length; i++) {
                if (i === ci) {
                    lis[i].classList.add('hb-ms-row-active');
                } else {
                    lis[i].classList.remove('hb-ms-row-active');
                }
            }
        }
    }

    function parseYmd(str) {
        var m = String(str || '')
            .trim()
            .match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
        if (!m) return null;
        return [m[1], m[2], m[3]];
    }

    /** yyyy/mm/dd、MM/DD、MMDD 数字 → { month, day }，供滚轮初值 */
    function parseBirthdayWheelInitial(str) {
        var fromYmd = parseYmd(str);
        if (fromYmd) {
            return { month: fromYmd[1], day: fromYmd[2] };
        }
        var smd = String(str || '')
            .trim()
            .match(/^(\d{1,2})\/(\d{1,2})$/);
        if (smd) {
            var mm = pad2(parseInt(smd[1], 10));
            var ddRaw = parseInt(smd[2], 10);
            var monthNum = parseInt(mm, 10);
            if (monthNum < 1 || monthNum > 12) {
                return null;
            }
            var dim = daysInMonth(BIRTHDAY_REF_YEAR, monthNum);
            if (ddRaw < 1 || ddRaw > dim) {
                return null;
            }
            return { month: mm, day: pad2(ddRaw) };
        }
        var digits = String(str || '')
            .trim()
            .replace(/\D/g, '');
        if (digits.length !== 4) {
            return null;
        }
        var mm2 = digits.slice(0, 2);
        var dd2 = digits.slice(2, 4);
        var month2 = parseInt(mm2, 10);
        var day2 = parseInt(dd2, 10);
        if (month2 < 1 || month2 > 12) {
            return null;
        }
        var dim2 = daysInMonth(BIRTHDAY_REF_YEAR, month2);
        if (day2 < 1 || day2 > dim2) {
            return null;
        }
        return { month: mm2, day: pad2(day2) };
    }

    function parseEmailDisplay(str) {
        var s = String(str || '').trim();
        var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
        if (iso) {
            return [iso[1], iso[2], iso[3], iso[4], iso[5]];
        }
        var slash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
        if (slash) {
            return [slash[1], slash[2], slash[3], slash[4], slash[5]];
        }
        var hyph = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
        if (hyph) {
            return [hyph[1], hyph[2], hyph[3], hyph[4], hyph[5]];
        }
        return null;
    }

    function formatEmailInput(parts) {
        return parts[0] + '/' + parts[1] + '/' + parts[2] + ' ' + parts[3] + ':' + parts[4];
    }

    function dateFromEmailParts(parts) {
        return new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
            parseInt(parts[3], 10),
            parseInt(parts[4], 10),
            0,
            0
        );
    }

    function partsFromEmailDate(d) {
        return [
            String(d.getFullYear()),
            pad2(d.getMonth() + 1),
            pad2(d.getDate()),
            pad2(d.getHours()),
            pad2(d.getMinutes())
        ];
    }

    /** 与表单校验一致：须严格晚于当前时刻；无效或已过期则抬到「当前时间 +1 分钟」 */
    function clampEmailPartsToFuture(parts) {
        var dt = dateFromEmailParts(parts);
        if (Number.isNaN(dt.getTime())) {
            return partsFromEmailDate(new Date(Date.now() + 60000));
        }
        if (dt.getTime() > Date.now()) {
            return parts.slice();
        }
        return partsFromEmailDate(new Date(Date.now() + 60000));
    }

    function initBirthday(inputEl, options) {
        var MS = getMobileSelect();
        if (!MS || !inputEl) return null;

        options = options || {};

        var months = [];
        for (var mi = 1; mi <= 12; mi++) {
            months.push(pad2(mi));
        }

        var parsed = parseBirthdayWheelInitial(inputEl.value);
        var vm, vd, mNum, hasInitialValue = !!parsed;
        if (parsed) {
            vm = parsed.month;
            vd = parsed.day;
            mNum = parseInt(vm, 10);
        } else {
            // 滚轮位置默认当天，但 input 留空
            var t = new Date();
            vm = pad2(t.getMonth() + 1);
            vd = pad2(t.getDate());
            mNum = parseInt(vm, 10);
        }
        var dayData = buildDayData(BIRTHDAY_REF_YEAR, mNum);
        if (dayData.indexOf(vd) < 0) {
            vd = dayData[dayData.length - 1];
        }

        if (inputEl._hbMsBirthday) {
            unregisterMsInstance(inputEl._hbMsBirthday);
            inputEl._hbMsBirthday.destroy();
            inputEl._hbMsBirthday = null;
        }

        var syncFlag = false;
        var lastBirthMonth = mNum;
        var mIdx0 = parseInt(vm, 10) - 1;
        if (mIdx0 < 0) {
            mIdx0 = 0;
        }
        var dIdx0 = dayData.indexOf(vd);
        if (dIdx0 < 0) {
            dIdx0 = dayData.length - 1;
        }
        var monthTriple = tripleLoop(months);
        var dayTriple = tripleLoop(dayData);

        var ms;
        try {
            ms = new MS(
                Object.assign({}, HB_MS_VISUAL, {
                    trigger: inputEl,
                    title: '选择生日（月 / 日）',
                    scrollSpeed: 1.15,
                    wheels: [{ data: monthTriple }, { data: dayTriple }],
                    connector: '/',
                    position: [12 + mIdx0, dayData.length + dIdx0],
                    triggerDisplayValue: false,
                    ensureBtnText: '确定',
                    cancelBtnText: '取消',
                    onShow: function () {
                        setTimeout(function () {
                            var inst = ms;
                            if (!inst || !inst.mobileSelect) {
                                return;
                            }
                            syncMsOptionHeight(inst);
                            requestAnimationFrame(function () {
                                syncWheelRowHighlight(inst);
                            });
                        }, 0);
                    },
                    onChange: function (valArr) {
                        inputEl.value = formatBirthdayMonthDay(valArr[0], valArr[1]);
                    },
                    onTransitionEnd: function (valArr, indexArr, instance) {
                        if (syncFlag) return;
                        var mn = parseInt(valArr[0], 10);
                        var newDays = buildDayData(BIRTHDAY_REF_YEAR, mn);
                        var baseDayLen = newDays.length;
                        var curD = valArr[1];
                        syncFlag = true;
                        try {
                            withSilentWheelTransitions(instance, function () {
                                if (mn !== lastBirthMonth) {
                                    lastBirthMonth = mn;
                                    instance.updateWheel(1, tripleLoop(newDays));
                                    var di = newDays.indexOf(curD);
                                    if (di < 0) {
                                        instance.locatePosition(1, baseDayLen + baseDayLen - 1);
                                    } else {
                                        instance.locatePosition(1, baseDayLen + di);
                                    }
                                }
                                normalizeTripleWheel(instance, 0, 12);
                                normalizeTripleWheel(instance, 1, baseDayLen);
                            });
                        } finally {
                            syncFlag = false;
                            requestAnimationFrame(function () {
                                syncWheelRowHighlight(instance);
                            });
                        }
                    }
                })
            );
        } catch (err) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[hbWheelPicker] birthday init failed', err);
            }
            return null;
        }

        registerMsInstance(ms);
        attachWheelOpenHandlers(inputEl, ms);
        inputEl.classList.add('hb-ms-trigger-input');
        if (hasInitialValue) {
            inputEl.value = formatBirthdayMonthDay(vm, vd);
        }
        inputEl._hbMsBirthday = ms;
        requestAnimationFrame(function () {
            syncWheelRowHighlight(ms);
        });
        return ms;
    }

    function buildHourData() {
        var h = [];
        for (var i = 0; i < 24; i++) {
            h.push(pad2(i));
        }
        return h;
    }

    function buildMinuteData() {
        var m = [];
        for (var i = 0; i < 60; i++) {
            m.push(pad2(i));
        }
        return m;
    }

    function initEmailSendTime(inputEl, options) {
        var MS = getMobileSelect();
        if (!MS || !inputEl) return null;
        unbindEmailSendTimeNative(inputEl);

        options = options || {};
        var minYear = options.minYear != null ? options.minYear : new Date().getFullYear();
        var maxYear = options.maxYear != null ? options.maxYear : new Date().getFullYear() + 20;

        var years = [];
        for (var y = minYear; y <= maxYear; y++) {
            years.push(String(y));
        }

        var months = [];
        for (var mi = 1; mi <= 12; mi++) {
            months.push(pad2(mi));
        }

        var hours = buildHourData();
        var minutes = buildMinuteData();

        var now = new Date();
        var soon = new Date(now.getTime() + 60000);
        var parsed = parseEmailDisplay(
            inputEl.value && String(inputEl.value).trim() ? inputEl.value : ''
        );
        var hadStoredValue = parsed != null;
        var parts = parsed || [
            String(soon.getFullYear()),
            pad2(soon.getMonth() + 1),
            pad2(soon.getDate()),
            pad2(soon.getHours()),
            pad2(soon.getMinutes())
        ];

        var yNum = parseInt(parts[0], 10);
        var mNum = parseInt(parts[1], 10);
        var dayData = buildDayData(yNum, mNum);
        if (dayData.indexOf(parts[2]) < 0) {
            parts[2] = dayData[dayData.length - 1];
        }

        parts = clampEmailPartsToFuture(parts);
        yNum = parseInt(parts[0], 10);
        mNum = parseInt(parts[1], 10);
        dayData = buildDayData(yNum, mNum);
        if (dayData.indexOf(parts[2]) < 0) {
            parts[2] = dayData[dayData.length - 1];
        }

        if (inputEl._hbMsEmail) {
            unregisterMsInstance(inputEl._hbMsEmail);
            inputEl._hbMsEmail.destroy();
            inputEl._hbMsEmail = null;
        }

        var syncFlag = false;
        var lastEmailYm = yNum + '-' + mNum;

        /** 当前组合若已不晚于「此刻」，静默拉回最早可选（无提示） */
        var enforceEmailMinNow = function (instance) {
            if (!instance || typeof instance.getCurValue !== 'function') {
                return;
            }
            var v = instance.getCurValue();
            if (!v || v.length < 5) {
                return;
            }
            var partsLive = [String(v[0]), String(v[1]), String(v[2]), String(v[3]), String(v[4])];
            var dtLive = dateFromEmailParts(partsLive);
            if (!Number.isNaN(dtLive.getTime()) && dtLive.getTime() > Date.now()) {
                lastEmailYm = parseInt(partsLive[0], 10) + '-' + parseInt(partsLive[1], 10);
                return;
            }
            var c = clampEmailPartsToFuture(partsLive);
            var yn = parseInt(c[0], 10);
            var mn = parseInt(c[1], 10);
            lastEmailYm = yn + '-' + mn;
            var newDaysEn = buildDayData(yn, mn);
            instance.updateWheel(2, tripleLoop(newDaysEn));
            var yi = years.indexOf(c[0]);
            if (yi < 0) {
                yi = Math.max(0, years.length - 1);
            }
            var mdi = parseInt(c[1], 10) - 1;
            var ddi = newDaysEn.indexOf(c[2]);
            if (ddi < 0) {
                ddi = newDaysEn.length - 1;
            }
            instance.locatePosition(0, yi);
            instance.locatePosition(1, 12 + mdi);
            instance.locatePosition(2, newDaysEn.length + ddi);
            instance.locatePosition(3, 24 + parseInt(c[3], 10));
            instance.locatePosition(4, 60 + parseInt(c[4], 10));
        };
        var eyIdx = years.indexOf(parts[0]);
        if (eyIdx < 0) {
            eyIdx = 0;
        }
        var emIdx0 = parseInt(parts[1], 10) - 1;
        if (emIdx0 < 0) {
            emIdx0 = 0;
        }
        var edIdx0 = dayData.indexOf(parts[2]);
        if (edIdx0 < 0) {
            edIdx0 = dayData.length - 1;
        }
        var ehIdx = parseInt(parts[3], 10);
        var eminIdx = parseInt(parts[4], 10);
        if (!Number.isFinite(ehIdx) || ehIdx < 0 || ehIdx > 23) {
            ehIdx = 0;
        }
        if (!Number.isFinite(eminIdx) || eminIdx < 0 || eminIdx > 59) {
            eminIdx = 0;
        }
        var emailMonthTriple = tripleLoop(months);
        var emailDayTriple = tripleLoop(dayData);
        var hourTriple = tripleLoop(hours);
        var minuteTriple = tripleLoop(minutes);

        var ms;
        try {
            ms = new MS(
                Object.assign({}, HB_MS_VISUAL, {
                    trigger: inputEl,
                    title: '邮件发送时间',
                    wheels: [
                        { data: years },
                        { data: emailMonthTriple },
                        { data: emailDayTriple },
                        { data: hourTriple },
                        { data: minuteTriple }
                    ],
                    connector: ' ',
                    position: [
                        eyIdx,
                        12 + emIdx0,
                        dayData.length + edIdx0,
                        24 + ehIdx,
                        60 + eminIdx
                    ],
                    triggerDisplayValue: false,
                    ensureBtnText: '确定',
                    cancelBtnText: '取消',
                    onShow: function () {
                        setTimeout(function () {
                            var inst = ms;
                            if (!inst || !inst.mobileSelect) {
                                return;
                            }
                            syncMsOptionHeight(inst);
                            syncFlag = true;
                            try {
                                withSilentWheelTransitions(inst, function () {
                                    enforceEmailMinNow(inst);
                                    var v2 = inst.getCurValue();
                                    var baseDl = buildDayData(
                                        parseInt(v2[0], 10),
                                        parseInt(v2[1], 10)
                                    ).length;
                                    normalizeTripleWheel(inst, 1, 12);
                                    normalizeTripleWheel(inst, 2, baseDl);
                                    normalizeTripleWheel(inst, 3, 24);
                                    normalizeTripleWheel(inst, 4, 60);
                                });
                            } finally {
                                syncFlag = false;
                                requestAnimationFrame(function () {
                                    syncWheelRowHighlight(inst);
                                });
                            }
                        }, 0);
                    },
                    onChange: function (valArr) {
                        var candidate = [
                            valArr[0],
                            valArr[1],
                            valArr[2],
                            valArr[3],
                            valArr[4]
                        ];
                        var safe = clampEmailPartsToFuture(candidate);
                        inputEl.value = formatEmailInput(safe);
                    },
                    onTransitionEnd: function (valArr, indexArr, instance) {
                        if (syncFlag) return;
                        var yn = parseInt(valArr[0], 10);
                        var mn = parseInt(valArr[1], 10);
                        var key = yn + '-' + mn;
                        var newDays = buildDayData(yn, mn);
                        var baseDayLen = newDays.length;
                        var curD = valArr[2];
                        syncFlag = true;
                        try {
                            withSilentWheelTransitions(instance, function () {
                                if (key !== lastEmailYm) {
                                    lastEmailYm = key;
                                    instance.updateWheel(2, tripleLoop(newDays));
                                    var di = newDays.indexOf(curD);
                                    if (di < 0) {
                                        instance.locatePosition(2, baseDayLen + baseDayLen - 1);
                                    } else {
                                        instance.locatePosition(2, baseDayLen + di);
                                    }
                                }
                                normalizeTripleWheel(instance, 1, 12);
                                normalizeTripleWheel(instance, 2, baseDayLen);
                                normalizeTripleWheel(instance, 3, 24);
                                normalizeTripleWheel(instance, 4, 60);
                                enforceEmailMinNow(instance);
                                var va = instance.getCurValue();
                                var baseAfter = buildDayData(
                                    parseInt(va[0], 10),
                                    parseInt(va[1], 10)
                                ).length;
                                normalizeTripleWheel(instance, 1, 12);
                                normalizeTripleWheel(instance, 2, baseAfter);
                                normalizeTripleWheel(instance, 3, 24);
                                normalizeTripleWheel(instance, 4, 60);
                            });
                        } finally {
                            syncFlag = false;
                            requestAnimationFrame(function () {
                                syncWheelRowHighlight(instance);
                            });
                        }
                    }
                })
            );
        } catch (err) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[hbWheelPicker] email send time init failed', err);
            }
            return null;
        }

        registerMsInstance(ms);
        attachWheelOpenHandlers(inputEl, ms);
        inputEl.classList.add('hb-ms-trigger-input');
        if (hadStoredValue) {
            inputEl.value = formatEmailInput(parts);
        } else {
            inputEl.value = '';
        }
        inputEl._hbMsEmail = ms;
        requestAnimationFrame(function () {
            syncWheelRowHighlight(ms);
        });
        return ms;
    }

    /**
     * 拆除邮件发送时间滚轮实例、打开面板的监听，以及透明点击代理与包裹层。
     */
    function teardownEmailSendTimeWheel(inputEl) {
        if (!inputEl) {
            return;
        }
        try {
            if (inputEl._hbMsEmail) {
                unregisterMsInstance(inputEl._hbMsEmail);
                try {
                    inputEl._hbMsEmail.destroy();
                } catch (eD) {
                    /* ignore */
                }
                inputEl._hbMsEmail = null;
            }
        } catch (eMs) {
            /* ignore */
        }
        if (inputEl._hbWheelOpenAbort && typeof inputEl._hbWheelOpenAbort.abort === 'function') {
            try {
                inputEl._hbWheelOpenAbort.abort();
            } catch (eAb) {
                /* ignore */
            }
            inputEl._hbWheelOpenAbort = null;
        }
        try {
            inputEl.classList.remove('hb-ms-trigger-input');
        } catch (eCl) {
            /* ignore */
        }
        var proxyId = 'hbWheelProxy_' + (inputEl.id || 'field');
        var proxyBtn = document.getElementById(proxyId);
        if (proxyBtn && proxyBtn.parentElement) {
            try {
                proxyBtn.parentElement.removeChild(proxyBtn);
            } catch (ePx) {
                /* ignore */
            }
        }
        var wrap = inputEl.closest && inputEl.closest('.hb-wheel-input-wrap');
        if (wrap && wrap.parentElement && wrap.contains(inputEl)) {
            try {
                wrap.parentElement.insertBefore(inputEl, wrap);
                wrap.parentElement.removeChild(wrap);
            } catch (eWr) {
                /* ignore */
            }
        }
        unbindEmailSendTimeNative(inputEl);
    }

    /** 用于 datetime-local 的「本地日历」字符串（无时区后缀） */
    function dateToDatetimeLocalValue(d) {
        if (!d || Number.isNaN(d.getTime())) {
            return '';
        }
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function nowDatetimeLocalMin() {
        var n = new Date();
        return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    /**
     * 关闭原生日期时间控件并恢复为滚轮用的 text+readonly 基底（与 index.update.html 默认一致）。
     */
    function unbindEmailSendTimeNative(inputEl) {
        if (!inputEl) {
            return;
        }
        var onClamp = inputEl._hbEmailSendNativeClamp;
        if (typeof onClamp === 'function') {
            try {
                inputEl.removeEventListener('blur', onClamp);
                inputEl.removeEventListener('change', onClamp);
            } catch (eRm) {
                /* ignore */
            }
            inputEl._hbEmailSendNativeClamp = null;
        }
        inputEl.removeAttribute('min');
        inputEl.removeAttribute('autocomplete');
        inputEl.type = 'text';
        inputEl.setAttribute('readonly', 'readonly');
        inputEl.setAttribute('inputmode', 'none');
        inputEl.placeholder = '可选，点击选择发送时间';
        inputEl.classList.add('cursor-pointer');
    }

    /** 滚轮不可用时降级为浏览器原生 datetime-local，不再手敲 yyyy/mm/dd 格式。 */
    function bindEmailSendTimeNativeDatetimeLocal(inputEl) {
        if (!inputEl) {
            return;
        }
        inputEl.removeAttribute('readonly');
        inputEl.removeAttribute('inputmode');
        inputEl.setAttribute('autocomplete', 'off');
        inputEl.type = 'datetime-local';
        inputEl.placeholder = '选择日期与时间';
        inputEl.classList.remove('cursor-pointer');

        function syncFromRaw() {
            var s = String(inputEl.value || '').trim();
            if (!s) {
                return;
            }
            var dt = parseEmailToDate(s);
            if ((!dt || Number.isNaN(dt.getTime())) && s.indexOf('T') !== -1) {
                dt = new Date(s);
            }
            if (!dt || Number.isNaN(dt.getTime())) {
                return;
            }
            var c = clampEmailPartsToFuture([
                String(dt.getFullYear()),
                pad2(dt.getMonth() + 1),
                pad2(dt.getDate()),
                pad2(dt.getHours()),
                pad2(dt.getMinutes())
            ]);
            var localVal = dateToDatetimeLocalValue(dateFromEmailParts(c));
            if (inputEl.value !== localVal) {
                inputEl.value = localVal;
            }
        }

        syncFromRaw();

        function clampLaterThanNow() {
            if (!String(inputEl.value || '').trim()) {
                return;
            }
            var dt = new Date(inputEl.value);
            if (Number.isNaN(dt.getTime())) {
                return;
            }
            if (dt.getTime() > Date.now()) {
                inputEl.min = nowDatetimeLocalMin();
                return;
            }
            var floor = new Date(Date.now() + 60000);
            inputEl.value = dateToDatetimeLocalValue(floor);
            inputEl.min = nowDatetimeLocalMin();
        }

        inputEl.min = nowDatetimeLocalMin();

        if (typeof inputEl._hbEmailSendNativeClamp === 'function') {
            clampLaterThanNow();
            return;
        }
        inputEl._hbEmailSendNativeClamp = function () {
            inputEl.min = nowDatetimeLocalMin();
            clampLaterThanNow();
        };
        inputEl.addEventListener('blur', inputEl._hbEmailSendNativeClamp);
        inputEl.addEventListener('change', inputEl._hbEmailSendNativeClamp);
    }

    function fallbackEmailSendTimeToPlainText(inputEl) {
        if (!inputEl) {
            return;
        }
        teardownEmailSendTimeWheel(inputEl);
        bindEmailSendTimeNativeDatetimeLocal(inputEl);
    }

    /**
     * 拆除生日滚轮实例、打开面板的监听，以及透明点击代理与包裹层，避免降级为文本后仍无法输入。
     */
    function teardownBirthdayWheel(inputEl) {
        if (!inputEl) {
            return;
        }
        try {
            if (inputEl._hbMsBirthday) {
                unregisterMsInstance(inputEl._hbMsBirthday);
                try {
                    inputEl._hbMsBirthday.destroy();
                } catch (eD) {
                    /* ignore */
                }
                inputEl._hbMsBirthday = null;
            }
        } catch (eMs) {
            /* ignore */
        }
        if (inputEl._hbWheelOpenAbort && typeof inputEl._hbWheelOpenAbort.abort === 'function') {
            try {
                inputEl._hbWheelOpenAbort.abort();
            } catch (eAb) {
                /* ignore */
            }
            inputEl._hbWheelOpenAbort = null;
        }
        try {
            inputEl.classList.remove('hb-ms-trigger-input');
        } catch (eCl) {
            /* ignore */
        }
        var proxyId = 'hbWheelProxy_' + (inputEl.id || 'field');
        var proxyBtn = document.getElementById(proxyId);
        if (proxyBtn && proxyBtn.parentElement) {
            try {
                proxyBtn.parentElement.removeChild(proxyBtn);
            } catch (ePx) {
                /* ignore */
            }
        }
        var wrap = inputEl.closest && inputEl.closest('.hb-wheel-input-wrap');
        if (wrap && wrap.parentElement && wrap.contains(inputEl)) {
            try {
                wrap.parentElement.insertBefore(inputEl, wrap);
                wrap.parentElement.removeChild(wrap);
            } catch (eWr) {
                /* ignore */
            }
        }
    }

    function setBirthdayYmd(inputEl, ymd) {
        if (!inputEl || !ymd) return;
        var mdStr = '';
        var py = parseYmd(ymd);
        if (py) {
            mdStr = formatBirthdayMonthDay(py[1], py[2]);
        } else {
            var ini = parseBirthdayWheelInitial(ymd);
            if (ini) {
                mdStr = formatBirthdayMonthDay(ini.month, ini.day);
            }
        }
        if (!mdStr) return;
        inputEl.value = mdStr;
        teardownBirthdayWheel(inputEl);
        var inst = initBirthday(inputEl);
        if (
            !inst &&
            window.hbBirthday &&
            typeof window.hbBirthday.fallbackWheelToPlainText === 'function'
        ) {
            window.hbBirthday.fallbackWheelToPlainText(inputEl);
        }
    }

    function setEmailSendFromDate(inputEl, d) {
        if (!inputEl || !(d instanceof Date) || Number.isNaN(d.getTime())) return;
        var parts = clampEmailPartsToFuture([
            String(d.getFullYear()),
            pad2(d.getMonth() + 1),
            pad2(d.getDate()),
            pad2(d.getHours()),
            pad2(d.getMinutes())
        ]);
        inputEl.value = formatEmailInput(parts);
        teardownEmailSendTimeWheel(inputEl);
        var inst = initEmailSendTime(inputEl);
        if (!inst) {
            fallbackEmailSendTimeToPlainText(inputEl);
        }
    }

    function clearEmailSendTime(inputEl) {
        if (!inputEl) {
            return;
        }
        teardownEmailSendTimeWheel(inputEl);
        inputEl.value = '';
        var inst = initEmailSendTime(inputEl);
        if (!inst) {
            fallbackEmailSendTimeToPlainText(inputEl);
        }
    }

    function emailValueToApi(raw) {
        if (raw == null || raw === '') return '';
        var s = String(raw).trim();
        if (s.indexOf('T') !== -1) {
            return s.length >= 16 ? s.slice(0, 16) : s;
        }
        var m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
        if (m1) {
            return m1[1] + '-' + m1[2] + '-' + m1[3] + 'T' + m1[4] + ':' + m1[5];
        }
        var m2 = s.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
        if (m2) {
            return m2[1] + '-' + m2[2] + '-' + m2[3] + 'T' + m2[4] + ':' + m2[5];
        }
        return '';
    }

    function parseEmailToDate(raw) {
        if (raw == null || raw === '') return null;
        var s = String(raw).trim();
        if (s.indexOf('T') !== -1) {
            var dt = new Date(s);
            return Number.isNaN(dt.getTime()) ? null : dt;
        }
        var m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
        if (m1) {
            return new Date(
                parseInt(m1[1], 10),
                parseInt(m1[2], 10) - 1,
                parseInt(m1[3], 10),
                parseInt(m1[4], 10),
                parseInt(m1[5], 10),
                0,
                0
            );
        }
        var m2 = s.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
        if (m2) {
            return new Date(
                parseInt(m2[1], 10),
                parseInt(m2[2], 10) - 1,
                parseInt(m2[3], 10),
                parseInt(m2[4], 10),
                parseInt(m2[5], 10),
                0,
                0
            );
        }
        return null;
    }

    window.hbWheelPicker = {
        initBirthday: initBirthday,
        initEmailSendTime: initEmailSendTime,
        setBirthdayYmd: setBirthdayYmd,
        teardownBirthdayWheel: teardownBirthdayWheel,
        teardownEmailSendTimeWheel: teardownEmailSendTimeWheel,
        fallbackEmailSendTimeToPlainText: fallbackEmailSendTimeToPlainText,
        setEmailSendFromDate: setEmailSendFromDate,
        clearEmailSendTime: clearEmailSendTime,
        emailValueToApi: emailValueToApi,
        parseEmailToDate: parseEmailToDate
    };

    document.addEventListener('DOMContentLoaded', function () {
        var el = document.getElementById('emailSendTime');
        if (el && window.hbWheelPicker && typeof window.hbWheelPicker.initEmailSendTime === 'function') {
            var inst = window.hbWheelPicker.initEmailSendTime(el);
            if (!inst && typeof window.hbWheelPicker.fallbackEmailSendTimeToPlainText === 'function') {
                window.hbWheelPicker.fallbackEmailSendTimeToPlainText(el);
            }
        }
    });
})();
