/**
 * 集成页面动画控制系统
 * 基于原始indexl.js的动画逻辑
 */

// 动画系统变量
let S = {
    currentScreen: 2, // 跟踪当前屏幕
    animationLoopId: null, // 存储动画循环ID
    
    init: function () {
        
        S.Drawing.init('.animation-canvas');
        document.body.classList.add('body--ready');
        
        // 获取用户名并开始动画
        var userName = localStorage.getItem('userName');
        var animationText;
        if (userName) {
            animationText = 'Hi ' + userName + '|祝你|生日快乐|Happy Birthday|#countdown 3';
        } else {
            animationText = 'Hi 宝宝|祝你|生日快乐|Happy Birthday|#countdown 3';
        }
        S.UI.simulate(animationText);
        
        S.startAnimationLoop();
    },
    
    startAnimationLoop: function() {
        // 清除之前的循环
        if (S.animationLoopId) {
            cancelAnimationFrame(S.animationLoopId);
        }
        
        function loop() {
            // 只在第二屏时继续动画
            if (S.currentScreen === 2) {
                // 检查S.Drawing是否已初始化
                if (S.Drawing && S.Drawing.clearFrame) {
                    S.Drawing.clearFrame();
                }
                S.Shape.render();
                if (S.UI.getIsSimulateDone()) {
                }
                S.animationLoopId = requestAnimationFrame(loop);
            }
        }
        
        S.animationLoopId = requestAnimationFrame(loop);
    },
    
    stopAnimationLoop: function() {
        if (S.animationLoopId) {
            cancelAnimationFrame(S.animationLoopId);
            S.animationLoopId = null;
        }
    },
    
    setCurrentScreen: function(screenNumber) {
        S.currentScreen = screenNumber;
        if (screenNumber === 2) {
            // 切换到第二屏时重新开始动画
            S.startAnimationLoop();
        } else {
            // 切换到其他屏幕时停止动画
            S.stopAnimationLoop();
        }
    }
};

// 绘图系统
S.Drawing = (function () {
    var canvas,
        context,
        renderFn,
        requestFrame = window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };

    return {
        init: function (el) {
            canvas = document.querySelector(el);
            if (!canvas) {
                return;
            }
            context = canvas.getContext('2d');
            this.adjustCanvas();

            window.addEventListener('resize', function (e) {
                S.Drawing.adjustCanvas();
            });
        },

        loop: function (fn) {
            renderFn = !renderFn ? fn : renderFn;
            this.clearFrame();
            renderFn();
            // 不再自动循环，由外部控制
        },

        adjustCanvas: function () {
            // 移动端模糊问题彻底解决方案
            var rect = canvas.getBoundingClientRect();
            var dpr = window.devicePixelRatio || 1;
            
            if (rect.width < 768) {
                // 移动端：强制高DPI处理，解决模糊问题
                var actualWidth = rect.width * dpr;
                var actualHeight = rect.height * dpr;
                
                // 设置Canvas实际像素尺寸（高DPI）
                canvas.width = actualWidth;
                canvas.height = actualHeight;
                
                // 设置CSS显示尺寸（逻辑像素）
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                
                // 缩放context以匹配DPI
                context.scale(dpr, dpr);
                
                // 移动端高质量渲染设置
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.textRenderingOptimization = 'optimizeQuality';
                
                // 移动端抗锯齿优化
                context.textBaseline = 'middle';
                context.textAlign = 'center';
            } else {
                // PC端：使用完整DPI优化
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                context.scale(dpr, dpr);
                
                // PC端高质量渲染
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.textRenderingOptimization = 'optimizeQuality';
                
            }
        },

        clearFrame: function () {
            if (context && canvas) {
                // 关键：使用逻辑坐标，因为context已经scale(dpr, dpr)
                var dpr = window.devicePixelRatio || 1;
                var logicalWidth = canvas.width / dpr;
                var logicalHeight = canvas.height / dpr;
                context.clearRect(0, 0, logicalWidth, logicalHeight);
            }
        },

        getArea: function () {
            // 返回逻辑尺寸，因为粒子使用逻辑坐标
            var dpr = window.devicePixelRatio || 1;
            return {
                w: canvas.width / dpr, 
                h: canvas.height / dpr
            };
        },

        drawCircle: function (p, c) {
            // 粒子坐标已经是逻辑坐标，context已经scale，直接绘制即可
            context.fillStyle = c.render();
            context.beginPath();
            context.arc(p.x, p.y, p.z, 0, 2 * Math.PI, true);
            context.closePath();
            context.fill();
        }
    }
}());

