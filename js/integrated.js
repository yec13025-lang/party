/**
 * 集成页面主控制逻辑
 * 管理四屏展示和音乐播放
 */

// 全局变量
let currentScreen = 1;
let blessingData = null;
let isMusicPlaying = false;
let animationCheckInterval = null;
let cakeAnimationCheckInterval = null;
let autoSwitchTimer = null; // 自动跳转定时器
let hasSwitchedToScreen4 = false; // 是否已跳转到第四屏

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    
    // 初始化各个模块
    initScreenNavigation();
    initLoginScreen();
    
    // 初始化音乐系统
    initIntegratedMusic();
    
    // 检查URL中是否有blessingid
    const blessingId = getQueryParam('blessingid');
    
    if (blessingId) {
        // 如果有blessingid，先加载数据，再初始化主题系统
        loadBlessingData();
        // 等待数据加载完成后再应用主题（由processBlessingData中调用）
    } else {
        // 无 blessingid：加载内置演示贺卡（NAME / ONE），失败时退回默认主题与默认音乐
        initThemeSystem();
        loadBlessingData();
        // 先铺上默认音乐，接口返回后再由 loadIntegratedMusic 覆盖为该贺卡的音乐
        loadDefaultIntegratedMusic();
    }
    
});

/**
 * 屏幕导航控制
 */
function initScreenNavigation() {
    // 屏幕切换函数
    window.switchToScreen = function(screenNumber) {
        console.log(`切换到屏幕 ${screenNumber}`);
        
        // 控制第二屏动画
        if (window.setAnimationScreen) {
            window.setAnimationScreen(screenNumber);
        }
        
        // 控制音乐按钮显示
        const musicControl = document.getElementById('musicControl');
        if (musicControl) {
            if (screenNumber === 1) {
                musicControl.classList.remove('show');
            } else {
                musicControl.classList.add('show');
            }
        }
        
        // 隐藏当前屏幕
        const currentScreenElement = document.querySelector('.screen.active');
        if (currentScreenElement) {
            currentScreenElement.classList.remove('active');
        }
        
        // 显示目标屏幕
        const targetScreen = document.querySelector(`.screen-${screenNumber}`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            currentScreen = screenNumber;
            
            // 如果切换到第三屏，重置跳转标志
            if (screenNumber === 3) {
                hasSwitchedToScreen4 = false;
            }
            
            // 根据屏幕执行特定初始化
            switch(screenNumber) {
                case 2:
                    initAnimationScreen();
                    break;
                case 3:
                    initCakeScreen();
                    break;
                case 4:
                    initMemoriesScreen();
                    break;
            }
        }
    };
}

/**
 * 第一屏：登录验证初始化
 */
function initLoginScreen() {
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('login-button');
    
    if (loginButton) {
        loginButton.addEventListener('click', function(event) {
            event.preventDefault();
            handleLogin();
        });
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            handleLogin();
        });
    }
}

/**
 * 处理登录逻辑
 */
function tryMatchBirthday(input, stored) {
    var digits = String(input || '').replace(/\D/g, '');
    if (!digits || digits.length === 0) return false;
    if (digits === stored) return true;
    if (digits.length === 4) return digits === stored;
    if (digits.length === 3) {
        if ('0' + digits === stored) return true;
        if (digits[0] + '0' + digits[1] + digits[2] === stored) return true;
        if (digits.slice(0, 2) + '0' + digits[2] === stored) return true;
    }
    if (digits.length === 2) {
        if ('0' + digits[0] + '0' + digits[1] === stored) return true;
    }
    if (digits.length === 1) {
        if ('0' + digits + '0' + digits === stored) return true;
    }
    return false;
}

function handleLogin() {
    const pwd = document.getElementById('pwd').value.trim();
    const databasePwd = localStorage.getItem('pwd');

    if (tryMatchBirthday(pwd, databasePwd)) {
        
        // 触发生日快乐文字向下平移动画
        const title = document.querySelector('.login-title');
        if (title) {
            title.classList.add('animate-to-center');
        }
        
        // 使用fadeOut效果隐藏表单，参考login.js的逻辑
        const form = document.querySelector('.login-form');
        const container = document.querySelector('.login-container');
        
        if (form) {
            // 使用jQuery的fadeOut效果，与文字动画同步
            $(form).fadeOut(500);
        }
        
        if (container) {
            container.classList.add('form-success');
        }
        
        // 开始播放音乐
        startMusic();
        
        // 延迟切换到第二屏
        setTimeout(() => {
            switchToScreen(2);
        }, 2000);
        
    } else {
        alert("密码是你的生日哦!（密码为4位数）");
    }
}

/**
 * 第二屏：动画展示初始化
 */
function initAnimationScreen() {
    
    // 应用主题颜色
    applyThemeToScreen(2);
    
    // 添加body--ready类以启用动画样式
    document.body.classList.add('body--ready');
    
    // 初始化动画系统
    if (typeof initIntegratedAnimation === 'function') {
        initIntegratedAnimation();
    }
    
    // 监听动画完成事件
    if (animationCheckInterval) {
        clearInterval(animationCheckInterval);
    }
    
    animationCheckInterval = setInterval(() => {
        if (typeof S !== 'undefined' && S.UI && S.UI.getIsSimulateDone && S.UI.getIsSimulateDone()) {
            console.log('动画完成，切换到第三屏');
            clearInterval(animationCheckInterval);
            animationCheckInterval = null;
            setTimeout(() => {
                switchToScreen(3);
            }, 1000);
        }
    }, 1000);
}

/**
 * 第三屏：生日蛋糕初始化
 */
function initCakeScreen() {
    
    // 应用主题颜色
    applyThemeToScreen(3);
    
    // 重置蛋糕动画状态
    resetCakeAnimation();
    
    // 立即启动蛋糕动画，消除空白时间
    startCakeAnimation();
    
    
    // 初始化喜欢按钮
    const likeButton = document.getElementById('likeButton');
    if (likeButton) {
        // 清除之前的点击事件监听器（如果存在）
        const newLikeButton = likeButton.cloneNode(true);
        likeButton.parentNode.replaceChild(newLikeButton, likeButton);
        
        newLikeButton.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('喜欢按钮被点击，切换到第四屏');
            // 清除自动跳转定时器
            if (autoSwitchTimer) {
                clearTimeout(autoSwitchTimer);
                autoSwitchTimer = null;
            }
            // 立即跳转
            if (!hasSwitchedToScreen4) {
                hasSwitchedToScreen4 = true;
                switchToScreen(4);
            }
        });
    }
    
    // 监听蛋糕动画完成
    if (cakeAnimationCheckInterval) {
        clearInterval(cakeAnimationCheckInterval);
    }
    
    cakeAnimationCheckInterval = setInterval(() => {
        if (typeof isCakeAnimationComplete === 'function' && isCakeAnimationComplete()) {
            clearInterval(cakeAnimationCheckInterval);
            cakeAnimationCheckInterval = null;
        }
    }, 1000);
}

/**
 * 重置蛋糕动画状态 - 完全移除SVG，准备重新创建
 */
function resetCakeAnimation() {
    
    // 移除现有的蛋糕SVG
    const existingCake = document.getElementById('cake');
    if (existingCake) {
        existingCake.remove();
    }
    
    // 重置蜡烛、文字、按钮状态
    const velas = document.querySelector('.velas');
    const happy = document.querySelector('.happy');
    const button = document.querySelector('.button-style1');
    
    if (velas) {
        velas.style.display = 'none';
        velas.style.animation = '';
        // 不手动设置transform，让CSS控制初始状态
        velas.style.transform = '';
    }
    
    if (happy) {
        happy.style.display = 'none';
        happy.style.animation = '';
        happy.style.opacity = '0';
        happy.style.top = '45%';
    }
    
    if (button) {
        button.style.display = 'none';
        button.style.animation = '';
        button.style.opacity = '0';
        button.style.left = '25%';
    }
    
    // 重置火焰动画状态
    const fuegos = document.querySelectorAll('.fuego');
    fuegos.forEach((fuego, index) => {
        fuego.style.animation = '';
    });
    
}

