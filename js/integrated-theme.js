/**
 * 集成页面主题控制系统
 */

// 主题颜色配置
const INTEGRATED_THEME_COLORS = {
    default: {
        primary: '#ee9ca7',
        secondary: '#ffdde1',
        rgba: 'rgba(238, 156, 167, 0.5)'
    },
    blue: {
        primary: '#6495ed',
        secondary: '#4169e1',
        rgba: 'rgba(100, 149, 237, 0.5)'
    },
    red: {
        primary: '#A23025',
        secondary: '#7a1e16',
        rgba: 'rgba(162, 48, 37, 0.5)'
    },
    teal: {
        primary: '#68C2B9',
        secondary: '#3a9e93',
        rgba: 'rgba(104, 194, 185, 0.5)'
    },
    green: {
        primary: '#7CA32C',
        secondary: '#537a14',
        rgba: 'rgba(124, 163, 44, 0.5)'
    },
    orange: {
        primary: '#DE5B24',
        secondary: '#a83b10',
        rgba: 'rgba(222, 91, 36, 0.5)'
    },
    purple: {
        primary: '#BB4B5B',
        secondary: '#882c3b',
        rgba: 'rgba(187, 75, 91, 0.5)'
    },
    lemon: {
        primary: '#FBE484',
        secondary: '#E6D260',
        rgba: 'rgba(251, 228, 132, 0.5)'
    }
};

/**
 * 设置元素的渐变背景
 * @param {HTMLElement} element - 要设置背景的元素
 * @param {string} themeColor - 主题颜色
 * @param {string} gradientType - 渐变类型（'top' 或 'topLeft'）
 */
function setIntegratedElementGradientBackground(element, themeColor, gradientType = 'top') {
    const colorConfig = INTEGRATED_THEME_COLORS[themeColor];
    if (!colorConfig) return;

    const primaryColor = colorConfig.primary;
    const secondaryColor = colorConfig.secondary;

    if (gradientType === 'top') {
        element.style.background = primaryColor;
        element.style.background = `-webkit-linear-gradient(top, ${primaryColor} 0%, ${secondaryColor} 120%)`;
        element.style.background = `-moz-linear-gradient(top, ${primaryColor} 0%, ${secondaryColor} 120%)`;
        element.style.background = `-o-linear-gradient(top, ${primaryColor} 0%, ${secondaryColor} 120%)`;
        element.style.background = `-ms-linear-gradient(top, ${primaryColor} 0%, ${secondaryColor} 120%)`;
        element.style.background = `linear-gradient(to top, ${primaryColor} 0%, ${secondaryColor} 120%)`;
    } else if (gradientType === 'topLeft') {
        element.style.background = `-webkit-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `-moz-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `-o-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `-ms-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
    }
}

/**
 * 强制元素重绘以应用样式
 * @param {HTMLElement} element - 要重绘的元素
 */
function forceIntegratedElementRepaint(element) {
    element.style.opacity = '0.99';
    setTimeout(() => {
        element.style.opacity = '1';
    }, 10);
}

/**
 * 应用主题颜色到集成页面（带blessingid检查）
 */
function applyIntegratedThemeColor() {
    // 获取当前URL中的blessingid
    const currentBlessingId = new URLSearchParams(window.location.search).get('blessingid');
    const cachedBlessingId = localStorage.getItem('blessingid');

    // 如果blessingid不匹配，清除旧的themeColor并应用默认主题
    // 注意：不在这里清除其他数据，因为loadBlessingData会处理
    if (currentBlessingId && cachedBlessingId && cachedBlessingId !== currentBlessingId) {
        console.log('检测到blessingid不匹配，清除旧主题颜色并应用默认主题');
        // 清除旧的主题颜色
        localStorage.removeItem('themeColor');
        // 立即应用默认主题，不等待新数据
        applyIntegratedThemeColorDirect();
        return;
    }

    // blessingid匹配或没有blessingid，直接应用当前主题
    applyIntegratedThemeColorDirect();
}

/**
 * 应用主题颜色到集成页面（直接应用，不检查blessingid匹配）
 */