// UI控制系统
S.UI = (function () {
    var input = document.querySelector('.ui-input'),
        ui = document.querySelector('.animation-ui'),
        help = document.querySelector('.animation-help'),
        commands = document.querySelector('.commands'),
        overlay = document.querySelector('.animation-overlay'),
        canvas = document.querySelector('.animation-canvas'),
        interval,
        isTouch = false,
        currentAction,
        resizeTimer,
        time,
        maxShapeSize = 30,
        firstAction = true,
        sequence = [],
        cmd = '#',
        isSimulateDone = false;

    function formatTime(date) {
        var h = date.getHours(),
            m = date.getMinutes();
        m = m < 10 ? '0' + m : m;
        return h + ':' + m;
    }

    function getValue(value) {
        return value && value.split(' ')[1];
    }

    function getIsSimulateDone() {
        return isSimulateDone;
    }

    function getAction(value) {
        value = value && value.split(' ')[0];
        return value && value[0] === cmd && value.substring(1);
    }

    function timedAction(fn, delay, max, reverse) {
        clearInterval(interval);
        currentAction = reverse ? max : 1;
        fn(currentAction);

        if (!max || (!reverse && currentAction < max) || (reverse && currentAction > 0)) {
            interval = setInterval(function () {
                currentAction = reverse ? currentAction - 1 : currentAction + 1;
                fn(currentAction);

                if ((!reverse && max && currentAction === max) || (reverse && currentAction === 0)) {
                    clearInterval(interval);
                }
            }, delay);
        }
    }

    function reset(destroy) {
        clearInterval(interval);
        sequence = [];
        time = null;
        destroy && S.Shape.switchShape(S.ShapeBuilder.letter(''));
    }

    function performAction(value) {
        var action,
            current;

        if (overlay) {
            overlay.classList.remove('animation-overlay--visible');
        }
        sequence = typeof (value) === 'object' ? value : sequence.concat(value.split('|'));
        
        if (input) {
            input.value = '';
            checkInputWidth();
        }

        timedAction(function (index) {
            current = sequence.shift();
            action = getAction(current);
            value = getValue(current);

            switch (action) {
                case 'countdown':
                    value = parseInt(value) || 10;
                    value = value > 0 ? value : 10;
                    const delay = value === 1 ? 0 : 1000;

                    timedAction(function (index) {
                        if (index === 0) {
                            if (sequence.length === 0) {
                                S.Shape.switchShape(S.ShapeBuilder.letter(''));
                                isSimulateDone = true;
                            } else {
                                performAction(sequence);
                            }
                        } else {
                            S.Shape.switchShape(S.ShapeBuilder.letter(index), true);
                        }
                    }, delay, value, true);
                    break;

                case 'rectangle':
                    value = value && value.split('x');
                    value = (value && value.length === 2) ? value : [maxShapeSize, maxShapeSize / 2];

                    S.Shape.switchShape(S.ShapeBuilder.rectangle(Math.min(maxShapeSize, parseInt(value[0])), Math.min(maxShapeSize, parseInt(value[1]))));
                    break;

                case 'circle':
                    value = parseInt(value) || maxShapeSize;
                    value = Math.min(value, maxShapeSize);
                    S.Shape.switchShape(S.ShapeBuilder.circle(value));
                    break;

                case 'time':
                    var t = formatTime(new Date());

                    if (sequence.length > 0) {
                        S.Shape.switchShape(S.ShapeBuilder.letter(t));
                    } else {
                        timedAction(function () {
                            t = formatTime(new Date());
                            if (t !== time) {
                                time = t;
                                S.Shape.switchShape(S.ShapeBuilder.letter(time));
                            }
                        }, 1000);
                    }
                    break;

                default:
                    S.Shape.switchShape(S.ShapeBuilder.letter(current[0] === cmd ? 'What?' : current));
            }
        }, 2000, sequence.length);
    }

    function checkInputWidth(e) {
        if (!input || !ui) return;
        
        if (input.value.length > 18) {
            ui.classList.add('ui--wide');
        } else {
            ui.classList.remove('ui--wide');
        }

        if (firstAction && input.value.length > 0) {
            ui.classList.add('ui--enter');
        } else {
            ui.classList.remove('ui--enter');
        }
    }

    function bindEvents() {
        if (!document.body) return;
        
        document.body.addEventListener('keydown', function (e) {
            if (input) {
                input.focus();

                if (e.keyCode === 13) {
                    firstAction = false;
                    reset();
                    performAction(input.value);
                }
            }
        });

        if (input) {
            input.addEventListener('input', checkInputWidth);
            input.addEventListener('change', checkInputWidth);
            input.addEventListener('focus', checkInputWidth);
        }

        if (help) {
            help.addEventListener('click', function (e) {
                if (overlay) {
                    overlay.classList.toggle('animation-overlay--visible');
                    overlay.classList.contains('animation-overlay--visible') && reset(true);
                }
            });
        }

        if (commands) {
            commands.addEventListener('click', function (e) {
                var el,
                    info,
                    demo,
                    tab,
                    active,
                    url;

                if (e.target.classList.contains('commands-item')) {
                    el = e.target;
                } else {
                    el = e.target.parentNode.classList.contains('commands-item') ? e.target.parentNode : e.target.parentNode.parentNode;
                }

                info = el && el.querySelector('.commands-item-info');
                demo = el && info.getAttribute('data-demo');
                url = el && info.getAttribute('data-url');

                if (info) {
                    if (overlay) {
                        overlay.classList.remove('animation-overlay--visible');
                    }

                    if (demo) {
                        if (input) {
                            input.value = demo;
                        }

                        if (isTouch) {
                            reset();
                            performAction(demo);
                        } else {
                            if (input) {
                                input.focus();
                            }
                        }
                    } else if (url) {
                        // 处理URL跳转
                    }
                }
            });
        }

        if (canvas) {
            canvas.addEventListener('click', function (e) {
                if (overlay) {
                    overlay.classList.remove('animation-overlay--visible');
                }
            });
        }
    }

    function init() {
        bindEvents();
        if (input) {
            input.focus();
        }
        isTouch && document.body.classList.add('touch');
    }

    // 初始化
    init();

    return {
        simulate: function (action) {
            isSimulateDone = false;
            performAction(action);
        },
        getIsSimulateDone: function () {
            return getIsSimulateDone();
        }
    }
}());

