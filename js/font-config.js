// 字体配置，统一管理所有字体信息
// 后续添加新字体只需在此处添加配置
window.fonts = {
    'yangrendong': {
        name: 'YangRenDongZhuShiTi-Semibold',
        displayName: '杨任东竹石体',
        file: '../fonts/YRDZSSemibold.ttf'
    },
    'jiayouya': {
        name: 'JiaYouYa',
        displayName: '加油鸭',
        file: '../fonts/今年也要加油鸭.ttf'
    },
    'hanchan': {
        name: 'HanChan',
        displayName: '寒蝉手拙体',
        file: '../fonts/ChillZhuo.ttf'
    },
    'pingfang': {
        name: 'PingFang',
        displayName: '平方洒脱体',
        file: '../fonts/平方洒脱体.ttf'
    },
    'qingsong': {
        name: 'QingSong',
        displayName: '清松手写体',
        file: '../fonts/清松手写体.ttf'
    },
    'xiaoke': {
        name: 'XiaoKe',
        displayName: '小可奶酪体',
        file: '../fonts/小可奶酪体.ttf'
    },
    'gangfengsong': {
        name: 'GangFengSong',
        displayName: '港风宋体',
        file: '../fonts/YeZiGongChangGangFengSong.ttf'
    },
    'hanyiyuan': {
        name: 'HanYiYuan',
        displayName: '汉仪圆体',
        file: '../fonts/HanyiBRTTQ.ttf'
    }
};

// 动态生成@font-face规则并应用到页面
window.loadSpecialFonts = function() {
    // 检查是否已经加载过字体
    if (document.getElementById('dynamic-fonts')) {
        return; // 字体已经加载过
    }
    
    // 创建样式元素
    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-fonts';
    
    // 生成@font-face规则
    let fontFaceRules = '';
    for (const [key, fontConfig] of Object.entries(window.fonts)) {
        fontFaceRules += `
            /* ${fontConfig.displayName} */
            @font-face {
                font-family: '${fontConfig.name}';
                src: url('${fontConfig.file}') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
        `;
    }
    
    // 设置样式内容
    styleElement.textContent = fontFaceRules;
    
    // 添加到文档头部
    document.head.appendChild(styleElement);
};

// 自动加载字体
if (typeof document !== 'undefined') {
    // 当DOM加载完成时自动加载字体
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.loadSpecialFonts);
    } else {
        window.loadSpecialFonts();
    }
}

// 导出字体配置（如果需要的话）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.fonts;
}