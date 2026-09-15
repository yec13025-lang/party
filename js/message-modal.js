// 自定义消息提示框函数
function showToast(options, type = 'info', duration = 3000) {
    // 兼容性检查：获取所有可能的元素
    const toast = document.getElementById('customToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    const toastClose = document.getElementById('toastClose');
    
    // 如果核心元素不存在，降级处理
    if (!toast || !toastMessage || !toastIcon) {
        // 尝试使用简单的alert作为降级方案
        console.warn('Toast elements not found, falling back to alert');
        alert(typeof options === 'string' ? options : options.message || '消息提示');
        return function() {}; // 返回空函数以保持API一致
    }
    
    // 处理参数格式，支持字符串直接作为消息内容
    let title, message;
    if (typeof options === 'string') {
        // 向后兼容：如果第一个参数是字符串，则作为消息内容
        title = type === 'success' ? '成功' : type === 'error' ? '错误' : type === 'warning' ? '警告' : '提示';
        message = options;
    } else {
        // 新格式：支持对象传入标题和内容
        title = options.title || (type === 'success' ? '成功' : type === 'error' ? '错误' : type === 'warning' ? '警告' : '提示');
        message = options.message || '';
    }
    
    // 设置消息内容，支持HTML格式
    if (toastTitle) {
        toastTitle.innerHTML = title;
    }
    toastMessage.innerHTML = message;
    
    // 重置所有样式
    try {
        toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 rounded-xl shadow-2xl p-5 flex items-start space-x-4 max-w-md w-full z-[70] transition-all duration-400 opacity-0 translate-y-[-20px] pointer-events-none text-white';
        toastIcon.className = 'w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0';
    } catch (e) {
        console.warn('Error resetting toast styles:', e);
    }
    
    // 根据类型设置不同的样式
    try {
        if (type === 'success') {
            // 成功消息：绿色背景
            toast.classList.add('bg-gradient-to-r', 'from-green-500', 'to-green-600', 'text-white');
            toastIcon.classList.add('bg-white', 'text-green-500');
            toastIcon.innerHTML = '<i class="fa fa-check-circle"></i>';
        } else if (type === 'error') {
            // 错误消息：红色背景
            toast.classList.add('bg-gradient-to-r', 'from-red-500', 'to-red-600', 'text-white');
            toastIcon.classList.add('bg-white', 'text-red-500');
            toastIcon.innerHTML = '<i class="fa fa-exclamation-circle"></i>';
        } else if (type === 'warning') {
            // 警告消息：橙色背景
            toast.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-orange-600', 'text-white');
            toastIcon.classList.add('bg-white', 'text-orange-500');
            toastIcon.innerHTML = '<i class="fa fa-exclamation-triangle"></i>';
        } else {
            // 信息消息：默认样式
            toast.classList.add('bg-gradient-to-r', 'from-blue-500', 'to-blue-600', 'text-white');
            toastIcon.classList.add('bg-white', 'text-blue-500');
            toastIcon.innerHTML = '<i class="fa fa-info-circle"></i>';
        }
        
        // 添加动画和缩放效果，使弹窗更明显
        if (typeof toast.classList !== 'undefined') {
            toast.classList.add('animate-bounce-once');
        }
    } catch (e) {
        console.warn('Error setting toast type styles:', e);
    }
    
    // 显示提示框
    setTimeout(() => {
        try {
            toast.classList.remove('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
            toast.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
        } catch (e) {
            console.warn('Error showing toast:', e);
        }
    }, 10);
    
    // 自动关闭
    const timer = setTimeout(() => {
        hideToast();
    }, duration);
    
    // 点击关闭按钮
    function handleClose() {
        hideToast();
        clearTimeout(timer);
    }
    
    // 添加事件监听器，确保元素存在
    if (toastClose) {
        toastClose.addEventListener('click', handleClose);
    }
    
    function hideToast() {
        try {
            toast.classList.add('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
            toast.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');

            // 移除事件监听器
            if (toastClose) {
                toastClose.removeEventListener('click', handleClose);
            }
        } catch (e) {
            console.warn('Error hiding toast:', e);
        }
    }
    
    return hideToast; // 返回隐藏函数，方便手动隐藏
}

// 覆盖alert函数
function setupAlertOverride() {
    window.alert = function(message) {
        showToast(message, 'info');
    };
}

// 覆盖confirm函数
function setupConfirmOverride() {
    window.confirm = function(message) {
        return new Promise((resolve) => {
            // 创建确认弹窗
            const confirmModal = document.createElement('div');
            confirmModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]';
            confirmModal.innerHTML = `
                <div class="bg-white rounded-2xl max-w-md w-[90%] mx-auto shadow-xl overflow-hidden">
                    <div class="p-6">
                        <p class="text-center text-headline text-lg mb-6">${message}</p>
                        <div class="flex space-x-4">
                            <button id="confirmCancel" class="flex-1 py-3 px-6 rounded-xl border border-gray-300 text-headline font-medium hover:bg-gray-50 transition-all">
                                取消
                            </button>
                            <button id="confirmOk" class="flex-1 py-3 px-6 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all">
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmModal);
            
            // 添加动画效果
            const modalContent = confirmModal.querySelector('div');
            modalContent.style.opacity = '0';
            modalContent.style.transform = 'translateY(-20px)';
            modalContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            setTimeout(() => {
                modalContent.style.opacity = '1';
                modalContent.style.transform = 'translateY(0)';
            }, 10);
            
            // 绑定事件
            const cancelBtn = confirmModal.querySelector('#confirmCancel');
            const okBtn = confirmModal.querySelector('#confirmOk');
            
            function handleCancel() {
                modalContent.style.opacity = '0';
                modalContent.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    document.body.removeChild(confirmModal);
                    resolve(false);
                }, 300);
            }
            
            function handleOk() {
                modalContent.style.opacity = '0';
                modalContent.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    document.body.removeChild(confirmModal);
                    resolve(true);
                }, 300);
            }
            
            cancelBtn.addEventListener('click', handleCancel);
            okBtn.addEventListener('click', handleOk);
            
            // 点击外部关闭
            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) {
                    handleCancel();
                }
            });
            
            // ESC键关闭
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            
            document.addEventListener('keydown', handleEsc);
        });
    };
}

// 初始化所有消息弹窗相关功能
function initMessageSystem() {
    setupAlertOverride();
    setupConfirmOverride();
}

initMessageSystem();