function applyIntegratedThemeColorDirect() {
    // 从localStorage获取主题颜色
    const themeColor = localStorage.getItem('themeColor') || 'default';

    // 获取html元素
    const htmlElement = document.documentElement;

    // 移除所有主题类
    htmlElement.classList.remove('theme-default', 'theme-blue', 'theme-red', 'theme-teal', 'theme-green', 'theme-orange', 'theme-purple', 'theme-lemon');

    // 添加当前主题类到html元素
    if (Object.keys(INTEGRATED_THEME_COLORS).includes(themeColor)) {
        htmlElement.classList.add(`theme-${themeColor}`);
    } else {
        htmlElement.classList.add('theme-default');
    }

    // 特别处理第二屏（动画页面）的主题应用
    const screen2 = document.getElementById('screen2');
    if (screen2) {
        // 强制添加body--ready类，确保主题样式应用
        document.body.classList.add('body--ready');
        // 不设置内联样式，让CSS主题样式生效
        // 移除可能存在的内联背景样式
        document.body.style.background = '';
        document.body.style.backgroundImage = '';

        // 强制重绘，确保主题样式正确应用
        forceIntegratedElementRepaint(document.body);
    }

    // 特别处理第三屏（蛋糕页面）的主题应用
    const screen3 = document.getElementById('screen3');
    if (screen3) {
        // 强制添加bg类，确保主题样式应用
        document.body.classList.add('bg');

        // 设置主题背景
        setIntegratedElementGradientBackground(document.body, themeColor, 'topLeft');

        // 强制重绘，确保主题样式正确应用
        forceIntegratedElementRepaint(document.body);
    }

    // 特别处理第一屏（登录页面）的主题应用
    const screen1 = document.getElementById('screen1');
    if (screen1) {
        if (Object.keys(INTEGRATED_THEME_COLORS).includes(themeColor)) {
            setIntegratedElementGradientBackground(screen1, themeColor, 'topLeft');
        } else {
            screen1.style.background = '';
        }

        // 强制重绘，确保主题样式正确应用
        forceIntegratedElementRepaint(screen1);
    }

    // 特别处理第四屏（回忆页面）的主题应用
    const screen4 = document.getElementById('screen4');
    if (screen4) {
        if (Object.keys(INTEGRATED_THEME_COLORS).includes(themeColor)) {
            setIntegratedElementGradientBackground(screen4, themeColor, 'topLeft');
        } else {
            screen4.style.background = '';
        }

        // 强制重绘，确保主题样式正确应用
        forceIntegratedElementRepaint(screen4);
    }

    // 通知所有iframe应用主题
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        try {
            // 发送更详细的主题信息，包括具体的主题颜色
            iframe.contentWindow.postMessage({
                type: 'applyThemeColor',
                themeColor: themeColor
            }, '*');
        } catch (e) {
            console.error('Failed to post message to iframe:', e);
        }
    });
}

/**
 * 设置主题颜色并应用
 * @param {string} themeColor - 主题颜色值
 */
function setIntegratedThemeColor(themeColor) {
    localStorage.setItem('themeColor', themeColor);
    // 直接应用主题，不检查blessingid匹配
    applyIntegratedThemeColorDirect();
}

/**
 * 初始化集成页面主题系统
 */
function initIntegratedTheme() {
    // 立即应用主题，不等待页面完全加载
    applyIntegratedThemeColor();

    // 页面加载完成后再次应用主题，确保所有元素都已渲染
    if (document.readyState === 'loading') {
        window.addEventListener('load', applyIntegratedThemeColor);
    }

    // 监听主题变更事件
    window.addEventListener('themeChanged', () => {
        applyIntegratedThemeColor();
    });

    // 监听其他窗口发送的主题变更消息
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'applyThemeColor') {
            const themeColor = event.data.themeColor || localStorage.getItem('themeColor') || 'default';
            setIntegratedThemeColor(themeColor);
        }
    });

    // 监听页面跳转后的pageshow事件，确保主题正确应用
    window.addEventListener('pageshow', applyIntegratedThemeColor);
}

// 页面加载完成后初始化主题系统
document.addEventListener('DOMContentLoaded', function () {
    initIntegratedTheme();
});

// 导出函数供其他模块使用
window.applyIntegratedThemeColor = applyIntegratedThemeColor;
window.setIntegratedThemeColor = setIntegratedThemeColor;
window.initIntegratedTheme = initIntegratedTheme;
