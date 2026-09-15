// region 通用工具
function isMobile() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function copyLinkAndOpen() {
    // 只复制链接，不弹出确认框
    const link = document.getElementById('result');
    if (!link) {
        showToast('⚠️ 当前页面不再展示链接区域，请在弹窗中复制');
        return;
    }
    let targetUrl = link.textContent;
    link.textContent = targetUrl;
    const textArea = document.createElement('textarea');
    textArea.value = targetUrl;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('✨ 链接已复制到剪贴板');
    } catch (err) {
        alert('⚠️ 复制失败，请手动复制');
    } finally {
        document.body.removeChild(textArea);
    }
}
// endregion

// region 二维码与海报（通用）
function drawRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

async function loadFonts() {
    return new Promise((resolve) => {
        try {
            createFontLoaderElement();
            if (document.fonts && typeof document.fonts.ready === 'object') {
                const font1 = new FontFace('YangRenDongZhuShiTi-Semibold', 'url(../fonts/YRDZSSemibold.ttf)', {weight: '600'});
                const font2 = new FontFace('BrushUpLife', 'url(../fonts/BrushUpLife.ttf)', {weight: 'normal'});
                document.fonts.add(font1);
                document.fonts.add(font2);
                const checkFonts = () => document.fonts.check('600 12px "YangRenDongZhuShiTi-Semibold"') && document.fonts.check('normal 12px "BrushUpLife"');
                if (checkFonts()) {
                    resolve();
                    return;
                }
                Promise.all([font1.load().catch(() => {
                }), font2.load().catch(() => {
                })]).then(() => resolve());
            }
            const timeoutId = setTimeout(() => {
                document.body.querySelectorAll('.temp-font-loader').forEach(el => el.remove());
                resolve();
            }, 2000);
            const checkInterval = setInterval(() => {
                if (document.fonts) {
                    const a = document.fonts.check('600 12px "YangRenDongZhuShiTi-Semibold"');
                    const b = document.fonts.check('normal 12px "BrushUpLife"');
                    if (a && b) {
                        clearInterval(checkInterval);
                        clearTimeout(timeoutId);
                        document.body.querySelectorAll('.temp-font-loader').forEach(el => el.remove());
                        resolve();
                    }
                }
            }, 200);
        } catch (e) {
            setTimeout(() => {
                document.body.querySelectorAll('.temp-font-loader').forEach(el => el.remove());
                resolve();
            }, 2000);
        }
    });

    function createFontLoaderElement() {
        const t1 = document.createElement('div');
        t1.className = 'temp-font-loader';
        t1.style.position = 'absolute';
        t1.style.visibility = 'hidden';
        t1.style.fontFamily = '"YangRenDongZhuShiTi-Semibold", Arial, sans-serif';
        t1.style.fontWeight = '600';
        t1.style.fontSize = '1px';
        t1.textContent = '测试生日快乐';
        document.body.appendChild(t1);
        const t2 = document.createElement('div');
        t2.className = 'temp-font-loader';
        t2.style.position = 'absolute';
        t2.style.visibility = 'hidden';
        t2.style.fontFamily = '"BrushUpLife", Arial, sans-serif';
        t2.style.fontSize = '1px';
        t2.textContent = 'Happy Birthday';
        document.body.appendChild(t2);
    }
}