/**
 * 创建蛋糕SVG - 第一阶段：基础SVG结构
 */
function createCakeSVG() {
    
    // 获取蛋糕容器
    const cakeContainer = document.querySelector('.screen-3');
    if (!cakeContainer) {
        return;
    }
    
    // 创建SVG元素
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'cake';
    svg.setAttribute('version', '1.1');
    svg.setAttribute('x', '0px');
    svg.setAttribute('y', '0px');
    svg.setAttribute('width', '200px');
    svg.setAttribute('height', '500px');
    svg.setAttribute('viewBox', '0 0 200 500');
    svg.setAttribute('enable-background', 'new 0 0 200 500');
    svg.setAttribute('xml:space', 'preserve');
    
    // 按照birthdaycake.html的正确顺序创建SVG路径
    
    // 1. 第三层蛋糕（bizcocho_3）- 最上层
    const bizcocho3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bizcocho3.setAttribute('fill', '#a88679');
    bizcocho3.setAttribute('d', 'M173.667-13.94c-49.298,0-102.782,0-147.334,0c-3.999,0-4-16.002,0-16.002c44.697,0,96.586,0,147.334,0C177.667-29.942,177.668-13.94,173.667-13.94z');
    bizcocho3.style.display = 'none'; // 初始隐藏
    
    const animate3 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate3.setAttribute('id', 'bizcocho_3');
    animate3.setAttribute('attributeName', 'd');
    animate3.setAttribute('calcMode', 'spline');
    animate3.setAttribute('keySplines', '0 0 1 1; 0 0 1 1');
    animate3.setAttribute('begin', 'relleno_2.end');
    animate3.setAttribute('dur', '0.3s');
    animate3.setAttribute('fill', 'freeze');
    animate3.setAttribute('values', `M173.667-13.94c-49.298,0-102.782,0-147.334,0c-3.999,0-4-16.002,0-16.002c44.697,0,96.586,0,147.334,0C177.667-29.942,177.668-13.94,173.667-13.94z;M173.667,411.567c-47.995,12.408-102.955,12.561-147.334,0c-3.848-1.089-0.189-16.089,3.661-15.002c44.836,12.66,90.519,12.753,139.427,0.07C173.293,395.631,177.541,410.566,173.667,411.567z;M173.667,427.569c-49.795,0-101.101,0-147.334,0c-3.999,0-4-16.002,0-16.002c46.385,0,97.539,0,147.334,0C177.668,411.567,177.667,427.569,173.667,427.569z`);
    bizcocho3.appendChild(animate3);
    svg.appendChild(bizcocho3);
    
    // 2. 第二层填充（relleno_2）- 底座
    const relleno2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    relleno2.setAttribute('fill', '#8b6a60');
    relleno2.setAttribute('d', 'M100-178.521c1.858,0,3.364,1.506,3.364,3.363c0,0,0,33.17,0,44.227c0,19.144,0,57.431,0,76.574c0,10.152,0,40.607,0,40.607c0,1.858-1.506,3.364-3.364,3.364l0,0c-1.858,0-3.364-1.506-3.364-3.364c0,0,0-30.455,0-40.607c0-19.144,0-57.432,0-76.575c0-11.057,0-44.226,0-44.226C96.636-177.015,98.142-178.521,100-178.521L100-178.521z');
    relleno2.style.display = 'none'; // 初始隐藏
    
    const animateRelleno2 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateRelleno2.setAttribute('id', 'relleno_2');
    animateRelleno2.setAttribute('attributeName', 'd');
    animateRelleno2.setAttribute('calcMode', 'spline');
    animateRelleno2.setAttribute('keySplines', '0 0 1 1; 0 0 1 1; 0 0 0.58 1');
    animateRelleno2.setAttribute('begin', 'bizcocho_2.end');
    animateRelleno2.setAttribute('dur', '0.5s');
    animateRelleno2.setAttribute('fill', 'freeze');
    animateRelleno2.setAttribute('values', `M100-178.521c1.858,0,3.364,1.506,3.364,3.363c0,0,0,33.17,0,44.227c0,19.144,0,57.431,0,76.574c0,10.152,0,40.607,0,40.607c0,1.858-1.506,3.364-3.364,3.364l0,0c-1.858,0-3.364-1.506-3.364-3.364c0,0,0-30.455,0-40.607c0-19.144,0-57.432,0-76.575c0-11.057,0-44.226,0-44.226C96.636-177.015,98.142-178.521,100-178.521L100-178.521z;M100,267.257c1.858,0,3.364,1.506,3.364,3.363c0,0,0,33.17,0,44.227c0,19.143,0,57.43,0,76.574c0,10.151,0,40.606,0,40.606c0,1.858-1.506,3.364-3.364,3.364l0,0c-1.858,0-3.364-1.506-3.364-3.364c0,0,0-30.455,0-40.606c0-19.145,0-57.432,0-76.576c0-11.057,0-44.225,0-44.225C96.636,268.763,98.142,267.257,100,267.257L100,267.257z;M93.928,405.433c-0.655,6.444-0.102,9.067,2.957,11.798c0,0,8.083,5.571,16.828,3.503c18.629-4.406,43.813,6.194,50.792,7.791c14.75,3.375,9.162,6.867,9.162,6.867c-2.412,2.258-58.328,0-73.667,0l0,0c-1.858,0-69.995,2.133-73.667,0c0,0-3.337-2.439,6.172-5.992c11.375-4.25,52.875,8.822,47.139-9.442c-6.333-20.167,5.226-21.514,5.226-21.514c3.435-0.915,12.78-6.663,10.923-0.546L93.928,405.433z;M102.242,427.569c5.348,0,14.079,0,17.462,0c0,0,17.026,0,27.504,0c19.143,0,20.39-3.797,26.459,0c3,1.877,0,7.823,0,7.823c-2.412,2.258-58.328,0-73.667,0l0,0c-1.858,0-67.187,0-73.667,0c0,0-4.125-4.983,0-7.823c5.201-3.58,16.085,0,23.725,0c8.841,0,20.762,0,20.762,0c3.686,0,8.597,0,19.511,0H102.242z`);
    relleno2.appendChild(animateRelleno2);
    svg.appendChild(relleno2);
    
    // 3. 第二层蛋糕（bizcocho_2）- 倒数第四层
    const bizcocho2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bizcocho2.setAttribute('fill', '#a88679');
    bizcocho2.setAttribute('d', 'M173.667-15.929c-46.512,0-105.486,0-147.334,0c-3.999,0-4-16.002,0-16.002c43.566,0,97.96,0,147.334,0C177.667-31.931,177.666-15.929,173.667-15.929z');
    bizcocho2.style.display = 'none'; // 初始隐藏
    
    const animate2 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate2.setAttribute('id', 'bizcocho_2');
    animate2.setAttribute('attributeName', 'd');
    animate2.setAttribute('calcMode', 'spline');
    animate2.setAttribute('keySplines', '0 0 1 1; 0 0 1 1; 0.25 0 0.58 1');
    animate2.setAttribute('begin', 'relleno_1.end');
    animate2.setAttribute('dur', '0.5s');
    animate2.setAttribute('fill', 'freeze');
    animate2.setAttribute('values', `M173.667-15.929c-46.512,0-105.486,0-147.334,0c-3.999,0-4-16.002,0-16.002c43.566,0,97.96,0,147.334,0C177.667-31.931,177.666-15.929,173.667-15.929z;M173.434,445.393c-47.269,8.001-105.245,8.001-147.334,0c-3.929-0.747-0.692-16.543,3.243-15.824c43.828,8.001,92.165,8.001,140.739,0C174.029,428.918,177.377,444.726,173.434,445.393z;M173.667,449.514c-47.576-5.454-102.799-5.744-147.333,0c-3.966,0.512-3.938-15.297,0-16.002c43.683-7.823,97.646-8.026,147.333,0C177.616,434.15,177.642,449.969,173.667,449.514z;M173.667,451.394c-49.298,0-102.782,0-147.334,0c-3.999,0-4-16.002,0-16.002c44.697,0,96.586,0,147.334,0C177.667,435.392,177.668,451.394,173.667,451.394z`);
    bizcocho2.appendChild(animate2);
    svg.appendChild(bizcocho2);
    
    // 4. 第一层填充（relleno_1）- 倒数第三层
    const relleno1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    relleno1.setAttribute('fill', '#8b6a60');
    relleno1.setAttribute('d', 'M101.368-73.685c0,12.164,0,15.18,0,28.519c0,22.702,0-13.661,0,8.304c0,14.48,0,18.233,0,30.512c0,1.753-2.958,1.847-2.958,0c0-12.68,0-16.277,0-30.401c0-21.983,0,11.66,0-8.305c0-13.027,0-15.992,0-28.628C98.411-75.883,101.368-75.592,101.368-73.685z');
    relleno1.style.display = 'none'; // 初始隐藏
    
    const animateRelleno1 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateRelleno1.setAttribute('id', 'relleno_1');
    animateRelleno1.setAttribute('attributeName', 'd');
    animateRelleno1.setAttribute('calcMode', 'spline');
    animateRelleno1.setAttribute('keySplines', '0 0 1 1; 0 0 1 1; 0 0 0.6 1');
    animateRelleno1.setAttribute('begin', 'bizcocho_1.end');
    animateRelleno1.setAttribute('dur', '0.5s');
    animateRelleno1.setAttribute('fill', 'freeze');
    animateRelleno1.setAttribute('values', `M101.368-73.685c0,12.164,0,15.18,0,28.519c0,22.702,0-13.661,0,8.304c0,14.48,0,18.233,0,30.512c0,1.753-2.958,1.847-2.958,0c0-12.68,0-16.277,0-30.401c0-21.983,0,11.66,0-8.305c0-13.027,0-15.992,0-28.628C98.411-75.883,101.368-75.592,101.368-73.685z;M101.368,350.885c0,12.164,0,65.18,0,78.518c0,22.703,0-33.66,0-11.695c0,14.48,0,28.232,0,40.512c0,1.753-2.958,1.847-2.958,0c0-12.68,0-26.277,0-40.402c0-21.982,0,31.66,0,11.695c0-13.027,0-65.992,0-78.627C98.411,348.686,101.368,348.977,101.368,350.885z;M128.38,447.567c37.626,6.312,39.303,13.658,26.833,12.833c-22.653-1.499-13.636-0.831-23.302-0.831c-14.48,0-17.884,0-30.163,0c-2.087,0-2.068,0-3.915,0c-13.333,0-8.963,0-23.088,0c-11.668,0-14.062,5.995-27.532,1.164c-12.629-4.529,38.667-3.167,46.833-17.333C100.077,432.94,105.546,443.736,128.38,447.567z;M173.667,451.394c2.875,0,2.997,9.257,0,9.131c-22.662-0.956-32.09-0.956-41.756-0.956c-14.48,0-17.884,0-30.163,0c-2.087,0-2.068,0-3.915,0c-13.333,0-8.963,0-23.088,0c-11.668,0-34.99-0.294-48.412,1.831c-4.109,0.65-3.01-10.006,0-10.006C37.129,451.394,149.379,451.394,173.667,451.394z`);
    relleno1.appendChild(animateRelleno1);
    svg.appendChild(relleno1);
    
    // 5. 第一层蛋糕（bizcocho_1）- 最底层
    const bizcocho1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bizcocho1.setAttribute('fill', '#a88679');
    bizcocho1.setAttribute('d', 'M173.667,21.571c-33.174,0-111.467,0-147.334,0c-4,0-4-16.002,0-16.002c39.836,0,105.982,0,147.334,0C177.668,5.569,177.667,21.571,173.667,21.571z');
    bizcocho1.style.display = 'none'; // 初始隐藏
    
    const animate1 = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate1.setAttribute('id', 'bizcocho_1');
    animate1.setAttribute('attributeName', 'd');
    animate1.setAttribute('calcMode', 'spline');
    animate1.setAttribute('keySplines', '0 0 1 1; 0 0 1 1; 0 0 1 1; 0.25 0 1 1; 0 0 1 1; 0.25 0 0.6 1');
    animate1.setAttribute('begin', '0.5s');
    animate1.setAttribute('dur', '0.8s');
    animate1.setAttribute('fill', 'freeze');
    animate1.setAttribute('values', `M173.667,21.571c-33.174,0-111.467,0-147.334,0c-4,0-4-16.002,0-16.002c39.836,0,105.982,0,147.334,0C177.668,5.569,177.667,21.571,173.667,21.571z;M173.667,459.569c-33.197,16.002-110.782,16.002-147.334,0c-3.664-1.604,1.614-15.617,5.337-14.153c40.702,16.002,94.289,16.104,136.505,0.103C171.917,444.1,177.271,457.832,173.667,459.569z;M171.817,475.571c-39.361-3.001-105.438-2.571-143.556,0c-3.991,0.27-7.377-14.736-3.387-15.014c41.553-2.888,104.421-3.121,150.51-0.233C179.378,460.574,175.806,475.875,171.817,475.571z;M171.817,459.564c-38.8-12.188-104.504-13.762-143.556,0c-3.772,1.329-7.961-12.604-4.178-13.905c40.864-14.064,105.114-15.52,151.918-0.973C179.822,445.874,175.634,460.762,171.817,459.564z;M173.667,475.571c-46.376-5.005-105.924-4.003-147.334,0-3.981,0.385-3.479-15.421,0.479-16.002c43.087-6.327,97.705-7.083,146.855,0.438C177.621,460.613,177.644,476,173.667,475.571z;M173.667,474.117c-46.376,1.866-105.638,2.01-147.334,0c-3.995-0.192-3.52-16.144,0.479-16.002c43.794,1.55,96.341,1.541,145.723,0C176.532,457.99,177.663,473.956,173.667,474.117z;M173.667,475.571c-46.512,0-105.486,0-147.334,0c-3.999,0-4-16.002,0-16.002c43.566,0,97.96,0,147.334,0C177.667,459.569,177.666,475.571,173.667,475.571z`);
    bizcocho1.appendChild(animate1);
    svg.appendChild(bizcocho1);
    
    // 第三阶段：添加奶油路径（crema）
    const crema = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    crema.setAttribute('fill', '#fefae9');
    crema.setAttribute('d', 'M104.812,113.216c0,3.119-2.164,5.67-4.812,5.67c-2.646,0-4.812-2.551-4.812-5.67c0-5.594,0-16.782,0-22.375c0-5.143,0-15.427,0-20.568c0-7.333,0-21.998,0-29.33c0-5.523,0-16.569,0-22.092c0-3.295,0-9.885,0-13.181C95.188,2.551,97.353,0,100,0c2.648,0,4.812,2.551,4.812,5.669c0,3.248,0,9.743,0,12.991c0,5.428,0,16.284,0,21.711c0,7.618,0,22.854,0,30.472c0,4.952,0,14.854,0,19.807C104.812,96.292,104.812,107.576,104.812,113.216z');
    crema.style.display = 'none'; // 初始隐藏
    
    // 添加奶油的动画
    const animateCrema = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateCrema.setAttribute('id', 'crema');
    animateCrema.setAttribute('attributeName', 'd');
    animateCrema.setAttribute('calcMode', 'spline');
    animateCrema.setAttribute('keySplines', '0 0 1 1; 0 0 1 1; 0 0 1 1; 0.25 0 1 1; 0 0 1 1; 0 0 0.58 1');
    animateCrema.setAttribute('begin', 'bizcocho_3.end');
    animateCrema.setAttribute('dur', '2s');
    animateCrema.setAttribute('fill', 'freeze');
    animateCrema.setAttribute('values', `M104.812,113.216c0,3.119-2.164,5.67-4.812,5.67c-2.646,0-4.812-2.551-4.812-5.67c0-5.594,0-16.782,0-22.375c0-5.143,0-15.427,0-20.568c0-7.333,0-21.998,0-29.33c0-5.523,0-16.569,0-22.092c0-3.295,0-9.885,0-13.181C95.188,2.551,97.353,0,100,0c2.648,0,4.812,2.551,4.812,5.669c0,3.248,0,9.743,0,12.991c0,5.428,0,16.284,0,21.711c0,7.618,0,22.854,0,30.472c0,4.952,0,14.854,0,19.807C104.812,96.292,104.812,107.576,104.812,113.216z;M104.812,405.897c0,3.119-2.164,5.67-4.812,5.67c-2.646,0-4.812-2.551-4.812-5.67c0-5.594,0-16.782,0-22.376c0-5.143,0-15.426,0-20.568c0-7.332,0-21.997,0-29.33c0-5.522,0-16.568,0-22.092c0-3.295,0-9.885,0-13.181c0-3.118,2.165-5.669,4.812-5.669c2.648,0,4.812,2.551,4.812,5.669c0,3.247,0,9.743,0,12.991c0,5.428,0,16.283,0,21.711c0,7.618,0,22.854,0,30.473c0,4.951,0,14.854,0,19.807C104.812,388.972,104.812,400.256,104.812,405.897z;M111.873,411.567c-3.119,0-9.226,0-11.874,0c-2.646,0-7.748,0-10.867,0c-7.086,0-12.698,0-18.292,0c-6.592,0-12.871,7.371-19.166,3.008c-10.043-6.961-7.776-10.169,2.991-17.745c12.61-8.873,27.713,1.994,25.919-7.531c-2.589-13.742,11.008-14.513,11.365-17.789c0.441-4.051,4.235-11.107,8.051-8.175c3.113,2.393,1.007,8.008,0,13.159c-1.871,9.569,8.058,2.113,9.494,14.155c2.592,21.732,21.184-0.675,29.309,7.976c5.216,5.553,18.413,5.552,15.426,12.942c-3.131,7.745-15.825-4.369-23.8,2.903C126.261,418.271,118.301,411.567,111.873,411.567z;M111.873,411.567c-3.119,0-9.226,0-11.874,0c-2.646,0-9.734,4.069-12.853,4.069c-7.086,0-10.712-4.069-16.306-4.069c-6.592,0-12.12,6.013-19.166,3.008c-7.053-3.008-7.458,2.026-18.659,1.165c-6.832-0.525-7.522-3.034-7.533-6.265c-0.037-10.336,22.073-2.452,36.613-2.628c10.234-0.124,19.856-1.439,37.905-2.102c16.642-0.61,32.699,1.552,46.009,1.927c12.438,0.351,29.663-8.99,31.532,3.315c0.773,5.093-5.605,3.342-11.211,9.579c-5.093,5.667-7.59-4.605-12.965-3.832c-8.269,1.189-14.962-8.537-22.937-1.265C126.261,418.271,118.301,411.567,111.873,411.567z;M110.946,413.652c-2.904-1.137-8.405-2.748-12.446-0.97c-6.099,2.685-7.273,10.358-13.253,8.242c-7.843-2.775-8.953-5.008-14.546-5.01c-24.653-0.011-4.849,26.507-18.264,26.507c-12.377,0,5.791-33.537-19.422-26.682c-7.703,2.095-9.806-0.942-9.817-4.173c-0.037-10.336,24.357-4.544,38.897-4.72c10.234-0.124,19.856-1.439,37.905-2.102c16.642-0.61,32.699,1.552,46.009,1.927c12.438,0.351,28.973-8.865,31.532,3.315c1.449,6.896,0.318,15.624-3.874,15.624c-7.619,0-1.788-15.192-19.243-7.111c-7.581,3.51-15.963-9.738-26.669,1.066C120.644,426.744,118.381,416.561,110.946,413.652z;M111.547,413.9c-2.969-0.956-8.775-0.949-13.167-0.5c-14.667,1.5-8.325,16.508-14.667,16.666c-6.667,0.166-0.167-13.5-13.013-14.151c-30.471-1.545-5.572,46.651-18.987,46.651c-12.377,0,10.333-50.166-18.667-44.5c-7.835,1.531-9.537-1.417-9.548-4.647c-0.037-10.336,23.675-5.177,38.215-5.353c10.234-0.124,20.618-1.671,38.667-2.333c16.642-0.61,32.023,1.458,45.333,1.833c12.438,0.351,33.819-8.431,33.199,4.001c-0.532,10.666,0.414,26.166-5.245,25.833c-7.606-0.447-2.954-31.5-19.243-18.899c-7.985,6.177-17.658-5.969-27.377,5.732C118.88,434.066,121.38,417.067,111.547,413.9z;M111.547,415.233c-6.667-0.834-9.667,4.667-13.833,3.333c-19.649-6.291-8.158,22.176-14.5,22.334c-6.667,0.166,2.833-18-13.333-22.167c-29.544-7.615-9.667,43.833-20.167,43.833c-10.333,0,8.004-55.006-16.833-39c-7.5,4.833-9.508-3.78-9.299-7.004c0.799-12.329,23.592-7.153,38.132-7.329c10.234-0.124,20.238-1.505,38.287-2.167c16.642-0.61,32.903,1.125,46.213,1.5c12.438,0.351,35.058-5.579,31.863,6.451c-5.532,20.833,1.25,28.216-4.409,27.883c-7.606-0.447-6.058-37.895-20.62-23.333c-10.167,10.166-15.972-0.747-25,12C119.547,443.568,121.798,416.515,111.547,415.233z`);
    
    crema.appendChild(animateCrema);
    svg.appendChild(crema);
    
    // 6. 添加底座矩形（come）
    const come = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    come.setAttribute('class', 'come');
    come.setAttribute('x', '10');
    come.setAttribute('y', '475.571');
    come.setAttribute('fill', '#fefae9');
    come.setAttribute('width', '180');
    come.setAttribute('height', '4');
    svg.appendChild(come);
    
    // 将SVG添加到容器中
    cakeContainer.appendChild(svg);
}

