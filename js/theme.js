/**
 * 主题颜色配置常量
 */
const THEME_COLORS = {
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
    pink: {
        primary: '#ee9ca7',
        secondary: '#ffdde1',
        rgba: 'rgba(238, 156, 167, 0.5)'
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
function setElementGradientBackground(element, themeColor, gradientType = 'top') {
    const colorConfig = THEME_COLORS[themeColor];
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
        // 统一使用一致的渐变方向和颜色，与CSS中定义的方向保持一致
        // 移除基础背景色设置，避免与渐变冲突
        // 直接设置所有渐变方向为一致的to bottom right
        element.style.background = `-webkit-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `-moz-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `-o-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        element.style.background = `-ms-linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        // 标准CSS渐变语法，与CSS文件中的定义保持一致
        element.style.background = `linear-gradient(to bottom right, ${primaryColor} 0%, ${secondaryColor} 100%)`;
    }
}

/**
 * 强制元素重绘以应用样式
 * @param {HTMLElement} element - 要重绘的元素
 */
function forceElementRepaint(element) {
    element.style.opacity = '0.99';
    setTimeout(() => {
        element.style.opacity = '1';
    }, 10);
}

/**
 * 应用主题颜色到页面
 */
function applyThemeColor() {
    // 从localStorage获取主题颜色
    const themeColor = localStorage.getItem('themeColor') || 'default';
    
    // 添加debug信息
    console.log('Applying theme color:', themeColor);
    
    // 获取html元素
    const htmlElement = document.documentElement;
    
    // 移除所有主题类
    htmlElement.classList.remove('theme-default', 'theme-blue', 'theme-red', 'theme-teal', 'theme-green', 'theme-orange', 'theme-purple');
    
    // 添加当前主题类到html元素
    if (Object.keys(THEME_COLORS).includes(themeColor)) {
        htmlElement.classList.add(`theme-${themeColor}`);
    } else {
        htmlElement.classList.add('theme-default');
    }
    
    // 特别处理automation页面的主题应用
    if (window.location.pathname.includes('automation.html')) {
        // 强制添加body--ready类，确保主题样式应用
        document.body.classList.add('body--ready');
        console.log('Added body--ready class to automation page');
        
        // 设置主题背景
        setElementGradientBackground(document.body, themeColor, 'top');
        
        // 强制重绘，确保主题样式正确应用
        forceElementRepaint(document.body);
    }
    
    // 特别处理birthdaycake页面的主题应用
    if (window.location.pathname.includes('birthdaycake.html')) {
        // 强制添加bg类，确保主题样式应用
        document.body.classList.add('bg');
        console.log('Added bg class to birthdaycake page');
        
        // 设置主题背景
        setElementGradientBackground(document.body, themeColor, 'topLeft');
        
        // 强制重绘，确保主题样式正确应用
        forceElementRepaint(document.body);
    }
    
    // 确保wrapper类存在于login页面
    if (window.location.pathname.includes('login.html')) {
        const wrapper = document.querySelector('.wrapper');
        if (wrapper) {
            // 直接设置内联样式，覆盖CSS中可能存在的硬编码样式
            if (Object.keys(THEME_COLORS).includes(themeColor)) {
                setElementGradientBackground(wrapper, themeColor, 'topLeft');
            } else {
                wrapper.style.background = '';
                wrapper.style.background = '';
                wrapper.style.background = '';
            }
            
            // 强制重绘，确保主题样式正确应用
            forceElementRepaint(wrapper);
        }
    }
    
    // 如果是播放器页面，确保html元素添加了正确的主题类，然后让CSS处理样式
    if (window.location.pathname.includes('player.html')) {
        // 确保主题类已经添加到html元素
        // 样式将通过theme.css中的.theme-blue和.theme-default类自动应用
        const themeColor = localStorage.getItem('themeColor') || 'default';
        
        // 清除之前可能设置的内联样式，让CSS完全控制样式
        const progressBar = document.querySelector('.progress');
        const progressArea = document.querySelector('.progress-bar');
        const controlBtns = document.querySelectorAll('.control-btn');
        const playPauseBtn = document.querySelector('.play-pause');
        
        if (progressBar) {
            progressBar.style.background = '';
        }
        if (progressArea) {
            progressArea.style.background = '';
        }
        if (playPauseBtn) {
            playPauseBtn.style.backgroundColor = '';
            playPauseBtn.style.boxShadow = '';
        }
        controlBtns.forEach(btn => {
            btn.style.color = '';
            btn.onmouseover = null;
            btn.onmouseout = null;
        });
        
        // 强制重绘以应用CSS样式
        forceElementRepaint(document.body);
        return;
    }
    
    // 特别处理memories页面的主题应用
    if (window.location.pathname.includes('memories.html')) {
        const scrollTip = document.getElementById('scrollTip');
        const contentElement = document.querySelector('.ly-txt84-content');
        
        // 确保scrollTip元素显示正确
        if (scrollTip) {
            scrollTip.style.zIndex = '1000';
            scrollTip.style.display = 'block';
            scrollTip.style.opacity = '1';
        }
        
        // 强制元素重绘，确保主题样式正确应用
        if (contentElement) {
            forceElementRepaint(contentElement);
        }
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
 * @param {string} themeColor - 主题颜色值 ('default', 'blue', 'red', 'teal', 'green', 'orange', 'purple')
 */
function setThemeColor(themeColor) {
    localStorage.setItem('themeColor', themeColor);
    applyThemeColor();
}

/**
 * 初始化主题系统
 */
function initTheme() {
    // 立即应用主题，不等待页面完全加载
    applyThemeColor();
    
    // 页面加载完成后再次应用主题，确保所有元素都已渲染
    if (document.readyState === 'loading') {
        window.addEventListener('load', applyThemeColor);
    }
    
    // 监听主题变更事件
    window.addEventListener('themeChanged', () => {
        applyThemeColor();
    });
    
    // 监听其他窗口发送的主题变更消息
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'applyThemeColor') {
            const themeColor = event.data.themeColor || localStorage.getItem('themeColor') || 'default';
            setThemeColor(themeColor);
        }
    });
    
    // 监听页面跳转后的pageshow事件，确保主题正确应用
    window.addEventListener('pageshow', applyThemeColor);
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applyThemeColor,
        setThemeColor,
        initTheme
    };
}