// 形状构建器
S.ShapeBuilder = (function () {
    // 根据屏幕尺寸动态调整gap，确保移动端有足够的粒子
    var baseGap = 13,
        gap = baseGap,
        shapeCanvas = document.createElement('canvas'),
        shapeContext = shapeCanvas.getContext('2d'),
        fontSize = 500,
        fontFamily = 'Microsoft, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif';

    function fit() {
        // 使用getBoundingClientRect获取准确尺寸
        var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        
        // 移动端和PC端统一使用高DPI处理，确保清晰度
        if (rect.width < 768) {
            gap = 4; // 移动端使用适中gap
        } else {
            gap = baseGap; // PC端使用baseGap
        }
        
        // 计算逻辑尺寸
        var logicalWidth = Math.floor(rect.width / gap) * gap;
        var logicalHeight = Math.floor(rect.height / gap) * gap;
        
        // 设置Canvas实际像素尺寸（高DPI）
        shapeCanvas.width = logicalWidth * dpr;
        shapeCanvas.height = logicalHeight * dpr;
        
        // 设置CSS显示尺寸（逻辑像素）
        shapeCanvas.style.width = logicalWidth + 'px';
        shapeCanvas.style.height = logicalHeight + 'px';
        
        // 缩放context以匹配DPI
        shapeContext.scale(dpr, dpr);
        
        // 设置高质量渲染
        shapeContext.imageSmoothingEnabled = true;
        shapeContext.imageSmoothingQuality = 'high';
        shapeContext.textRenderingOptimization = 'optimizeQuality';
        
        shapeContext.fillStyle = 'red';
        shapeContext.textBaseline = 'middle';
        shapeContext.textAlign = 'center';
        
    }

    function processCanvas() {
        var dpr = window.devicePixelRatio || 1;
        var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
        
        // 关键：从高DPI Canvas获取像素数据
        var pixels = shapeContext.getImageData(0, 0, shapeCanvas.width, shapeCanvas.height).data;
        
        // 使用实际gap（考虑DPI）
        var actualGap = Math.round(gap * dpr);
        
        dots = [];
        var x, y,  // 在循环中使用
            fx = shapeCanvas.width,
            fy = shapeCanvas.height,
            w = 0,
            h = 0;


        // 正确的像素遍历逻辑
        for (y = 0; y < shapeCanvas.height; y += actualGap) {
            for (x = 0; x < shapeCanvas.width; x += actualGap) {
                var p = (y * shapeCanvas.width + x) * 4;
                
                if (pixels[p + 3] > 0) {
                    // 坐标转换回逻辑坐标（除以DPI）
                    dots.push(new S.Point({
                        x: x / dpr,
                        y: y / dpr
                    }));

                    w = x > w ? x : w;
                    h = y > h ? y : h;
                    fx = x < fx ? x : fx;
                    fy = y < fy ? y : fy;
                }
            }
        }

        
        // 返回逻辑坐标
        return {
            dots: dots, 
            w: (w + fx) / dpr, 
            h: (h + fy) / dpr
        };
    }

    function setFontSize(s, text) {
        // 根据屏幕尺寸和文字内容统一调整字体大小
        var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
        var screenWidth = rect.width;
        var screenHeight = rect.height;
        var adjustedSize;
        
        // 针对不同文字内容的统一逻辑
        if (text === '3' || text === '2' || text === '1' || text === 3 || text === 2 || text === 1) {
            // 倒计时数字：移动端使用较小字体
            if (screenWidth < 768) {
                // 移动端：缩小字体
                adjustedSize = Math.min(screenWidth * 0.35, screenHeight * 0.35, s);
                adjustedSize = Math.max(adjustedSize, 60); // 移动端最小60px
            } else {
                // PC端：使用超大字体
                adjustedSize = Math.min(screenWidth * 0.5, screenHeight * 0.5, s) + 10;
                adjustedSize = Math.max(adjustedSize, 110);
            }
        } else if (text === '生日快乐') {
            // 生日快乐：根据屏幕宽度的比例设置，并调大10px
            adjustedSize = Math.min(screenWidth * 0.25, screenHeight * 0.3, s) + 10;
        } else if (text === 'Happy Birthday') {
            // Happy Birthday：稍小比例以确保完整显示
            adjustedSize = Math.min(screenWidth * 0.18, screenHeight * 0.25, s);
        } else if (typeof text === 'string' && text.startsWith('Hi ')) {
            // Hi 寿星名称：移动端使用较小字体
            if (screenWidth < 768) {
                // 移动端：缩小字体比例
                adjustedSize = Math.min(screenWidth * 0.12, screenHeight * 0.2, s);
                adjustedSize = Math.max(adjustedSize, 30); // 移动端最小30px
            } else {
                // PC端：与"祝你"保持一致的字体大小
                adjustedSize = Math.min(screenWidth * 0.22, screenHeight * 0.3, s) + 10;
            }
        } else if (text === '祝你') {
            // 祝你：使用较大字体，并调大10px
            adjustedSize = Math.min(screenWidth * 0.22, screenHeight * 0.3, s) + 10;
        } else if (text === '你好') {
            // 你好：与"祝你"保持相同的字体大小
            adjustedSize = Math.min(screenWidth * 0.22, screenHeight * 0.3, s) + 10;
        } else {
            // 其他文字：根据长度计算，对于字数固定的2-5文字，自动计算最合适字体大小
            var textLength = typeof text === 'string' ? text.length : 10;
            if (textLength >= 2 && textLength <= 5) {
                // 2-5个字符的固定文字，结合屏幕大小自动计算最合适的字体大小
                adjustedSize = Math.min(screenWidth * 0.25 / (textLength * 0.3), screenHeight * 0.4, s);
            } else if (textLength <= 4) {
                adjustedSize = Math.min(screenWidth * 0.20, s);
            } else if (textLength <= 8) {
                adjustedSize = Math.min(screenWidth * 0.15, s);
            } else {
                adjustedSize = Math.min(screenWidth * 0.10, s);
            }
        }
        
        // 确保字体大小在合理范围内，防止太小导致模糊
        adjustedSize = Math.max(adjustedSize, 40); // 保持最小字体大小到40px
        adjustedSize = Math.min(adjustedSize, 300); // 最大字体大小300px
        
        // 字体大小不需要额外DPI缩放，因为context已经缩放了
        shapeContext.font = 'bold ' + adjustedSize + 'px ' + fontFamily;
        
        // 设置高质量文本渲染
        shapeContext.imageSmoothingEnabled = true;
        shapeContext.imageSmoothingQuality = 'high';
        shapeContext.textRenderingOptimization = 'optimizeQuality';
        shapeContext.textBaseline = 'middle';
        shapeContext.textAlign = 'center';
    }

    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function init() {
        fit();
        window.addEventListener('resize', fit);
    }

    // 初始化
    init();

    return {
        imageFile: function (url, callback) {
            var image = new Image(),
                a = S.Drawing.getArea();
            var dpr = window.devicePixelRatio || 1;
            var logicalWidth = shapeCanvas.width / dpr;
            var logicalHeight = shapeCanvas.height / dpr;

            image.onload = function () {
                // 使用逻辑坐标，因为context已经scale(dpr, dpr)
                shapeContext.clearRect(0, 0, logicalWidth, logicalHeight);
                shapeContext.drawImage(this, 0, 0, a.h * 0.6, a.h * 0.6);
                callback(processCanvas());
            };

            image.onerror = function () {
                callback(S.ShapeBuilder.letter('What?'));
            }

            image.src = url;
        },

        circle: function (d) {
            var dpr = window.devicePixelRatio || 1;
            var logicalWidth = shapeCanvas.width / dpr;
            var logicalHeight = shapeCanvas.height / dpr;
            var r = Math.max(0, d) / 2;
            
            // 使用逻辑坐标，因为context已经scale(dpr, dpr)
            shapeContext.clearRect(0, 0, logicalWidth, logicalHeight);
            shapeContext.beginPath();
            shapeContext.arc(r * gap, r * gap, r * gap, 0, 2 * Math.PI, false);
            shapeContext.fill();
            shapeContext.closePath();

            return processCanvas();
        },

        letter: function (l) {
            // 先调用fit函数设置基础gap
            fit();
            
            // 获取屏幕尺寸和DPI信息
            var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
            var dpr = window.devicePixelRatio || 1;
            var logicalWidth = shapeCanvas.width / dpr;
            var logicalHeight = shapeCanvas.height / dpr;
            
            // 为不同文字内容设置不同的基础字体大小
            var baseFontSize;
            
            // 统一移动端和PC端的基础字体大小计算
            if (l === '3' || l === '2' || l === '1' || l === 3 || l === 2 || l === 1) {
                // 倒计时数字：移动端使用较小字体
                if (rect.width < 768) {
                    baseFontSize = rect.width * 0.35; // 移动端缩小
                } else {
                    baseFontSize = rect.width * 0.5; // PC端保持原大小
                }
            } else if (l === '生日快乐') {
                // 生日快乐
                baseFontSize = rect.width * 0.25;
            } else if (l === 'Happy Birthday') {
                // Happy Birthday
                baseFontSize = rect.width * 0.18;
            } else if (typeof l === 'string' && l.startsWith('Hi ')) {
                // Hi 寿星名称：与"祝你"保持一致的基础大小
                baseFontSize = rect.width * 0.22;
            } else if (l === '祝你') {
                // 祝你
                baseFontSize = rect.width * 0.22;
            } else {
                // 其他文字
                var textLength = typeof l === 'string' ? l.length : 10;
                if (textLength >= 2 && textLength <= 5) {
                    // 2-5个字符的固定文字，结合屏幕大小自动计算最合适的字体大小
                    baseFontSize = Math.min(rect.width * 0.25 / (textLength * 0.3), rect.height * 0.4);
                } else if (textLength <= 4) {
                    baseFontSize = rect.width * 0.20;
                } else if (textLength <= 8) {
                    baseFontSize = rect.width * 0.15;
                } else {
                    baseFontSize = rect.width * 0.10;
                }
            }
            
            // 设置初始字体大小
            setFontSize(baseFontSize, l);
            
            // 关键：因为context已经scale(dpr, dpr)，所以clearRect需要使用逻辑坐标
            shapeContext.clearRect(0, 0, logicalWidth, logicalHeight);
            
            // 设置文字颜色为纯红色，确保可见
            shapeContext.fillStyle = 'red';
            
            // 文字居中设置
            var textX = logicalWidth / 2;
            
            // 特殊处理Hi开头的文字，严格按照用户要求进行渲染
            if (typeof l === 'string' && l.startsWith('Hi ')) {
                // 检测是否为移动端（屏幕宽度小于768px）
                const isMobile = window.innerWidth < 768;
                
                // 根据设备类型设置字体大小，与"祝你"保持一致的比例
                let fontSize;
                if (isMobile) {
                    // 移动端：限制最大字体大小为60px，缩小比例
                    fontSize = Math.min(rect.width * 0.15, 60);
                } else {
                    // PC端：限制最大字体大小为250px
                    fontSize = Math.min(rect.width * 0.22, 250);
                }
                
                // 去掉"Hi "，获取寿星名称
                var namePart = l.substring(3); // 去掉"Hi "
                
                // 如果是PC端且寿星姓名大于10个字，将字体大小改为当前的0.75倍
                if (!isMobile && namePart.length > 10) {
                    fontSize = fontSize * 0.75;
                }
                
                // 设置字体
                shapeContext.font = 'bold ' + fontSize + 'px ' + fontFamily;
                shapeContext.textBaseline = 'middle';
                shapeContext.textAlign = 'center';
                
                // 定义Hi文本
                var hiText = "Hi";
                
                // 检测是否是英文字符串
                var isEnglishName = /^[a-zA-Z\s]+$/.test(namePart);
                var englishLineLength = 6; // 英文按6个字符换行
                var chineseLineLength = 3; // 中文按3个字符换行
                var lineLength = isEnglishName ? englishLineLength : chineseLineLength;
                
                // 构建行数组，实现新的换行规则：
                // 英文：按6个字符换行；中文：按3个字符换行
                const lines = [hiText];
                
                if (namePart.length > lineLength) {
                    // 名字部分超过阈值字符，需要按指定长度一行拆分
                    // 先将Hi和前N个字符放在同一行
                    lines[0] = hiText + " " + namePart.substring(0, lineLength);
                    
                    // 剩余的名字部分按每N个字符一行拆分
                    for (let i = lineLength; i < namePart.length; i += lineLength) {
                        lines.push(namePart.substring(i, i + lineLength));
                    }
                } else if (namePart.length > 0) {
                    // 名字长度不超过阈值字符时，与"Hi"在同一行
                    lines[0] = hiText + " " + namePart;
                }
                
                // 设置行高和计算起始位置
                const lineHeight = fontSize * 1.2; // 行高为字体大小的1.2倍
                const totalLines = lines.length;
                const totalHeight = lineHeight * totalLines;
                // 计算起始Y位置，使整个文本块垂直居中
                const startY = logicalHeight / 2 - totalHeight / 2 + fontSize / 2;
                
                // 逐行绘制文本
                for (let i = 0; i < lines.length; i++) {
                    const currentY = startY + (i * lineHeight);
                    shapeContext.fillText(lines[i], textX, currentY);
                }
            } else {
                // 其他文字：根据实际宽度调整字体大小以防止溢出
                var maxWidth = logicalWidth * 0.85;
                var textWidth = shapeContext.measureText(l).width;
                var currentFontSize = baseFontSize;
                
                // 动态调整字体大小，确保不溢出且不过小
                while (textWidth > maxWidth && currentFontSize > 40) {
                    currentFontSize *= 0.9;
                    setFontSize(currentFontSize, l);
                    textWidth = shapeContext.measureText(l).width;
                }
                
                // 确保字体不太小
                if (currentFontSize < 40) {
                    setFontSize(40, l);
                }
                
                // 绘制文字
                var textY = logicalHeight / 2;
                shapeContext.fillText(l, textX, textY);
            }
            
            return processCanvas();
        },

        rectangle: function (w, h) {
            var dots = [],
                width = gap * w,
                height = gap * h;

            for (var y = 0; y < height; y += gap) {
                for (var x = 0; x < width; x += gap) {
                    dots.push(new S.Point({
                        x: x,
                        y: y,
                    }));
                }
            }

            return {dots: dots, w: width, h: height};
        }
    };
}());