/**
 * 启动蛋糕动画 - 第三屏进入时才开始显示
 * 使用JavaScript完全控制蛋糕的渲染和动画
 */
function startCakeAnimation() {
    
    // 重新创建蛋糕SVG
    createCakeSVG();
    
    // 显示所有元素
    const velas = document.querySelector('.velas');
    const happy = document.querySelector('.happy');
    const button = document.querySelector('.button-style1');
    
    if (velas) velas.style.display = 'block';
    if (happy) happy.style.display = 'block';
    if (button) button.style.display = 'block';
    
    // 延迟一点时间确保SVG创建完成，然后显示所有元素
    setTimeout(() => {
    const cake = document.getElementById('cake');
    if (cake) {
            // 显示所有SVG路径
        const paths = cake.querySelectorAll('path');
        paths.forEach(path => {
            path.style.display = 'block';
        });
        
        }
    }, 100);
    
    // 启动蜡烛动画 - 延迟4.5秒开始（0.5s缓冲 + 4s蛋糕动画）
    if (velas) {
        setTimeout(() => {
            // 确保蜡烛可见，但不手动设置transform，让CSS动画控制
        velas.style.display = 'block';
            // 移除任何内联的transform样式，让CSS动画生效
            velas.style.transform = '';
            // 强制重排，然后开始动画
            velas.offsetHeight; // 触发重排
            velas.style.animation = 'in 500ms ease-out forwards';
        }, 4500);
    }
    
    // 启动文字动画 - 蛋糕动画结束后1秒开始（5.5秒）
    if (happy) {
        setTimeout(() => {
            happy.style.animation = 'happybirthdays 6s forwards';
            happy.style.animationDelay = '0s';
        }, 1000);
    }
    
    // 启动按钮动画 - 蛋糕动画结束后1秒开始（5.5秒）
    if (button) {
        // 清除之前的自动跳转定时器
        if (autoSwitchTimer) {
            clearTimeout(autoSwitchTimer);
            autoSwitchTimer = null;
        }
        
        // 设置按钮动画结束监听器，按钮完全显示后2秒自动跳转
        const handleButtonAnimationEnd = function(event) {
            // 只处理btn1动画的结束事件
            if (event.animationName === 'btn1' || event.animationName === '-webkit-btn1') {
                console.log('按钮动画完成，1.5秒后自动跳转到第四屏');
                button.removeEventListener('animationend', handleButtonAnimationEnd);
                button.removeEventListener('webkitAnimationEnd', handleButtonAnimationEnd);
                
                // 清除之前的自动跳转定时器
                if (autoSwitchTimer) {
                    clearTimeout(autoSwitchTimer);
                }
                
                // 按钮完全显示后500毫秒自动跳转
                autoSwitchTimer = () => {
                    if (!hasSwitchedToScreen4 && currentScreen === 3) {
                        console.log('自动跳转到第四屏');
                        hasSwitchedToScreen4 = true;
                        switchToScreen(4);
                    }
                }
            };
            autoSwitchTimer();
        }
        
        // 先移除可能存在的旧监听器（使用相同的函数引用）
        // 由于每次都是新函数，这里先移除所有可能的监听器
        const oldHandler = button._animationEndHandler;
        if (oldHandler) {
            button.removeEventListener('animationend', oldHandler);
            button.removeEventListener('webkitAnimationEnd', oldHandler);
        }
        
        // 保存新的处理器引用，以便后续移除
        button._animationEndHandler = handleButtonAnimationEnd;
        
        // 添加动画结束事件监听器（兼容不同浏览器）
        button.addEventListener('animationend', handleButtonAnimationEnd);
        button.addEventListener('webkitAnimationEnd', handleButtonAnimationEnd);
        
        setTimeout(() => {
            button.style.animation = 'btn1 8s forwards';
        }, 1000);
    }
    
    // 启动火焰动画 - 延迟5秒开始（0.5s缓冲 + 4s蛋糕动画 + 0.5s蜡烛动画）
    setTimeout(() => {
        const fuegos = document.querySelectorAll('.fuego');
        fuegos.forEach((fuego, index) => {
            const animationDurations = ['2s', '1.5s', '1s', '0.5s', '0.2s'];
            const duration = animationDurations[index] || '0.2s';
            fuego.style.animation = `fuego ${duration} infinite`;
        });
        }, 5000);
    
}

