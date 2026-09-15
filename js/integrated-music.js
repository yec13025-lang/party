/**
 * 集成页面音乐控制系统
 */

// 音乐控制相关变量
let isMusicInitialized = false;
let currentMusicUrl = null;
let musicFadeInProgress = false;
let musicFadeOutProgress = false;

function pauseRecordPlayerBeforeBgMusic() {
    const audioPlayerFrame = document.querySelector('.audio-player iframe');
    if (!audioPlayerFrame || !audioPlayerFrame.contentWindow) {
        return;
    }
    audioPlayerFrame.contentWindow.postMessage({ type: 'player:pause' }, '*');
    // 兼容部分机型首条消息丢失
    setTimeout(function () {
        if (audioPlayerFrame.contentWindow) {
            audioPlayerFrame.contentWindow.postMessage({ type: 'player:pause' }, '*');
        }
    }, 80);
}

/**
 * 初始化集成页面音乐系统
 */
function initIntegratedMusic() {

    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');

    if (!bgMusic) {
        console.error('未找到背景音乐元素');
        return;
    }

    // 配置音频元素
    bgMusic.loop = true;
    bgMusic.preload = 'auto';
    bgMusic.autoplay = false; // 禁用自动播放，避免默认音乐自动播放

    // 添加音频事件监听
    bgMusic.addEventListener('loadedmetadata', function () {
    });

    bgMusic.addEventListener('canplaythrough', function () {
    });

    // 移除自动加载音乐，由integrated.js统一控制

    // 添加用户交互监听
    document.addEventListener('click', handleFirstUserInteraction, {once: true});
    document.addEventListener('touchstart', handleFirstUserInteraction, {once: true});
    document.addEventListener('keydown', handleFirstUserInteraction, {once: true});
}

/**
 * 处理第一次用户交互
 */
function handleFirstUserInteraction() {
    if (!isMusicInitialized) {
        isMusicInitialized = true;

        // 只标记为已初始化，不播放音乐
        // 音乐播放将由主控制逻辑在适当的时候触发
        console.log('音乐系统已初始化，等待主控制逻辑触发播放');
    }
}

/**
 * 加载集成页面音乐
 */
function loadIntegratedMusic(blessingId) {
    // 优先使用调用方传入的 id，其次读 URL 参数，最后退回缓存中的 id
    const cachedId = localStorage.getItem('blessingid');
    const queryId = getQueryParam('blessingid') || getQueryParam('blessingId') || getQueryParam('id');
    const fallbackId = (cachedId && cachedId !== 'null' && cachedId !== 'undefined') ? cachedId : '';
    const resolvedId = blessingId || queryId || fallbackId;

    if (resolvedId) {
        loadCustomIntegratedMusic(resolvedId);
    } else {
        loadDefaultIntegratedMusic();
    }
}

/**
 * 加载自定义音乐
 */
function loadCustomIntegratedMusic(blessingId) {
    try {
        console.log('从缓存加载自定义音乐');
        const bgMusic = document.getElementById('bgMusic');
        if (!bgMusic) {
            console.error('未找到音频元素');
            return;
        }
        
        // 用户明确删除了背景音乐：保持静音，不回落到默认音乐
        if (window.blessingData && window.blessingData.musicDisabled === true) {
            console.log('用户已删除背景音乐，保持静音');
            bgMusic.removeAttribute('src');
            bgMusic.load();
            currentMusicUrl = null;
            const musicControl = document.getElementById('musicControl');
            if (musicControl) musicControl.style.display = 'none';
            return;
        }

        // 直接从window.blessingData获取数据，不再等待
        const musicUrl = window.blessingData && window.blessingData.automationMusicUrl;
        const musicData = window.blessingData && window.blessingData.automationMusicData;

        if (musicUrl) {
            console.log('使用音乐URL加载');
            bgMusic.src = musicUrl;
            currentMusicUrl = musicUrl;
        } else if (musicData) {
            // 后端以 base64 data URL 内联音乐时（isloadbase64）的兜底分支
            console.log('使用音乐base64数据加载');
            bgMusic.src = musicData;
            currentMusicUrl = musicData;
        } else {
            // 如果两者都没有，则使用默认音乐
            console.log('没有找到有效的音乐数据，使用默认音乐');
            loadDefaultIntegratedMusic();
        }
    } catch (error) {
        console.error('获取自定义音乐时发生错误:', error);
        loadDefaultIntegratedMusic();
    }
}