// 形状控制系统
S.Shape = (function () {
    var dots = [],
        width = 0,
        height = 0,
        cx = 0,
        cy = 0;

    function compensate() {
        var a = S.Drawing.getArea();

        cx = a.w / 2 - width / 2;
        cy = a.h / 2 - height / 2;
    }

    return {
        shuffleIdle: function () {
            var a = S.Drawing.getArea();

            for (var d = 0; d < dots.length; d++) {
                if (!dots[d].s) {
                    dots[d].move({
                        x: Math.random() * a.w,
                        y: Math.random() * a.h
                    });
                }
            }
        },

        switchShape: function (n, fast) {
            var size,
                a = S.Drawing.getArea();

            width = n.w;
            height = n.h;

            compensate();

            if (n.dots.length > dots.length) {
                size = n.dots.length - dots.length;
                for (var d = 1; d <= size; d++) {
                    dots.push(new S.Dot(a.w / 2, a.h / 2));
                }
            }

            var d = 0,
                i = 0;

            while (n.dots.length > 0) {
                i = Math.floor(Math.random() * n.dots.length);
                dots[d].e = fast ? 0.25 : (dots[d].s ? 0.14 : 0.11);

                if (dots[d].s) {
                    // 根据屏幕尺寸调整粒子大小
                    var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
                    var particleSize;
                    
                    if (rect.width < 768) {
                        // 移动端：更小粒子，确保更清晰的间隙
                        particleSize = Math.random() * 2 + 1;
                    } else {
                        // PC端：保持原有大小
                        particleSize = Math.random() * 20 + 10;
                    }
                    
                    dots[d].move(new S.Point({
                        z: particleSize,
                        a: Math.random(),
                        h: 18
                    }));
                } else {
                    // 根据屏幕尺寸调整粒子大小
                    var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
                    var particleSize;
                    
                    if (rect.width < 768) {
                        // 移动端：更小粒子，确保更清晰的间隙
                        particleSize = Math.random() * 1.5 + 0.5;
                    } else {
                        // PC端：保持原有大小
                        particleSize = Math.random() * 5 + 5;
                    }
                    
                    dots[d].move(new S.Point({
                        z: particleSize,
                        h: fast ? 18 : 30
                    }));
                }

                dots[d].s = true;
                dots[d].move(new S.Point({
                    x: n.dots[i].x + cx,
                    y: n.dots[i].y + cy,
                    a: 1,
                    z: rect.width < 768 ? 1.5 : 5, // 移动端更小粒子，PC端保持原大小
                    h: 0
                }));

                n.dots = n.dots.slice(0, i).concat(n.dots.slice(i + 1));
                d++;
            }

            for (var i = d; i < dots.length; i++) {
                // 根据屏幕尺寸调整消散粒子大小
                var rect = document.querySelector('.animation-canvas').getBoundingClientRect();
                
                if (dots[i].s) {
                    var particleSize = rect.width < 768 ? 
                        Math.random() * 2 + 1 : // 移动端更小粒子，确保清晰间隙
                        Math.random() * 20 + 10; // PC端保持原大小
                    
                    dots[i].move(new S.Point({
                        z: particleSize,
                        a: Math.random(),
                        h: 20
                    }));

                    dots[i].s = false;
                    dots[i].e = 0.04;
                    
                    var finalParticleSize = rect.width < 768 ? 
                        Math.random() * 1.5 : // 移动端更小粒子
                        Math.random() * 4; // PC端保持原大小
                    
                    dots[i].move(new S.Point({
                        x: Math.random() * a.w,
                        y: Math.random() * a.h,
                        a: 0.3,
                        z: finalParticleSize,
                        h: 0
                    }));
                }
            }
        },

        render: function () {
            for (var d = 0; d < dots.length; d++) {
                dots[d].render();
            }
        }
    }
}());