/**
 * 第四屏：回忆展示初始化
 */
function initMemoriesScreen() {
    
    // 初始化时间轴动画
    initTimelineAnimation();
    
    // 加载回忆内容
    loadMemoriesContent();
    
    // 初始化音频播放
    initAudioPlayback();
    
    // 应用字体
    const fontFamily = localStorage.getItem('fontFamily') || 'yangrendong';
    if (typeof setPageFont === 'function') {
        setPageFont(fontFamily);
    }
    
    // 直接应用字体，确保生效
    applyFontDirectly(fontFamily);
    
    // 延迟再次应用，确保内容加载完成
    setTimeout(() => {
        applyFontDirectly(fontFamily);
    }, 1000);
}

/**
 * 初始化时间轴动画
 */
function initTimelineAnimation() {
    const timeline = document.querySelector('.timeline');
    const timepoints = document.querySelectorAll('.timepoint');
    const memoryBoxes = document.querySelectorAll('.memory-box');
    const memoryTriangles = document.querySelectorAll('.memory-triangle');
    
    if (timeline) {
        timeline.classList.add('active');
    }
    
    // 延迟显示各个元素
    setTimeout(() => {
        timepoints.forEach((timepoint, index) => {
            setTimeout(() => {
                timepoint.classList.add('active');
            }, index * 500);
        });
    }, 1000);
    
    setTimeout(() => {
        memoryBoxes.forEach((box, index) => {
            setTimeout(() => {
                box.classList.add('active');
            }, index * 300);
        });
    }, 2000);
    
    setTimeout(() => {
        memoryTriangles.forEach((triangle, index) => {
            setTimeout(() => {
                triangle.classList.add('active');
            }, index * 200);
        });
    }, 2500);
}

