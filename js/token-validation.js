/**
 * Token验证工具
 * 用于需要权限控制的页面验证访问token
 */
(function() {
    'use strict';

    /**
     * 从URL的queryparams中获取token
     * @returns {string|null} token值，如果不存在则返回null
     */
    function getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token');
    }

    /**
     * 验证token是否有效
     * @param {string} token token值
     * @returns {Promise<boolean>} 验证结果的Promise
     */
    function validateToken(token) {
        return new Promise((resolve, reject) => {
            if (!token) {
                resolve(false);
                return;
            }

            // 创建XMLHttpRequest对象
            const xhr = new XMLHttpRequest();
            
            // 设置请求方法和URL
            xhr.open('GET', `/api/token/validate?token=${encodeURIComponent(token)}`, true);
            
            // 设置请求头
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            // 处理请求完成事件
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        // 后端响应格式为 {"code": 200, "msg": "操作成功", "data": true}
                        if (response.code === 200 && response.data === true) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (error) {
                        console.error('解析响应失败:', error);
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            };
            
            // 处理请求错误事件
            xhr.onerror = function() {
                console.error('验证token时发生错误');
                resolve(false);
            };
            
            // 发送请求
            xhr.send();
        });
    }

    /**
     * 执行token验证流程
     */
    async function performTokenValidation() {
        // 从URL获取token
        const token = getTokenFromUrl();

        // 本地部署：链接未带 token 时不拦截（局域网直接访问即可使用）
        if (!token) {
            return;
        }

        // 验证token
        const isValid = await validateToken(token);

        // 如果token无效，跳转到error.html页面
        if (!isValid) {
            window.location.href = '/error.html';
        }
    }

    /**
     * 当DOM加载完成后执行token验证
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performTokenValidation);
    } else {
        performTokenValidation();
    }

    // 导出方法供外部使用（如果需要）
    window.TokenValidator = {
        getTokenFromUrl: getTokenFromUrl,
        validateToken: validateToken
    };
})();