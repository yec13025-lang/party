// 当前页面使用的字体
let currentFontFamily = 'yangrendong'; // 默认使用杨任东竹石体

// 确保fonts变量可用
const fonts = window.fonts || {};

// 动态加载字体函数
function loadFont(fontFamily) {
    if (!fontFamily) {
        currentFontFamily = 'yangrendong';
        return;
    }
    
    const fontConfig = fonts[fontFamily];
    if (!fontConfig) {
        console.warn(`Font ${fontFamily} not found, using default font.`);
        currentFontFamily = 'yangrendong';
        return;
    }
    
    currentFontFamily = fontFamily;
    
    // 检查字体是否已经加载
    if (document.getElementById(`font-${fontFamily}`)) {
        return; // 字体已加载
    }
    
    // 创建并添加 @font-face 规则
    const style = document.createElement('style');
    style.id = `font-${fontFamily}`;
    style.textContent = `
        @font-face {
            font-family: '${fontConfig.name}';
            src: url('${fontConfig.file}') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
    `;
    document.head.appendChild(style);
}

// 直接应用字体到所有相关元素
function applyFontDirectly(fontFamily) {
    // 获取实际字体名称
    const actualFont = (fonts[fontFamily] || fonts['yangrendong']).name;

    // 选择所有需要应用字体的元素
    const elements = document.querySelectorAll('.memory-content, .memory-content p, .sender-text, .sender-text p, .memory-audio-text, .memory-audio-text p, #blessingContent, #blessingContent p');

    // 直接设置每个元素的字体
    elements.forEach((element, index) => {

        // 直接设置 style 属性
        element.style.fontFamily = `'${actualFont}', cursive !important`;
        
        // 同时设置内联样式，确保最高优先级
        element.setAttribute('style', 
            (element.getAttribute('style') || '') + 
            `; font-family: '${actualFont}', cursive !important;`
        );
    });
}

// 应用字体到页面元素
function applyFont() {
    applyFontDirectly(currentFontFamily);
}

// 设置当前页面的字体
function setPageFont(fontFamily) {
    loadFont(fontFamily);
    applyFont();
}

// 动态更新全局字体样式
function updateGlobalFontStyle(fontFamily) {
    let styleElement = document.getElementById('global-font-style');
    
    // 如果元素不存在，创建一个
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'global-font-style';
        document.head.appendChild(styleElement);
    }
    
    // 获取字体配置
    const fontConfig = fonts[fontFamily] || fonts['yangrendong'];
    const fontName = fontConfig.name;

    // 动态生成所有字体的 @font-face 规则
    let fontFaceRules = '';
    for (const fontKey in fonts) {
        if (fonts.hasOwnProperty(fontKey)) {
            const font = fonts[fontKey];
            fontFaceRules += `
        /* ${font.displayName} */
        @font-face {
            font-family: '${font.name}';
            src: url('${font.file}') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }`;
        }
    }

    // 更新样式内容
    styleElement.textContent = `
        ${fontFaceRules}
        
        /* 应用到所有相关元素 */
        .memory-content,
        .memory-content p,
        .sender-text,
        .sender-text p,
        .memory-audio-text,
        .memory-audio-text p,
        #blessingContent,
        #blessingContent p
    `;
}

// 在页面加载完成后自动调用，确保字体能被正确应用
document.addEventListener('DOMContentLoaded', function() {
    const fontFamily = localStorage.getItem('fontFamily') || currentFontFamily;
    updateGlobalFontStyle(fontFamily);
    
    // 延迟1秒再次应用，确保内容加载完成
    setTimeout(() => {
        applyFontDirectly(fontFamily);
    }, 1000);
});

// 导出函数供其他模块使用
window.loadFont = loadFont;
window.applyFont = applyFont;
window.applyFontDirectly = applyFontDirectly;
window.setPageFont = setPageFont;
window.fonts = fonts;