/**
 * 加载回忆内容
 */
function loadMemoriesContent() {
    
    // 设置发送者信息
    const sender = localStorage.getItem('sender');
    if (sender) {
        const senderText = document.querySelector('.sender-text');
        if (senderText) {
            senderText.textContent = `来自${sender}的祝福`;
            
            // 获取当前字体配置
            const fontFamily = localStorage.getItem('fontFamily') || 'yangrendong';
            const fontConfig = window.fonts ? window.fonts[fontFamily] : null;
            const fontName = fontConfig ? fontConfig.name : 'YangRenDongZhuShiTi-Semibold';
            
            // 直接设置发送者文字的字体
            senderText.style.fontFamily = `'${fontName}', cursive !important`;
        } else {
        }
    }
    
    // 加载祝福语内容
    loadBlessingMessages();
    
    // 加载图片内容
    loadMemoryImages();
    
    // 在内容加载完成后应用字体
    setTimeout(() => {
        const fontFamily = localStorage.getItem('fontFamily') || 'yangrendong';
        if (typeof setPageFont === 'function') {
            setPageFont(fontFamily);
        }
    }, 500);
}

/**
 * 加载祝福语内容
 */
function loadBlessingMessages() {
    const blessingMessage = localStorage.getItem('blessingMessage');
    // 获取text1-text9的值
    const textValues = {};
    for (let i = 1; i <= 9; i++) {
        textValues[`text${i}`] = localStorage.getItem(`text${i}`);
    }
    
    
    // 构建祝福语数组
    let messages = [];
    
    // blessingMessage数组内容
    if (blessingMessage) {
        try {
            const blessingArray = JSON.parse(blessingMessage);
            if (Array.isArray(blessingArray)) {
                messages = messages.concat(blessingArray);
            } else {
            }
        } catch (e) {
        }
    } else {
    }
    
    
    // 如果没有blessingMessage，使用默认祝福语
    if (messages.length === 0) {
        const defaultMessages = [
            "愿你新岁多喜乐",
            "愿你岁岁常欢愉", 
            "愿岁月温柔待你",
            "生日快乐！"
        ];
        messages = messages.concat(defaultMessages);
    } else {
    }
    
    displayBlessingContent(messages);
    
    // 显示text1-text9的内容
    for (let i = 1; i <= 9; i++) {
        const text = textValues[`text${i}`];
        if (text) {
            try {
                const textArray = JSON.parse(text);
                displayTextContent(`text${i}Container`, textArray);
            } catch (e) {
                // 忽略解析错误
            }
        }
    }
}

/**
 * 显示祝福内容
 */