function qrToDataURL(text, opts) {
    if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
        try {
            const maybePromise = window.QRCode.toDataURL(text, opts);
            if (maybePromise && typeof maybePromise.then === 'function') return maybePromise;
            return new Promise((resolve, reject) => {
                window.QRCode.toDataURL(text, opts, function (err, url) {
                    if (err) reject(err); else resolve(url);
                });
            });
        } catch (e) {
            return new Promise((resolve, reject) => {
                try {
                    window.QRCode.toDataURL(text, opts, function (err, url) {
                        if (err) reject(err); else resolve(url);
                    });
                } catch (err2) {
                    reject(err2);
                }
            });
        }
    }
    if (window.QRCode && typeof window.QRCode === 'function') {
        return new Promise((resolve, reject) => {
            try {
                const tmp = document.createElement('div');
                new window.QRCode(tmp, {
                    text,
                    width: (opts && opts.width) || 256,
                    height: (opts && opts.width) || 256,
                    colorDark: (opts && opts.color && opts.color.dark) || '#000000',
                    colorLight: (opts && opts.color && opts.color.light) || '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel && window.QRCode.CorrectLevel.H || 2
                });
                setTimeout(() => {
                    const canvas = tmp.querySelector('canvas');
                    const img = tmp.querySelector('img');
                    if (canvas) return resolve(canvas.toDataURL('image/png'));
                    if (img && img.src) return resolve(img.src);
                    reject(new Error('生成二维码失败'));
                }, 0);
            } catch (e) {
                reject(e);
            }
        });
    }
    return Promise.reject(new Error('未找到可用的二维码库'));
}

const POSTER_THEME_COLORS = {
    pink: {
        bgGradientStart: '#FFE8F0',
        bgGradientEnd: '#FFD6E3',
        dotColor: '#ff85a2',
        primaryColor: '#ff6b8b',
        secondaryColor: '#A54760',
        tagBgColor: 'rgba(255,107,139,0.35)'
    },
    yellow: {
        bgGradientStart: '#FED602',
        bgGradientEnd: '#FED602',
        dotColor: '#FFC107',
        primaryColor: '#FF9800',
        secondaryColor: '#F57C00',
        tagBgColor: 'rgba(255,152,0,0.35)'
    },
    blue: {
        bgGradientStart: '#E8F0FF',
        bgGradientEnd: '#D6E3FF',
        dotColor: '#85a2ff',
        primaryColor: '#6495ed',
        secondaryColor: '#4169e1',
        tagBgColor: 'rgba(100,149,237,0.35)'
    },
    red: {
        bgGradientStart: '#FFE8E8',
        bgGradientEnd: '#FFD6D6',
        dotColor: '#FF9999',
        primaryColor: '#A23025',
        secondaryColor: '#7a1e16',
        tagBgColor: 'rgba(162, 48, 37, 0.35)'
    },
    teal: {
        bgGradientStart: '#E8FFFB',
        bgGradientEnd: '#D6FFE3',
        dotColor: '#85ffdc',
        primaryColor: '#68C2B9',
        secondaryColor: '#3a9e93',
        tagBgColor: 'rgba(104, 194, 185, 0.35)'
    },
    green: {
        bgGradientStart: '#F0FFE8',
        bgGradientEnd: '#E3FFD6',
        dotColor: '#a2ff85',
        primaryColor: '#7CA32C',
        secondaryColor: '#537a14',
        tagBgColor: 'rgba(124, 163, 44, 0.35)'
    },
    orange: {
        bgGradientStart: '#FFF0E8',
        bgGradientEnd: '#FFE3D6',
        dotColor: '#ffc485',
        primaryColor: '#DE5B24',
        secondaryColor: '#a83b10',
        tagBgColor: 'rgba(222, 91, 36, 0.35)'
    },
    purple: {
        bgGradientStart: '#F0E8FF',
        bgGradientEnd: '#E3D6FF',
        dotColor: '#c485ff',
        primaryColor: '#BB4B5B',
        secondaryColor: '#882c3b',
        tagBgColor: 'rgba(187, 75, 91, 0.35)'
    },
    lemon: {
        bgGradientStart: '#FEF6C7',
        bgGradientEnd: '#FBE484',
        dotColor: '#FBE484',
        primaryColor: '#E6D260',
        secondaryColor: '#C8B340',
        tagBgColor: 'rgba(251, 228, 132, 0.35)'
    }
};

