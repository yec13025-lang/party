// region 播放器主逻辑：控制播放、进度、与父页通信
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const playPauseBtn = document.querySelector('.play-pause');
        const progressBar = document.querySelector('.progress');
        const progressArea = document.querySelector('.progress-bar');
        const currentTimeEl = document.querySelector('.current');
        const durationEl = document.querySelector('.duration');
        const trackNameEl = document.querySelector('.track-name');
        const audioEl = document.getElementById('playerAudio');
        let accentStyleEl = null;

        const UNKNOWN_DURATION = '--:--';

        /** 仅用于展示与进度：不信任父页或 URL 传入的 hint，避免错误秒数与播放后跳变 */
        function hasReliableMediaDuration(d) {
            return Number.isFinite(d) && d > 0 && d !== Infinity;
        }

        function getReliableDurationSeconds() {
            return hasReliableMediaDuration(audioEl.duration) ? audioEl.duration : null;
        }

        function hexToRgba(hex, alpha) {
            const raw = String(hex || '').trim().replace('#', '');
            if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
                return `rgba(255, 107, 139, ${alpha})`;
            }
            const r = parseInt(raw.slice(0, 2), 16);
            const g = parseInt(raw.slice(2, 4), 16);
            const b = parseInt(raw.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        function applyAccentColor(color) {
            if (!color) return;
            const glowColor = hexToRgba(color, 0.35);
            const rootThemeClass = Array.from(document.documentElement.classList || []).find(function (cls) {
                return /^theme-/.test(cls);
            });
            const scoped = rootThemeClass ? `.${rootThemeClass}` : 'html';
            if (playPauseBtn) {
                playPauseBtn.style.setProperty('background', color, 'important');
                playPauseBtn.style.setProperty('box-shadow', `0 6px 14px ${glowColor}`, 'important');
            }
            if (progressBar) {
                progressBar.style.setProperty('background', color, 'important');
            }
            if (!accentStyleEl) {
                accentStyleEl = document.createElement('style');
                accentStyleEl.id = 'playerAccentOverride';
                document.head.appendChild(accentStyleEl);
            }
            accentStyleEl.textContent = `
                .music-player .play-pause{background:${color} !important;box-shadow:0 6px 14px ${glowColor} !important;}
                .music-player .progress{background:${color} !important;}
                .music-player .progress::after{border-color:${color} !important;}
                ${scoped} .progress::after{border-color:${color} !important;}
                ${scoped} .progress{background:${color} !important;}
                .progress::after{border-color:${color} !important;}
                .progress{background:${color} !important;}
            `;
        }

        function setTrackName(name) {
            const safeName = (name || '').trim();
            if (trackNameEl) {
                if (!safeName) {
                    trackNameEl.textContent = '';
                    trackNameEl.title = '';
                    trackNameEl.style.display = 'none';
                } else {
                    trackNameEl.textContent = safeName;
                    trackNameEl.title = safeName;
                    trackNameEl.style.display = 'block';
                }
            }
        }

        function inferNameFromSrc(src) {
            if (!src) return '';
            if (src.startsWith('data:')) return '本地音频';
            if (src.startsWith('blob:')) return '本地音频';
            try {
                const url = new URL(src, window.location.href);
                const pathname = decodeURIComponent(url.pathname || '');
                return pathname.split('/').pop() || '';
            } catch (e) {
                return '';
            }
        }

        function applyThemeColor(themeColor) {
            if (!themeColor) return;

            localStorage.setItem('themeColor', themeColor);

            document.documentElement.classList.remove('theme-default', 'theme-blue', 'theme-red', 'theme-teal', 'theme-green', 'theme-orange', 'theme-purple', 'theme-pink', 'theme-lemon');

            if (themeColor && themeColor !== 'default') {
                document.documentElement.classList.add('theme-' + themeColor);
            } else {
                document.documentElement.classList.add('theme-default');
            }

            const progressBarInner = document.querySelector('.progress');
            const progressAreaInner = document.querySelector('.progress-bar');
            const controlBtns = document.querySelectorAll('.control-btn');
            const playPauseInner = document.querySelector('.play-pause');

            if (progressBarInner) {
                progressBarInner.style.background = '';
            }
            if (progressAreaInner) {
                progressAreaInner.style.background = '';
            }
            if (playPauseInner) {
                playPauseInner.style.backgroundColor = '';
                playPauseInner.style.boxShadow = '';
            }
            controlBtns.forEach(btn => {
                btn.style.color = '';
                btn.onmouseover = null;
                btn.onmouseout = null;
            });

            forceElementRepaint(document.body);
        }

        function toTimeString(sec) {
            if (!Number.isFinite(sec) || sec < 0) {
                return '0:00';
            }
            const minutes = Math.floor(sec / 60);
            const seconds = Math.floor(sec % 60);
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }

        function updateDurationDisplay() {
            if (!durationEl) return;
            const total = getReliableDurationSeconds();
            durationEl.textContent = total != null ? toTimeString(total) : UNKNOWN_DURATION;
        }

        function updateProgress() {
            const total = getReliableDurationSeconds();
            const rawCurrent = Number.isFinite(audioEl.currentTime) && audioEl.currentTime >= 0 ? audioEl.currentTime : 0;
            const current = total != null ? Math.min(rawCurrent, total) : rawCurrent;

            if (progressBar) {
                if (total != null && total > 0) {
                    const percent = Math.min((current / total) * 100, 100);
                    progressBar.style.width = `${percent}%`;
                } else {
                    progressBar.style.width = '0%';
                }
            }
            if (currentTimeEl) {
                currentTimeEl.textContent = toTimeString(current);
            }
        }

        function postToParent(message) {
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(message, '*');
                }
            } catch (e) {
            }
        }

        function bindMediaEvents() {
            audioEl.addEventListener('timeupdate', updateProgress);
            audioEl.addEventListener('loadedmetadata', function () {
                updateDurationDisplay();
                updateProgress();
            });
            audioEl.addEventListener('durationchange', function () {
                updateDurationDisplay();
                updateProgress();
            });
            audioEl.addEventListener('ended', function () {
                if (playPauseBtn) playPauseBtn.textContent = '▶';
                updateProgress();
                postToParent({type: 'player:ended'});
            });
            audioEl.addEventListener('pause', function () {
                if (playPauseBtn) playPauseBtn.textContent = '▶';
                postToParent({type: 'player:pause'});
            });
            audioEl.addEventListener('play', function () {
                if (playPauseBtn) playPauseBtn.textContent = '⏸';
                postToParent({type: 'player:play'});
            });
            audioEl.addEventListener('error', function () {
                const errorInfo = {
                    error: audioEl.error,
                    code: audioEl.error ? audioEl.error.code : 'unknown',
                    message: audioEl.error ? audioEl.error.message : 'unknown',
                    src: audioEl.src ? audioEl.src.substring(0, 100) + '...' : 'null'
                };

                console.error('音频加载错误:', errorInfo);

                if (audioEl.error && audioEl.error.code === 4) {
                    console.error('音频格式不支持。请检查录音格式与播放器兼容性。');
                }

                if (playPauseBtn) playPauseBtn.textContent = '!';
            });
        }

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', async function () {
                if (audioEl.paused) {
                    try {
                        await audioEl.play();
                        playPauseBtn.textContent = '⏸';
                        postToParent({type: 'player:play'});
                    } catch (e) {
                        console.error('播放失败', {
                            error: e.message,
                            name: e.name,
                            src: audioEl.src,
                            readyState: audioEl.readyState,
                            networkState: audioEl.networkState,
                            error: audioEl.error
                        });
                        playPauseBtn.textContent = '!';
                    }
                } else {
                    audioEl.pause();
                    playPauseBtn.textContent = '▶';
                    postToParent({type: 'player:pause'});
                }
            });
        }

        if (progressArea) {
            progressArea.addEventListener('click', function (e) {
                const total = getReliableDurationSeconds();
                if (total == null || total <= 0) {
                    return;
                }
                const progressWidth = this.clientWidth;
                const clickedX = e.offsetX;
                const percent = Math.min((clickedX / progressWidth), 1);
                audioEl.currentTime = percent * total;
                updateProgress();
            });
        }

        bindMediaEvents();

        const urlParams = new URLSearchParams(window.location.search);
        const urlSrc = urlParams.get('src');
        if (urlSrc) {
            try {
                audioEl.src = decodeURIComponent(urlSrc);
            } catch (e) {
                audioEl.src = urlSrc;
            }
            setTrackName(inferNameFromSrc(audioEl.src));
        }
        updateDurationDisplay();
        updateProgress();

        window.addEventListener('message', function (event) {
            const data = event.data || {};
            if (data && data.type === 'initAudio') {
                if (data.src) {
                    audioEl.src = data.src;
                    setTrackName(data.fileName || inferNameFromSrc(data.src));
                }
                if (data.themeColor) {
                    applyThemeColor(data.themeColor);
                }
                if (data.accentColor) {
                    applyAccentColor(data.accentColor);
                }
                updateDurationDisplay();
                updateProgress();
            } else if (data && data.type === 'applyThemeColor') {
                applyThemeColor(data.themeColor);
            } else if (data && data.type === 'player:pause') {
                if (!audioEl.paused) {
                    audioEl.pause();
                    if (playPauseBtn) playPauseBtn.textContent = '▶';
                }
            } else if (data && data.type === 'player:reset') {
                if (!audioEl.paused) {
                    audioEl.pause();
                }
                audioEl.currentTime = 0;
                if (progressBar) progressBar.style.width = '0%';
                if (currentTimeEl) currentTimeEl.textContent = '0:00';
                if (durationEl) durationEl.textContent = UNKNOWN_DURATION;
                if (playPauseBtn) playPauseBtn.textContent = '▶';
                setTrackName('未命名音频');
            }
        });
    });
})();
// endregion