function displayBlessingContent(messages) {
    const contentContainer = document.getElementById('blessingContent');
    if (!contentContainer) {
        return;
    }
    
    contentContainer.innerHTML = '';
    
    if (!messages || !Array.isArray(messages)) {
        return;
    }
    
    // 获取当前字体配置
    const fontFamily = localStorage.getItem('fontFamily') || 'yangrendong';
    const fontConfig = window.fonts ? window.fonts[fontFamily] : null;
    const fontName = fontConfig ? fontConfig.name : 'YangRenDongZhuShiTi-Semibold';
    
    messages.forEach((message, index) => {
        const p = document.createElement('p');
        p.textContent = message;
        
        p.style.animationDelay = `${index * 0.2}s`;
        p.style.opacity = '0';
        p.style.animation = 'fadeIn 0.8s ease-out forwards';
        p.style.textShadow = '0 1px 2px rgba(255, 255, 255, 0.5)';
        p.style.color = '#553d2f';
        p.style.textAlign = 'center';
        p.style.margin = '20px 0';
        p.style.fontWeight = '500';
        p.style.letterSpacing = '0.3px';
        // 直接设置字体
        p.style.fontFamily = `'${fontName}', cursive !important`;
        contentContainer.appendChild(p);
    });
    
}

/**
 * 显示文本内容
 */
function displayTextContent(containerId, textArray) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    
    container.innerHTML = '';
    
    if (!textArray || !Array.isArray(textArray)) {
        return;
    }
    
    // 获取当前字体配置
    const fontFamily = localStorage.getItem('fontFamily') || 'yangrendong';
    const fontConfig = window.fonts ? window.fonts[fontFamily] : null;
    const fontName = fontConfig ? fontConfig.name : 'YangRenDongZhuShiTi-Semibold';
    
    textArray.forEach((text, index) => {
        const p = document.createElement('p');
        p.textContent = text;
        p.style.animationDelay = `${index * 0.2}s`;
        p.style.opacity = '0';
        p.style.animation = 'fadeIn 0.8s ease-out forwards';
        p.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
        p.style.color = '#FFFFFF';
        p.style.textAlign = 'center';
        p.style.margin = '10px 0';
        // 直接设置字体
        p.style.fontFamily = `'${fontName}', cursive !important`;
        container.appendChild(p);
    });
}

/**
 * 加载回忆图片
 * 参考memories.page.js的实现逻辑
 */
function loadMemoryImages() {
    
    const blessingId = localStorage.getItem('blessingid');
    
    // 如果没有祝福ID，直接使用默认图片
    if (!blessingId) {
        replaceImages(null);
        return;
    }
    
    // 从全局变量中获取缓存的祝福数据
    if (blessingData && blessingData.images) {
        // 使用缓存的图片数据
        replaceImages(blessingData.images);
    } else {
        // 如果缓存中没有图片数据，直接使用默认图片
        replaceImages(null);
    }
}

/**
 * 替换页面中的图片内容
 * 参考memories.page.js的实现，支持预加载和淡入效果
 */
function replaceImages(imageData) {
    
    // 获取所有图片容器 - 对应integrated.html中的图片容器
    const containers = [
        '.memory-group-1 .memory-box-1 .memory-image-container',  // 第一张图片
        '.memory-group-1 .memory-box-2 .memory-image-container',  // 第二张图片
        '.memory-group-2 .memory-box-3 .memory-image-container',  // 第三张图片
        '.memory-group-2 .memory-box-4 .memory-image-container',  // 第四张图片
        '.memory-group-2 .memory-box-5 .memory-image-container',  // 第五张图片
        '.memory-group-3 .memory-box-6 .memory-image-container',  // 第六张图片
        '.memory-group-3 .memory-box-7 .memory-image-container',  // 第七张图片
        '.memory-group-4 .memory-box-8 .memory-image-container'   // 第八张图片
    ];
    
    // 默认图片路径 - 顺序与 integrated.html 中 8 个 .memory-image 的静态默认图完全一致
    const defaultImages = [
        '/img/rec/default-man/img-20260504144427-135569e867694fe1892c68b763c29158.jpg',
        '/img/rec/default-man/img-20260504144427-adb97b5258c64215bbfd70b054c3f0c1.png',
        '/img/rec/default-man/img-20260504144429-1b0b3a48c4134380a5b1daf9b4269980.jpg',
        '/img/rec/default-man/img-20260504144429-259a33b9e1db46cfb060e119f689155d.png',
        '/img/rec/default-man/img-20260504144429-944a1c1d2bb84157bc1a9ab8305aca0c.jpg',
        '/img/rec/default-man/img-20260504144429-a921c923773f4969bdeb933698dfda83.jpg',
        '/img/rec/default-man/img-20260504144429-abf51cbe6b3847148382df439d536e72.jpg',
        '/img/rec/default-man/img-20260504144429-f4b77798a33147eca454509c73e4e593.jpg'
    ];
    
    const preloadPromises = [];
    
    // 预加载所有图片
    containers.forEach((selector, index) => {
        let imageUrl = null;
        
        // 优先使用用户上传的图片
        if (imageData && imageData[index]) {
            imageUrl = imageData[index];
        } else if (defaultImages[index]) {
            // 使用默认图片
            imageUrl = defaultImages[index];
        }
        
        if (imageUrl) {
            const preloadPromise = new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        index, 
                        data: imageUrl, 
                        isUserImage: !!imageData && !!imageData[index]
                    });
                };
                img.onerror = () => {
                    // 用户图片加载失败时尝试使用默认图片
                    if (defaultImages[index] && (!!imageData && !!imageData[index])) {
                        const defaultImg = new Image();
                        defaultImg.onload = () => {
                            resolve({
                                index, 
                                data: defaultImages[index], 
                                isUserImage: false
                            });
                        };
                        defaultImg.onerror = () => {
                            reject();
                        };
                        defaultImg.src = defaultImages[index];
                    } else {
                        reject();
                    }
                };
                img.src = imageUrl;
            });
            preloadPromises.push(preloadPromise);
        } else {
            preloadPromises.push(Promise.resolve({
                index, 
                data: '', 
                isUserImage: false
            }));
        }
    });
    
    // 等待所有图片预加载完成后按顺序显示
    Promise.allSettled(preloadPromises).then(results => {
        const loadedImages = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
        
        
        // 按顺序依次显示图片，添加淡入效果
        const displayDelay = 100;
        loadedImages.forEach((loadedImage, i) => {
            setTimeout(() => {
                const selector = containers[loadedImage.index];
                const container = document.querySelector(selector);
                
                if (container) {
                    const img = container.querySelector('.memory-image');
                    
                    if (img && loadedImage.data) {
                        img.src = loadedImage.data;
                        img.alt = loadedImage.isUserImage ? '用户上传图片' : '默认祝福图片';
                        
                        
                        // 显示容器并添加淡入效果
                        container.style.visibility = 'visible';
                        container.style.opacity = '0';
                        container.style.transition = 'opacity 0.5s ease-in-out';
                        
                        setTimeout(() => {
                            container.style.opacity = '1';
                        }, 10);
                    } else if (img) {
                        // 显示容器（使用占位符）
                        container.style.visibility = 'visible';
                        container.style.opacity = '0';
                        container.style.transition = 'opacity 0.5s ease-in-out';
                        
                        setTimeout(() => {
                            container.style.opacity = '1';
                        }, 10);
                    } else {
                    }
                } else {
                }
            }, i * displayDelay);
        });
    }).catch(error => {
        console.error('图片显示失败:', error);
        // 错误情况下尝试显示所有图片容器
        setTimeout(() => {
            containers.forEach((selector) => {
                const container = document.querySelector(selector);
                if (container) {
                    container.style.visibility = 'visible';
                    container.style.opacity = '0';
                    container.style.transition = 'opacity 0.5s ease-in-out';
                    
                    setTimeout(() => {
                        container.style.opacity = '1';
                    }, 10);
                }
            });
        }, 500);
    });
}

/**
 * 初始化音频播放
 */
function initAudioPlayback() {
    // 检查是否有音频数据
    const blessingId = localStorage.getItem('blessingid');
    if (blessingId) {
        // 加载音频数据
        loadAudioData(blessingId);
    }
}

/**
 * 加载音频数据
 */