/**
 * 加载默认音乐
 */
function loadDefaultIntegratedMusic() {
    const bgMusic = document.getElementById('bgMusic');
    if (!bgMusic) {
        console.error('未找到音频元素');
        return;
    }

    // 设置默认音乐源（根绝对路径，与后端同源提供）
    const defaultMusicUrl = '/music/2099452154499207168.mp3';

    bgMusic.src = defaultMusicUrl;
    bgMusic.load();
    currentMusicUrl = defaultMusicUrl;
}

/**
 * 播放音乐
 */
function playMusic() {
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');

    if (!bgMusic || !musicBtn) {
        console.error('未找到音乐元素或按钮');
        return;
    }

    if (bgMusic.paused) {
        pauseRecordPlayerBeforeBgMusic();
        bgMusic.play().then(() => {
            musicBtn.classList.add('playing');
        }).catch(error => {
            console.log('音乐播放失败:', error);
        });
    }
}

/**
 * 暂停音乐
 */
function pauseMusic() {
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');

    if (!bgMusic || !musicBtn) {
        console.error('未找到音乐元素或按钮');
        return;
    }

    bgMusic.pause();
    musicBtn.classList.remove('playing');
}

/**
 * 切换音乐播放状态
 */
function toggleIntegratedMusic() {
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');

    if (!bgMusic || !musicBtn) {
        console.error('未找到音乐元素或按钮');
        return;
    }

    if (bgMusic.paused) {
        pauseRecordPlayerBeforeBgMusic();
        playMusic();
    } else {
        pauseMusic();
    }
}

/**
 * 音频淡入效果
 */
function fadeInIntegratedAudio(audio, duration = 1000) {
    return new Promise((resolve, reject) => {
        if (!audio) {
            reject(new Error('No audio element provided'));
            return;
        }

        if (musicFadeInProgress) {
            resolve();
            return;
        }

        musicFadeInProgress = true;
        audio.volume = 0;

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                const startTime = Date.now();

                function fade() {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    audio.volume = progress;

                    if (progress < 1) {
                        requestAnimationFrame(fade);
                    } else {
                        musicFadeInProgress = false;
                        resolve();
                    }
                }

                fade();
            }).catch(error => {
                musicFadeInProgress = false;
                reject(error);
            });
        } else {
            musicFadeInProgress = false;
            resolve();
        }
    });
}

/**
 * 音频淡出效果
 */
function fadeOutIntegratedAudio(audio, duration = 1000) {
    return new Promise((resolve) => {
        if (!audio || audio.paused) {
            resolve();
            return;
        }

        if (musicFadeOutProgress) {
            resolve();
            return;
        }

        musicFadeOutProgress = true;
        const startVolume = audio.volume || 1;
        const startTime = Date.now();

        function fade() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            audio.volume = startVolume * (1 - progress);

            if (progress < 1) {
                requestAnimationFrame(fade);
            } else {
                audio.pause();
                audio.volume = startVolume;
                musicFadeOutProgress = false;
                resolve();
            }
        }

        fade();
    });
}

/**
 * 获取URL参数
 */
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * 设置自定义音乐
 */
function setCustomIntegratedMusic(musicUrl) {
    const bgMusic = document.getElementById('bgMusic');
    if (!bgMusic) {
        console.error('未找到音频元素');
        return;
    }

    if (musicUrl) {
        currentMusicUrl = musicUrl;

        // 设置音频源
        bgMusic.src = musicUrl;
        bgMusic.load();

        // 不自动播放音乐，等待主控制逻辑触发
    }
}

// 移除自动初始化，由integrated.js统一控制

// 导出函数供其他模块使用
window.initIntegratedMusic = initIntegratedMusic;
window.loadIntegratedMusic = loadIntegratedMusic;
window.loadCustomIntegratedMusic = loadCustomIntegratedMusic;
window.loadDefaultIntegratedMusic = loadDefaultIntegratedMusic;
window.toggleIntegratedMusic = toggleIntegratedMusic;
window.playMusic = playMusic;
window.pauseMusic = pauseMusic;
window.setCustomIntegratedMusic = setCustomIntegratedMusic;
window.fadeInIntegratedAudio = fadeInIntegratedAudio;
window.fadeOutIntegratedAudio = fadeOutIntegratedAudio;