// 点类
S.Point = function (args) {
    this.x = args.x;
    this.y = args.y;
    this.z = args.z;
    this.a = args.a;
    this.h = args.h;
};

// 颜色类
S.Color = function (r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
};

S.Color.prototype = {
    render: function () {
        return 'rgba(' + this.r + ',' + +this.g + ',' + this.b + ',' + this.a + ')';
    }
};

// 点类
S.Dot = function (x, y) {
    this.p = new S.Point({
        x: x,
        y: y,
        z: 5,
        a: 1,
        h: 0
    });

    this.e = 0.07;
    this.s = true;

    this.c = new S.Color(255, 255, 255, this.p.a);

    this.t = this.clone();
    this.q = [];
};

S.Dot.prototype = {
    clone: function () {
        return new S.Point({
            x: this.x,
            y: this.y,
            z: this.z,
            a: this.a,
            h: this.h
        });
    },

    _draw: function () {
        this.c.a = this.p.a;
        S.Drawing.drawCircle(this.p, this.c);
    },

    _moveTowards: function (n) {
        var details = this.distanceTo(n, true),
            dx = details[0],
            dy = details[1],
            d = details[2],
            e = this.e * d;

        if (this.p.h === -1) {
            this.p.x = n.x;
            this.p.y = n.y;
            return true;
        }

        if (d > 1) {
            this.p.x -= ((dx / d) * e);
            this.p.y -= ((dy / d) * e);
        } else {
            if (this.p.h > 0) {
                this.p.h--;
            } else {
                return true;
            }
        }

        return false;
    },

    _update: function () {
        if (this._moveTowards(this.t)) {
            var p = this.q.shift();

            if (p) {
                this.t.x = p.x || this.p.x;
                this.t.y = p.y || this.p.y;
                this.t.z = p.z || this.p.z;
                this.t.a = p.a || this.p.a;
                this.p.h = p.h || 0;
            } else {
                if (this.s) {
                    this.p.x -= Math.sin(Math.random() * 3.142);
                    this.p.y -= Math.sin(Math.random() * 3.142);
                } else {
                    this.move(new S.Point({
                        x: this.p.x + (Math.random() * 50) - 25,
                        y: this.p.y + (Math.random() * 50) - 25,
                    }));
                }
            }
        }

        d = this.p.a - this.t.a;
        this.p.a = Math.max(0.1, this.p.a - (d * 0.05));
        d = this.p.z - this.t.z;
        this.p.z = Math.max(1, this.p.z - (d * 0.05));
    },

    distanceTo: function (n, details) {
        var dx = this.p.x - n.x,
            dy = this.p.y - n.y,
            d = Math.sqrt(dx * dx + dy * dy);

        return details ? [dx, dy, d] : d;
    },

    move: function (p, avoidStatic) {
        if (!avoidStatic || (avoidStatic && this.distanceTo(p) > 1)) {
            this.q.push(p);
        }
    },

    render: function () {
        this._update();
        this._draw();
    }
}

/**
 * 初始化集成页面动画
 */
function initIntegratedAnimation() {
    
    // 延迟初始化，确保DOM完全加载
    setTimeout(() => {
        S.init();
    }, 100);
}

// 导出函数
window.initIntegratedAnimation = initIntegratedAnimation;
window.S = S;

// 导出屏幕控制函数
window.setAnimationScreen = function(screenNumber) {
    if (window.S && window.S.setCurrentScreen) {
        window.S.setCurrentScreen(screenNumber);
    }
};