function loadAudioData(blessingId) {
    // 从全局变量中获取缓存的祝福数据
    if (blessingData && (blessingData.audioUrl || blessingData.audio)) {
        // 优先使用audioUrl（URL方式），如果不存在则使用audio（Base64方式）
        const audioSource = blessingData.audioUrl || blessingData.audio;
        // 使用缓存的音频数据
        handleAudioData(audioSource, blessingData.timeDisplay, blessingData.sender);
    }
}

/**
 * 从音频来源推断真实 MIME。
 * audioData 可能是 data:URL（data:audio/webm;base64,…）或路径（/data/cards/<id>/audio.webm）。
 * 仅当扩展名为 .mp3 或无法识别时才回退到 'audio/mpeg'（旧行为），
 * 绝不把 .webm/.wav/.m4a 录音谎称为 audio/mpeg。
 */
function inferAudioMimeType(audioData) {
    const fallback = 'audio/mpeg';
    if (!audioData || typeof audioData !== 'string') return fallback;

    if (/^data:/i.test(audioData)) {
        const m = /^data:([^;,]+)/i.exec(audioData);
        return (m && m[1]) ? m[1].trim().toLowerCase() : fallback;
    }

    const clean = audioData.split('#')[0].split('?')[0];
    const dot = clean.lastIndexOf('.');
    if (dot === -1) return fallback;
    const ext = clean.slice(dot + 1).toLowerCase();
    const extMap = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        flac: 'audio/flac',
        ogg: 'audio/ogg',
        oga: 'audio/ogg',
        webm: 'audio/webm',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        mkv: 'video/x-matroska'
    };
    return extMap[ext] || fallback;
}

/**
 * 处理音频数据
 */
function handleAudioData(audioData, timeDisplay, sender) {
    if (audioData) {
        const audioSection = document.getElementById('audioSection');
        const senderName = document.getElementById('senderName');
        
        if (audioSection) {
            audioSection.style.display = 'block';
        }
        
        if (senderName && sender) {
            senderName.textContent = sender;
        }
        
        // 设置音频源到iframe播放器
        const audioPlayer = document.querySelector('.audio-player iframe');
        if (audioPlayer) {
            const themeColor = (blessingData && blessingData.themeColor) ? blessingData.themeColor : 'pink';
            const accentMap = {
                pink: '#ee9ca7',
                blue: '#6495ed',
                red: '#A23025',
                teal: '#68C2B9',
                green: '#7CA32C',
                orange: '#DE5B24',
                purple: '#BB4B5B',
                lemon: '#E6D260'
            };
            const accentColor = accentMap[themeColor] || accentMap.pink;
            const audioMimeType = inferAudioMimeType(audioData);
            const payload = {
                type: 'initAudio',
                src: audioData,
                mimeType: audioMimeType,
                fileName: ' ',
                themeColor: themeColor,
                accentColor: accentColor
            };
            const postTheme = function () {
                if (!audioPlayer.contentWindow) return;
                audioPlayer.contentWindow.postMessage({
                    type: 'applyThemeColor',
                    themeColor: themeColor
                }, '*');
                audioPlayer.contentWindow.postMessage({
                    type: 'initAudio',
                    src: audioData,
                    mimeType: audioMimeType,
                    fileName: ' ',
                    themeColor: themeColor,
                    accentColor: accentColor
                }, '*');
            };
            
            // 向iframe发送音频数据（带主题色和强调色）
            if (audioPlayer.contentWindow) {
                audioPlayer.contentWindow.postMessage(payload, '*');
            }
            // 强制重试，覆盖 iframe 初始化时序差异
            let retry = 0;
            const timer = setInterval(function () {
                retry += 1;
                postTheme();
                if (retry >= 8) {
                    clearInterval(timer);
                }
            }, 180);
            audioPlayer.onload = function () {
                postTheme();
            };
            
            // 监听播放器的播放状态变化
            window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'player:play') {
                    // 录音开始播放时，暂停背景音乐
                    pauseBackgroundMusic();
                } else if (event.data && event.data.type === 'player:pause') {
                    // 录音暂停时，恢复背景音乐
                    resumeBackgroundMusic();
                } else if (event.data && event.data.type === 'player:ended') {
                    // 录音播放完毕时，恢复背景音乐
                    resumeBackgroundMusic();
                }
            });
        }
        
        // 同时设置隐藏的audio元素作为备用
        const blessingAudio = document.getElementById('blessingAudio');
        if (blessingAudio) {
            blessingAudio.src = audioData;
        }
    }
}

/**
 * 加载祝福数据
 */
function loadBlessingData() {
    // 兼容 blessingid / blessingId / id 三种参数写法，都没有时回退到内置演示贺卡
    const requestedId = getQueryParam('blessingid') || getQueryParam('blessingId') || getQueryParam('id') || '';

    // 检查是否需要清除旧的缓存数据
    const cachedBlessingId = localStorage.getItem('blessingid');
    // 指定了贺卡：缓存 id 与请求 id 不一致时清除；
    // 未指定贺卡（演示视图）：缓存 id 不是 demo 时同样清除，避免上一张真实贺卡的内容串进演示
    const cacheStale = requestedId
        ? (cachedBlessingId && cachedBlessingId !== requestedId)
        : (cachedBlessingId && cachedBlessingId !== 'demo');

    if (cacheStale) {
        // blessingid发生变化，清除旧的缓存数据
        console.log('检测到blessingid变化，清除旧的缓存数据');
        localStorage.removeItem('themeColor');
        localStorage.removeItem('userName');
        localStorage.removeItem('pwd');
        localStorage.removeItem('sender');
        localStorage.removeItem('blessingMessage');
        // 清除text1-text9
        for (let i = 1; i <= 9; i++) {
            localStorage.removeItem(`text${i}`);
        }

        // 清除旧数据后立即应用默认主题，避免使用旧的主题颜色
        if (typeof applyIntegratedThemeColorDirect === 'function') {
            applyIntegratedThemeColorDirect();
        }
    }

    // 没有 blessingid 时请求演示数据，保证图片、录音、祝福语都能解析出来
    const apiId = requestedId || 'demo';

    // 发起单个请求获取所有需要的数据（包括图片和音频，音频类型包括0和1）
    fetch('/api/birthdayreport/' + encodeURIComponent(apiId))
        .then(response => response.json())
        .then(data => {
            if (data && data.code === 200) {
                blessingData = data.data;
                // 更新window.blessingData，确保其他模块可以访问到数据
                window.blessingData = blessingData;
                processBlessingData(data.data);

                // 加载自定义音乐
                if (window.loadIntegratedMusic) {
                    window.loadIntegratedMusic(apiId);
                }
            } else {
                console.error('API请求失败:', data && data.msg);

                // API请求失败，加载默认音乐
                if (window.loadDefaultIntegratedMusic) {
                    window.loadDefaultIntegratedMusic();
                }
            }
        })
        .catch(error => {
            console.error('API请求错误:', error);

            // 请求异常时同样退回默认音乐，避免既没有内容也没有日志
            if (window.loadDefaultIntegratedMusic) {
                window.loadDefaultIntegratedMusic();
            }
        });
}

/**
 * 处理祝福数据
 */