async function createPoster(url, senderName, celebrantName, themeColor = 'pink', showInlinePreview = true) {
    try {
        await loadFonts();
        const width = 1280, height = 720;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const colors = POSTER_THEME_COLORS[themeColor] || POSTER_THEME_COLORS.pink;
        const textFillColor = colors.primaryColor;
        const textStrokeColor = '#FFFFFF';
        const font = '600 72px "YangRenDongZhuShiTi-Semibold", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
        const secondaryFont = '28px "YangRenDongZhuShiTi-Semibold", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, colors.bgGradientStart);
        grad.addColorStop(1, colors.bgGradientEnd);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = colors.dotColor;
        [{x: 200, y: 160, r: 90}, {x: 420, y: 320, r: 60}, {x: 1080, y: 180, r: 80}, {x: 980, y: 520, r: 70}, {
            x: 300,
            y: 560,
            r: 100
        }].forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.primaryColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font;
        ctx.strokeStyle = textStrokeColor;
        ctx.lineWidth = 3;
        ctx.strokeText(`${celebrantName || 'Ta'}，生日快乐`, width / 2, 240);
        ctx.fillStyle = textFillColor;
        ctx.fillText(`${celebrantName || 'Ta'}，生日快乐`, width / 2, 240);
        ctx.fillStyle = colors.secondaryColor;
        ctx.font = secondaryFont;
        ctx.fillText('扫描右下角二维码，查看你的专属生日祝福', width / 2, 300);
        const qrSize = 260, padding = 40;
        const qrDataUrl = await qrToDataURL(url, {
            width: qrSize,
            margin: 1,
            color: {dark: colors.primaryColor, light: '#FFFFFF'}
        });
        const qrImg = new Image();
        const boxW = qrSize + 40, boxH = qrSize + 40, boxX = width - padding - boxW, boxY = height - padding - boxH;
        await new Promise(res => {
            qrImg.onload = res;
            qrImg.src = qrDataUrl;
        });
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(ctx, boxX, boxY, boxW, boxH, 16);
        ctx.fill();
        ctx.restore();
        ctx.drawImage(qrImg, boxX + 20, boxY + 20, qrSize, qrSize);
        ctx.textAlign = 'right';
        ctx.fillStyle = colors.primaryColor;
        ctx.font = '600 28px "YangRenDongZhuShiTi-Semibold", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
        ctx.fillText(`From ${senderName || 'Ta'}`, boxX + boxW, boxY - 24);
        const tagText = 'Happy Birthday';
        ctx.font = 'normal 28px "BrushUpLife", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
        const tagPaddingX = 20, tagPaddingY = 14;
        const metrics = ctx.measureText(tagText);
        const tagW = Math.ceil(metrics.width) + tagPaddingX * 2;
        const tagH = 64;
        const tagX = 40, tagY = 40;
        ctx.fillStyle = colors.tagBgColor;
        drawRoundRect(ctx, tagX, tagY, tagW, tagH, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.textAlign = 'left';
        ctx.strokeText(tagText, tagX + tagPaddingX, tagY + tagH / 2 + 2);
        ctx.fillText(tagText, tagX + tagPaddingX, tagY + tagH / 2 + 2);
        window.__posterDataUrl = canvas.toDataURL('image/png');
        if (showInlinePreview) {
            const img = document.getElementById('posterPreview');
            if (img) img.src = window.__posterDataUrl;
            const sec = document.getElementById('posterSection');
            if (sec) sec.style.display = 'block';
        }
        return window.__posterDataUrl;
    } catch (e) {
        console.error('贺卡海报生成失败', e);
        window.__posterDataUrl = null;
        return null;
    }
}

async function createPosterMobile(url, senderName, celebrantName, themeColor = 'pink', showInlinePreview = true) {
    try {
        await loadFonts();
        const width = 720, height = 1280;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const colors = POSTER_THEME_COLORS[themeColor] || POSTER_THEME_COLORS.pink;
        const textFillColor = colors.primaryColor;
        const textStrokeColor = '#FFFFFF';
        const defaultTitleFont = 'YangRenDongZhuShiTi-Semibold';
        const defaultSubFont = 'YangRenDongZhuShiTi-Semibold';
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, colors.bgGradientStart);
        grad.addColorStop(1, colors.bgGradientEnd);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        const scaleX = width / 720;
        const scaleY = height / 1280;
        const scaleMin = Math.min(scaleX, scaleY);
        const scale = scaleX;

        ctx.globalAlpha = 0.12;
        ctx.fillStyle = colors.dotColor;
        [{x: 120, y: 180, r: 80}, {x: 600, y: 260, r: 60}, {x: 540, y: 740, r: 90}, {x: 160, y: 980, r: 70}, {
            x: 420,
            y: 1120,
            r: 60
        }].forEach(b => {
            ctx.beginPath();
            ctx.arc(Math.round(b.x * scaleX), Math.round(b.y * scaleY), Math.round(b.r * scaleMin), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        const nameText = `${celebrantName || 'Ta'}`;
        const blessText = '生日快乐';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxTitleWidth = width - Math.round(96 * scale);
        let titleFontSize = Math.round(96 * scale);
        const minFontSize = Math.round(56 * scale);

        function applyTitleFont(size) {
            ctx.font = `600 ${size}px "${defaultTitleFont}", "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
        }

        applyTitleFont(titleFontSize);
        while (ctx.measureText(nameText).width > maxTitleWidth && titleFontSize > minFontSize) {
            titleFontSize -= 2;
            applyTitleFont(titleFontSize);
        }

        function shrinkWithEllipsis(dCtx, text, maxWidth) {
            let t = text;
            while (t.length > 0 && dCtx.measureText(t + '…').width > maxWidth) {
                t = t.slice(0, -1);
            }
            return t + (t.length < text.length ? '…' : '');
        }

        let displayName = nameText;
        if (ctx.measureText(displayName).width > maxTitleWidth) {
            displayName = shrinkWithEllipsis(ctx, nameText, maxTitleWidth);
        }
        const lineHeight = Math.round(titleFontSize * 2.0);
        const centerY = height / 2 - Math.round(80 * scaleY);
        const firstLineY = centerY - lineHeight / 2;
        const secondLineY = centerY + lineHeight / 2;
        ctx.fillStyle = textFillColor;
        applyTitleFont(titleFontSize);
        ctx.strokeStyle = textStrokeColor;
        ctx.lineWidth = Math.max(2, Math.round(titleFontSize / 28));
        ctx.strokeText(displayName, width / 2, firstLineY);
        ctx.fillText(displayName, width / 2, firstLineY);
        ctx.strokeText(blessText, width / 2, secondLineY);
        ctx.fillText(blessText, width / 2, secondLineY);

        const subText = '扫描右下角二维码，查看你的专属生日祝福';
        const maxSubWidth = width - Math.round(96 * scale);
        let subFontSize = Math.max(Math.round(titleFontSize * (30 / 96)), Math.round(20 * scale));

        function applySubFont(size) {
            ctx.font = `${size}px "${defaultSubFont}", "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
        }

        applySubFont(subFontSize);
        while (ctx.measureText(subText).width > maxSubWidth && subFontSize > Math.round(16 * scale)) {
            subFontSize -= 1;
            applySubFont(subFontSize);
        }
        ctx.fillStyle = colors.secondaryColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const subY = secondLineY + Math.round(lineHeight * 0.5) + Math.round(32 * scale);
        ctx.fillText(subText, width / 2, subY);

        const qrSize = Math.round(220 * scale);
        const padding = Math.round(32 * scale);
        const qrDataUrl = await qrToDataURL(url, {
            width: qrSize,
            margin: 1,
            color: {dark: colors.primaryColor, light: '#FFFFFF'}
        });
        const qrImg = new Image();
        const innerPad = Math.round(18 * scale);
        const boxW = qrSize + innerPad * 2;
        const boxH = qrSize + innerPad * 2;
        const boxX = width - padding - boxW;
        const boxY = height - padding - boxH;
        await new Promise(res => {
            qrImg.onload = res;
            qrImg.src = qrDataUrl;
        });
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = Math.round(12 * scaleMin);
        ctx.shadowOffsetY = Math.round(6 * scaleMin);
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(ctx, boxX, boxY, boxW, boxH, Math.max(8, Math.round(16 * scaleMin)));
        ctx.fill();
        ctx.restore();
        ctx.drawImage(qrImg, boxX + (boxW - qrSize) / 2, boxY + (boxH - qrSize) / 2, qrSize, qrSize);

        let accentFontSize = Math.max(Math.round(titleFontSize * (36 / 96)), Math.round(22 * scale));
        const fromText = `From ${senderName || 'Ta'}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = colors.primaryColor;

        function applyAccentFont(size) {
            ctx.font = `600 ${size}px "${defaultTitleFont}", "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
        }

        applyAccentFont(accentFontSize);
        const maxFromW = boxW + padding;
        while (ctx.measureText(fromText).width > maxFromW && accentFontSize > Math.round(18 * scale)) {
            accentFontSize -= 1;
            applyAccentFont(accentFontSize);
        }
        const fromGap = Math.max(Math.round(accentFontSize * 1.0), Math.round(20 * scale));
        ctx.fillText(fromText, boxX + boxW, boxY - fromGap);

        const tagText = 'Happy Birthday';
        ctx.font = `normal ${accentFontSize}px "BrushUpLife", "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;
        const tagPaddingX = Math.round(accentFontSize * (22 / 36));
        const metrics = ctx.measureText(tagText);
        const tagW = Math.ceil(metrics.width) + tagPaddingX * 2;
        const tagH = Math.round(accentFontSize * (70 / 36));
        const tagX = Math.round(24 * scale);
        const tagY = Math.round(24 * scale);
        ctx.fillStyle = colors.tagBgColor;
        drawRoundRect(ctx, tagX, tagY, tagW, tagH, Math.max(6, Math.round(12 * scaleMin)));
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.strokeText(tagText, tagX + tagPaddingX, tagY + tagH / 2 + 1);
        ctx.fillText(tagText, tagX + tagPaddingX, tagY + tagH / 2 + 1);
        window.__posterDataUrl = canvas.toDataURL('image/png');
        if (showInlinePreview) {
            const img = document.getElementById('posterPreview');
            if (img) img.src = window.__posterDataUrl;
            const sec = document.getElementById('posterSection');
            if (sec) sec.style.display = 'block';
        }
        return window.__posterDataUrl;
    } catch (e) {
        console.error('移动端贺卡海报生成失败', e);
        window.__posterDataUrl = null;
        return null;
    }
}

function downloadPoster() {
    if (!window.__posterDataUrl) return;
    
    // 检测是否为iOS设备
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        // iOS设备特殊处理：使用Canvas方式保存到相册
        showToast('请长按贺卡图片，选择\'保存到相册\'', 'info', 3000);
    } else {
        // 非iOS设备使用传统下载方式
        fallbackDownload();
    }
    
    // 传统下载方法
    function fallbackDownload() {
        const a = document.createElement('a');
        a.href = window.__posterDataUrl;
        a.download = `生日贺卡-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// endregion

// 祝福 ID 格式：字母、数字、下划线、连字符，1–64 位（兼容 happybirthday、loveconfession_origin 等）
var HB_BLESSING_ID_PATTERN = /^[\w-]{1,64}$/i;

function normalizeBlessingId(raw) {
    if (raw == null) return null;
    var id = String(raw).trim();
    return HB_BLESSING_ID_PATTERN.test(id) ? id : null;
}

// 提取blessingId的函数
function extractBlessingId(link) {
    if (!link) return null;
    var trimmed = String(link).trim();
    var direct = normalizeBlessingId(trimmed);
    if (direct) return direct;

    try {
        var url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
        var fromQuery = url.searchParams.get('blessingid') || url.searchParams.get('id');
        return normalizeBlessingId(fromQuery);
    } catch (e) {
        console.log('无效的URL格式');
    }

    return null;
}

// 转换Blob到Base64字符串的辅助函数
function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 转换文件到Base64字符串的辅助函数
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// region 通用事件绑定
(function bindSharedEvents() {
    document.addEventListener('DOMContentLoaded', function () {
        var copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyLinkAndOpen);
        }
    });
})();
// endregion