function processBlessingData(data) {
    // 填充表单
    const userNameInput = document.getElementById('userName');
    if (userNameInput) {
        userNameInput.value = data.userName;
    }
    
    // 保存数据到localStorage
    localStorage.setItem('userName', data.userName);
    localStorage.setItem('pwd', data.birthday);
    localStorage.setItem('sender', data.sender);
    localStorage.setItem('blessingid', String(data.id || getQueryParam('blessingid') || 'demo'));
    
    // 处理祝福语
    if (data.blessingMessage) {
        const processedBlessingMessage = smartSplit(data.blessingMessage);
        localStorage.setItem('blessingMessage', JSON.stringify(processedBlessingMessage));
    }
    
    // 保存text1-text9到localStorage
    for (let i = 1; i <= 9; i++) {
        const textField = `text${i}`;
        if (data[textField]) {
            const processedText = smartSplit(data[textField]);
            localStorage.setItem(textField, JSON.stringify(processedText));
        }
    }

    // 处理图片路径
    if (data.images && data.images.length > 0) {
        // 获取所有的记忆图片元素
        const memoryImages = document.querySelectorAll('.memory-image');
        memoryImages.forEach((image, index) => {
            if (index < data.images.length) {
                image.src = data.images[index];
            }
        });
        // 将用户图片路径保存到window.blessingData中，以便loadMemoryImages()函数使用
        window.blessingData.images = data.images;
    }
    
    // 保存主题颜色
    const themeColor = data.themeColor || 'default';
    localStorage.setItem('themeColor', themeColor);
    
    // 应用主题颜色 - 使用集成主题函数
    if (typeof setIntegratedThemeColor === 'function') {
        setIntegratedThemeColor(themeColor);
    } else if (typeof applyIntegratedThemeColor === 'function') {
        // 如果setIntegratedThemeColor不存在，直接调用applyIntegratedThemeColor
        applyIntegratedThemeColor();
    }
    
    // 处理字体
    const fontFamily = data.fontFamily || 'yangrendong'; // 默认使用杨任东竹石体
    localStorage.setItem('fontFamily', fontFamily);
    
    // 应用字体
    if (typeof setPageFont === 'function') {
        setPageFont(fontFamily);
    }
    
    // 同时更新全局字体样式
    if (typeof updateGlobalFontStyle === 'function') {
        updateGlobalFontStyle(fontFamily);
    }
}

/**
 * 智能分割文本
 */
function smartSplit(text) {
    if (!text) return [];
    
    // 首先按换行符分割文本，保留用户输入的换行
    const lines = text.split(/\n/);
    const result = [];
    
    // 对每一行文本进行处理
    lines.forEach(line => {
        // 空行不处理，保持原样
        if (!line.trim()) return;
        
        // 仅在【,!?，。？！】字符出现时进行分割
        const parts = line.split(/[,!?，。？！]+/).filter(Boolean);
        result.push(...parts);
    });
    
    return result;
}

/**
 * 直接应用字体到第四屏所有相关元素
 * 最直接的方式，确保字体能够生效
 */


/**
 * 获取URL参数
 */
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * 初始化主题系统
 */
function initThemeSystem() {
    // 应用主题颜色
    if (typeof applyIntegratedThemeColor === 'function') {
        applyIntegratedThemeColor();
    }
    
    // 监听主题变更事件
    window.addEventListener('themeChanged', () => {
        if (typeof applyIntegratedThemeColor === 'function') {
            applyIntegratedThemeColor();
        }
    });
}

/**
 * 应用主题到指定屏幕
 */
function applyThemeToScreen(screenNumber) {
    const themeColor = localStorage.getItem('themeColor') || 'default';
    const screen = document.querySelector(`.screen-${screenNumber}`);
    
    console.log(`应用主题到第${screenNumber}屏，主题颜色:`, themeColor);
    
    if (screen) {
        // 移除所有主题类
        screen.classList.remove('theme-pink', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
        
        // 添加当前主题类
        if (themeColor !== 'default') {
            screen.classList.add(`theme-${themeColor}`);
        }
        
        // 特别处理第二屏的主题应用
        if (screenNumber === 2) {
            // 直接调用集成主题函数，确保主题正确应用
            if (typeof applyIntegratedThemeColor === 'function') {
                applyIntegratedThemeColor();
            }
            
        } else {
            // 其他屏幕使用通用主题应用
            if (typeof setIntegratedElementGradientBackground === 'function') {
                setIntegratedElementGradientBackground(screen, themeColor, 'topLeft');
            }
        }
        
        // 强制重新渲染
        screen.style.display = 'none';
        screen.offsetHeight; // 触发重排
        screen.style.display = '';
        
        // 延迟应用主题，确保DOM完全加载
        setTimeout(() => {
            if (typeof applyIntegratedThemeColor === 'function') {
                applyIntegratedThemeColor();
            }
        }, 100);
    }
}


/**
 * 暂停背景音乐
 */
function pauseBackgroundMusic() {
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');
    
    if (bgMusic && !bgMusic.paused) {
        bgMusic.pause();
        isMusicPlaying = false;
        if (musicBtn) {
            musicBtn.classList.remove('playing');
        }
    }
}

/**
 * 恢复背景音乐
 */
function resumeBackgroundMusic() {
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');
    
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().then(() => {
            isMusicPlaying = true;
            if (musicBtn) {
                musicBtn.classList.add('playing');
            }
        }).catch(error => {
        });
    }
}

/**
 * 开始播放音乐
 */
function startMusic() {
    
    // 兼容处理：如果integrated-music.js未加载，则使用本地实现
    const bgMusic = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');
    
    if (bgMusic) {
        // 预加载音乐
        bgMusic.load();
        
        // 延迟播放，确保切换到第二屏后再播放
        setTimeout(() => {
            bgMusic.play().then(() => {
                isMusicPlaying = true;
                if (musicBtn) {
                    musicBtn.classList.add('playing');
                }
            }).catch(error => {
            });
        }, 3000); // 延迟到第二屏显示后再播放
    }
}

/**
 * 切换音乐播放状态
 */
function toggleMusic() {
    // 调用integrated-music.js中的切换音乐函数
    if (window.toggleIntegratedMusic) {
        window.toggleIntegratedMusic();
        return;
    }
    
    // 兼容处理：如果integrated-music.js未加载，则使用本地实现
    const musicBtn = document.getElementById('musicBtn');
    const bgMusic = document.getElementById('bgMusic');
    
    if (!bgMusic || !musicBtn) {
        return;
    }
    
    if (bgMusic.paused) {
        // 播放背景音乐时，先通过 postMessage 强制暂停录音播放器
        const audioPlayerFrame = document.querySelector('.audio-player iframe');
        if (audioPlayerFrame && audioPlayerFrame.contentWindow) {
            audioPlayerFrame.contentWindow.postMessage({ type: 'player:pause' }, '*');
            // 某些机型下首条消息会丢失，补发一次
            setTimeout(function () {
                if (audioPlayerFrame.contentWindow) {
                    audioPlayerFrame.contentWindow.postMessage({ type: 'player:pause' }, '*');
                }
            }, 80);
        }

        // 播放背景音乐
        bgMusic.play().then(() => {
            isMusicPlaying = true;
            musicBtn.classList.add('playing');
        }).catch(error => {
        });
    } else {
        // 暂停背景音乐
        bgMusic.pause();
        isMusicPlaying = false;
        musicBtn.classList.remove('playing');
    }
}

/**
 * 清理定时器
 */
function cleanupIntervals() {
    if (animationCheckInterval) {
        clearInterval(animationCheckInterval);
        animationCheckInterval = null;
    }
    if (cakeAnimationCheckInterval) {
        clearInterval(cakeAnimationCheckInterval);
        cakeAnimationCheckInterval = null;
    }
    if (autoSwitchTimer) {
        clearTimeout(autoSwitchTimer);
        autoSwitchTimer = null;
    }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanupIntervals);

// 初始化音乐控制按钮事件监听
document.addEventListener('DOMContentLoaded', function() {
    const musicBtn = document.getElementById('musicBtn');
    if (musicBtn) {
        musicBtn.addEventListener('click', function(event) {
            event.preventDefault();
            toggleMusic();
        });
    }
});

// 导出变量和函数供其他模块使用
window.blessingData = blessingData;
window.switchToScreen = window.switchToScreen || function() {};
window.toggleMusic = toggleMusic;
window.loadBlessingData = loadBlessingData;
window.startMusic = startMusic;