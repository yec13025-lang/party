// 草稿箱模块
class DraftBox {
    constructor(options = {}) {
        this.storageKey = 'happy-birthday-drafts';
        this.autoSaveInterval = options.autoSaveInterval || 30000; // 30秒自动保存
        this.debounceTime = options.debounceTime || 500; // 防抖时间
        this.currentPage = this.getCurrentPage();
        this.autoSaveTimer = null;
        this.debounceTimer = null;
        this.isSaving = false;
        this.isTransitioning = false; // 新增：防止快速点击导致的状态混乱
        this.baselineHash = null;
        this.lastSavedHash = null;
        
        // 初始化
        this.init();
    }
    
    // 初始化草稿箱
    init() {
        // 绑定自动保存事件
        this.bindAutoSaveEvents();
        
        // 启动自动保存定时器
        this.startAutoSave();
        
        // 页面卸载前保存
        window.addEventListener('beforeunload', () => {
            this.saveDraft();
        });
        
        // 创建草稿箱UI
        this.createDraftBoxUI();
        
        // 生日滚轮初始化后会写入默认当天日期，延迟捕获空表单基准
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.captureBaselineSnapshot();
            });
        });
    }
    
    hashFormData(data) {
        const normalized = {};
        const keys = ['name', 'birthday', 'sender', 'themeColor', 'blessingMessage', 'email', 'emailSendTime'];
        keys.forEach((key) => {
            normalized[key] = String(data[key] || '').trim();
        });
        for (let i = 1; i <= 9; i++) {
            normalized[`text${i}`] = String(data[`text${i}`] || '').trim();
        }
        const str = JSON.stringify(normalized);
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }
    
    captureBaselineSnapshot() {
        const formData = this.getFormData();
        this.baselineHash = this.hashFormData(formData);
    }
    
    isBaselineDraftData(data) {
        if (this.baselineHash == null) return false;
        return this.hashFormData(data) === this.baselineHash;
    }
    
    getDisplayableDrafts() {
        return this.getDrafts().filter((draft) => {
            if (draft.page !== this.currentPage) return false;
            if (this.isBaselineDraftData(draft.data || {})) return false;
            return true;
        });
    }
    
    purgeBaselineDraftsFromStorage() {
        if (this.baselineHash == null) return;
        const drafts = this.getDrafts();
        const filtered = drafts.filter((draft) => !this.isBaselineDraftData(draft.data || {}));
        if (filtered.length !== drafts.length) {
            localStorage.setItem(this.storageKey, JSON.stringify(filtered));
        }
    }
    
    // 获取当前页面类型
    getCurrentPage() {
        const pathname = window.location.pathname;
        
        // 更灵活的页面类型识别逻辑
        if (pathname.includes('index.base.html') || pathname.endsWith('index.base.html')) return 'base';
        if (pathname.includes('index.audio.html') || pathname.endsWith('index.audio.html')) return 'audio';
        if (pathname.includes('index.picture.html') || pathname.endsWith('index.picture.html')) return 'picture';
        
        // 对于直接访问index.html的情况，默认为base类型
        if (pathname === '/' || pathname.endsWith('/') || pathname.endsWith('index.html')) return 'base';
        
        return 'unknown';
    }
    
    // 绑定自动保存事件
    bindAutoSaveEvents() {
        // 监听表单输入事件
        document.addEventListener('input', () => {
            this.debounceSave();
        });
        
        // 监听表单选择事件
        document.addEventListener('change', () => {
            this.debounceSave();
        });
    }
    
    // 防抖保存
    debounceSave() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.saveDraft();
        }, this.debounceTime);
    }
    
    // 启动自动保存定时器
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            this.saveDraft();
        }, this.autoSaveInterval);
    }
    
    // 停止自动保存定时器
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    // 生成唯一草稿ID
    generateDraftId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // 获取所有草稿
    getDrafts() {
        try {
            const drafts = localStorage.getItem(this.storageKey);
            return drafts ? JSON.parse(drafts) : [];
        } catch (error) {
            console.error('获取草稿失败:', error);
            return [];
        }
    }
    
    // 保存草稿
    saveDraft() {
        if (this.isSaving) return;
        
        this.isSaving = true;
        
        try {
            const formData = this.getFormData();
            
            // 如果表单数据为空或与基准/上次相同，不保存
            if (!this.shouldSaveDraft(formData)) {
                this.isSaving = false;
                return;
            }
            
            const currentHash = this.hashFormData(formData);
            
            let drafts = this.getDrafts();
            const now = new Date();
            
            // 生成草稿标题
            const title = this.generateDraftTitle(formData);
            
            // 检查是否已有相同页面的草稿
            const existingDraftIndex = drafts.findIndex(draft => 
                draft.page === this.currentPage && draft.data.name === formData.name
            );
            
            const draftData = {
                draftId: existingDraftIndex >= 0 ? drafts[existingDraftIndex].draftId : this.generateDraftId(),
                page: this.currentPage,
                title: title,
                data: formData,
                createdAt: existingDraftIndex >= 0 ? drafts[existingDraftIndex].createdAt : now.toISOString(),
                updatedAt: now.toISOString()
            };
            
            // 更新或添加草稿
            if (existingDraftIndex >= 0) {
                drafts[existingDraftIndex] = draftData;
            } else {
                drafts.push(draftData);
            }
            
            // 限制草稿数量，每个页面最多保存5个草稿
            const maxDraftsPerPage = 5;
            const pageDrafts = drafts.filter(draft => draft.page === this.currentPage);
            
            // 如果当前页面草稿超过限制，只保留最新的N个
            if (pageDrafts.length > maxDraftsPerPage) {
                // 按更新时间排序，保留最新的
                pageDrafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                const draftsToKeep = pageDrafts.slice(0, maxDraftsPerPage);
                
                // 重新构建drafts数组，保留其他页面的草稿和当前页面的最新草稿
                const otherDrafts = drafts.filter(draft => draft.page !== this.currentPage);
                drafts = [...otherDrafts, ...draftsToKeep];
            }
            
            // 保存到localStorage
            localStorage.setItem(this.storageKey, JSON.stringify(drafts));
            this.lastSavedHash = currentHash;
            
            // 更新草稿箱UI
            this.updateDraftBoxUI();
            
            this.isSaving = false;
        } catch (error) {
            console.error('保存草稿失败:', error);
            // 显示用户友好的错误信息
            if (error.name === 'QuotaExceededError') {
                this.showToast('草稿保存失败，存储空间不足，请清理部分草稿', 'error', 3000);
            } else {
                this.showToast('草稿保存失败，请稍后重试', 'error', 2000);
            }
            this.isSaving = false;
        }
    }
    
    shouldSaveDraft(formData) {
        const currentHash = this.hashFormData(formData);
        if (this.baselineHash != null && currentHash === this.baselineHash) {
            return false;
        }
        if (this.lastSavedHash != null && currentHash === this.lastSavedHash) {
            return false;
        }
        const hasAdvancedText = Array.from({length: 9}, (_, i) => formData[`text${i + 1}`])
            .some(text => !!(text && text.trim()));
        return !!(formData.name || formData.sender || formData.blessingMessage || hasAdvancedText);
    }
    
    formatDraftCopyText(draft) {
        const data = draft.data || {};
        const lines = ['【数字糖果铺·草稿内容】'];
        if (data.name) lines.push('寿星昵称：' + data.name);
        if (data.birthday) lines.push('生日：' + data.birthday);
        if (data.sender) lines.push('发送人昵称：' + data.sender);
        if (data.themeColor) lines.push('主题色：' + data.themeColor);
        if (data.blessingMessage) lines.push('祝福语：' + data.blessingMessage);
        for (let i = 1; i <= 9; i++) {
            const val = data[`text${i}`];
            if (val && String(val).trim()) {
                lines.push('高级祝福语' + i + '：' + val);
            }
        }
        if (data.email) lines.push('邮箱：' + data.email);
        if (data.emailSendTime) lines.push('邮件发送时间：' + data.emailSendTime);
        lines.push('备注：图片、录音、背景音乐不在草稿内，需另行提供');
        return lines.join('\n');
    }
    
    async copyDraftToClipboard(draft) {
        const text = this.formatDraftCopyText(draft);
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            this.showToast('草稿内容已复制，可发送给客服', 'success', 2000);
        } catch (error) {
            console.error('复制草稿失败:', error);
            this.showToast('复制失败，请稍后重试', 'error', 2000);
        }
    }
    
    // 生成草稿标题
    generateDraftTitle(formData) {
        const maxLength = 5; // 限制名称最大长度为5个字符
        
        if (formData.name) {
            // 只截断姓名部分，保留完整后缀
            const name = formData.name;
            const shortName = name.length > maxLength ? 
                `${name.substring(0, maxLength)}…` : name;
            return `${shortName}的生日贺卡`;
        } else if (formData.sender) {
            // 只截断祝福者名字部分，保留完整后缀
            const sender = formData.sender;
            const shortSender = sender.length > maxLength ? 
                `${sender.substring(0, maxLength)}…` : sender;
            return `${shortSender}制作的贺卡`;
        } else {
            return `未命名草稿_${new Date().toLocaleString()}`;
        }
    }
    
    // 获取表单数据
    getFormData() {
        const formData = {
            name: document.getElementById('name')?.value || '',
            birthday: document.getElementById('birthday')?.value || '',
            sender: document.getElementById('sender')?.value || '',
            themeColor: document.querySelector('input[name="themeColor"]:checked')?.value || 'pink',
            blessingMessage: document.getElementById('blessingMessage')?.value || '',
            email: document.getElementById('email')?.value || '',
            emailSendTime: document.getElementById('emailSendTime')?.value || ''
        };
        // 兼容高级设置：text1~text9
        for (let i = 1; i <= 9; i++) {
            formData[`text${i}`] = document.getElementById(`text${i}`)?.value || '';
        }
        
        return formData;
    }
    
    // 设置表单数据
    setFormData(data) {
        // 设置基本信息
        if (document.getElementById('name')) {
            document.getElementById('name').value = data.name || '';
        }
        
        if (document.getElementById('birthday')) {
            const birthdayEl = document.getElementById('birthday');
            if (birthdayEl.type === 'date' && window.hbBirthday && typeof window.hbBirthday.mmddToDateValue === 'function') {
                birthdayEl.value = window.hbBirthday.mmddToDateValue(data.birthday || '');
            } else {
                birthdayEl.value = data.birthday || '';
            }
            if (
                birthdayEl.dataset &&
                birthdayEl.dataset.hbPicker === 'wheel' &&
                window.hbWheelPicker &&
                typeof window.hbWheelPicker.setBirthdayYmd === 'function'
            ) {
                const raw = String(data.birthday || birthdayEl.value || '').trim();
                let ymdArg = '';
                if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(raw)) {
                    ymdArg = raw.replace(/-/g, '/');
                } else if (window.hbBirthday && typeof window.hbBirthday.mmddToDateValue === 'function') {
                    ymdArg = window.hbBirthday.mmddToDateValue(raw);
                }
                if (ymdArg) {
                    window.hbWheelPicker.setBirthdayYmd(birthdayEl, ymdArg);
                }
            }
        }
        
        if (document.getElementById('sender')) {
            document.getElementById('sender').value = data.sender || '';
        }
        
        // 设置主题颜色
        const themeColorRadio = document.querySelector(`input[name="themeColor"][value="${data.themeColor || 'pink'}"]`);
        if (themeColorRadio) {
            themeColorRadio.checked = true;
            // 触发change事件，更新样式
            themeColorRadio.dispatchEvent(new Event('change'));
        }
        
        if (document.getElementById('blessingMessage')) {
            document.getElementById('blessingMessage').value = data.blessingMessage || '';
        }
        
        if (document.getElementById('email')) {
            document.getElementById('email').value = data.email || '';
        }
        
        if (document.getElementById('emailSendTime')) {
            const emailTimeEl = document.getElementById('emailSendTime');
            emailTimeEl.value = data.emailSendTime || '';
            if (
                window.hbWheelPicker &&
                typeof window.hbWheelPicker.parseEmailToDate === 'function' &&
                typeof window.hbWheelPicker.setEmailSendFromDate === 'function'
            ) {
                const dt = window.hbWheelPicker.parseEmailToDate(emailTimeEl.value);
                if (dt) {
                    window.hbWheelPicker.setEmailSendFromDate(emailTimeEl, dt);
                }
            }
        }
        // 回填高级设置：text1~text9
        for (let i = 1; i <= 9; i++) {
            const textField = document.getElementById(`text${i}`);
            if (textField) {
                textField.value = data[`text${i}`] || '';
            }
        }
        
    }
    
    // 加载草稿
    loadDraft(draftId) {
        try {
            const drafts = this.getDrafts();
            const draft = drafts.find(d => d.draftId === draftId);
            
            if (draft) {
                this.setFormData(draft.data);
                this.showLoadSuccessModal(draft.title);
                // 关闭草稿箱
                this.toggleDraftBox();
            }
        } catch (error) {
            console.error('加载草稿失败:', error);
            this.showToast('加载草稿失败', 'error', 2000);
        }
    }
    
    
    // 清除所有草稿
    async clearAllDrafts() {
        // 优化确认逻辑，确保只有用户明确确认后才执行
        const userConfirmed = await confirm('确定要清除所有草稿吗？此操作不可恢复。');

        // 确保只有在用户明确点击"确定"后才执行清空操作
        if (userConfirmed === true) {
            try {
                // 直接清除所有草稿，不依赖页面类型识别，确保功能可靠
                localStorage.removeItem(this.storageKey);

                // 强制更新UI
                this.updateDraftBoxUI();

                // 显示提示消息
                this.showToast('所有草稿已清除', 'success', 2000);
            } catch (error) {
                console.error('清除草稿失败:', error);
                this.showToast('清除草稿失败', 'error', 2000);
            }
        }
    }
    
    // 创建草稿箱UI
    createDraftBoxUI() {
        // 检查是否已存在草稿箱UI
        if (document.getElementById('draft-box')) {
            return;
        }
        
        // 创建草稿箱按钮
        const draftBoxButton = document.createElement('button');
        draftBoxButton.id = 'draft-box-button';
        draftBoxButton.className = 'fixed bottom-6 left-2 px-3 py-1.5 bg-links/80 text-white rounded-lg shadow-lg flex items-center justify-center text-xs cursor-pointer hover:bg-links transition-all transform hover:scale-105 z-40';
        draftBoxButton.innerHTML = '<span>草稿箱</span>';
        draftBoxButton.title = '草稿箱';
        
        // 创建草稿箱面板
        const draftBoxPanel = document.createElement('div');
        draftBoxPanel.id = 'draft-box';
        draftBoxPanel.className = 'fixed bottom-20 left-6 bg-white rounded-xl shadow-2xl p-4 max-w-sm w-[90%] z-40 transform -translate-y-full opacity-0 transition-all duration-300 pointer-events-none';
        
        // 添加响应式样式
        const style = document.createElement('style');
        style.textContent = `
            /* 全局样式，确保所有设备上的长标题都能正确显示 */
            #draft-box .font-medium.text-headline {
                white-space: nowrap;
                overflow: visible;
                text-overflow: unset;
                max-width: none;
                font-size: 0.95rem;
                flex-shrink: 1;
            }
            
            /* 调整草稿项布局，确保标题区域有足够空间 */
            #draft-box .flex.justify-between.items-start {
                flex-wrap: nowrap;
                align-items: flex-start;
            }
            
            #draft-box .bg-gray-50 p-3 {
                display: flex;
                flex-direction: column;
            }
            
            /* 调整按钮区域，确保按钮不会挤压标题 */
            #draft-box .flex.space-x-2 {
                flex-shrink: 0;
                margin-left: 0.5rem;
            }
            
            @media (max-width: 768px) {
                #draft-box {
                    width: calc(100vw - 3rem);
                    max-width: none;
                    left: 1.5rem;
                    right: auto;
                    padding: 1rem;
                }
                
                #draft-box h3 {
                    font-size: 1.1rem;
                }
                
                #drafts-list {
                    max-h-52;
                }
                
                #draft-box .bg-gray-50 {
                    padding: 0.8rem;
                    margin-bottom: 0.5rem;
                }
                
                #draft-box .text-lg {
                    font-size: 1rem;
                }
                
                #draft-box .py-1 {
                    padding-top: 0.3rem;
                    padding-bottom: 0.3rem;
                }
                
                #draft-box .px-3 {
                    padding-left: 0.7rem;
                    padding-right: 0.7rem;
                }
            }
        `;
        document.head.appendChild(style);
        
        draftBoxPanel.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-headline">草稿箱</h3>
                <button id="close-draft-box" class="text-gray-500 hover:text-gray-700 transition-colors">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <p class="text-xs text-gray-500 mb-3">暂不支持暂存：图片、录音、背景音乐，其余均可暂存</p>
            <div id="drafts-list" class="max-h-60 overflow-y-auto mb-4"></div>
            <div class="flex justify-end space-x-2">
                <button id="clear-all-drafts" class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors">
                    清除所有
                </button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(draftBoxButton);
        document.body.appendChild(draftBoxPanel);
        
        // 绑定事件
        draftBoxButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止事件冒泡
            this.toggleDraftBox();
        });
        
        const closeButton = document.getElementById('close-draft-box');
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                this.closeDraftBox(); // 直接调用关闭方法，更可靠
            });
        }
        
        const clearButton = document.getElementById('clear-all-drafts');
        if (clearButton) {
            clearButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                this.clearAllDrafts();
            });
        }
        
        // 点击外部关闭草稿箱
        document.addEventListener('click', (e) => {
            const draftBox = document.getElementById('draft-box');
            const draftBoxButton = document.getElementById('draft-box-button');
            
            // 检查是否点击了草稿箱外部
            if (draftBox && draftBoxButton && 
                !draftBox.contains(e.target) && 
                e.target !== draftBoxButton) {
                this.closeDraftBox();
            }
        });
        
        // 初始更新UI
        this.updateDraftBoxUI();
    }
    
    // 切换草稿箱显示/隐藏
    toggleDraftBox() {
        const draftBox = document.getElementById('draft-box');
        if (!draftBox) return;
        
        // 防止快速点击导致的状态混乱
        if (this.isTransitioning) return;
        
        this.isTransitioning = true;
        
        if (draftBox.classList.contains('opacity-0')) {
            this.openDraftBox();
        } else {
            this.closeDraftBox();
        }
        
        // 过渡结束后重置状态
        setTimeout(() => {
            this.isTransitioning = false;
        }, 300); // 与CSS过渡时间一致
    }
    
    // 打开草稿箱
    openDraftBox() {
        const draftBox = document.getElementById('draft-box');
        if (!draftBox) return;
        
        // 确保状态正确
        draftBox.style.display = 'block';
        requestAnimationFrame(() => {
            draftBox.classList.remove('opacity-0', '-translate-y-full', 'pointer-events-none');
            draftBox.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
        });
        
        // 更新草稿列表
        this.purgeBaselineDraftsFromStorage();
        this.updateDraftBoxUI();
    }
    
    // 关闭草稿箱
    closeDraftBox() {
        const draftBox = document.getElementById('draft-box');
        if (!draftBox) return;
        
        draftBox.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
        draftBox.classList.add('opacity-0', '-translate-y-full', 'pointer-events-none');
    }
    
    // 更新草稿箱UI
    updateDraftBoxUI() {
        const draftsList = document.getElementById('drafts-list');
        if (!draftsList) return;
        const drafts = this.getDisplayableDrafts();
        
        if (drafts.length === 0) {
            draftsList.innerHTML = '<p class="text-gray-500 text-center py-4">暂无草稿</p>';
            return;
        }
        
        // 按更新时间降序排序
        drafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        draftsList.innerHTML = drafts.map(draft => {
            const updatedAt = new Date(draft.updatedAt).toLocaleString();
            let displayTitle = draft.title;
            
            // 检查标题是否是完整格式，如果不是，重新生成
            if (!displayTitle.includes('的生日贺卡') && !displayTitle.includes('制作的贺卡') && !displayTitle.includes('未命名草稿')) {
                // 这是一个旧格式的草稿，只包含截断的姓名，需要重新生成完整标题
                const name = displayTitle.replace(/…$/, ''); // 移除可能存在的省略号
                const shortName = name.length > 5 ? `${name.substring(0, 5)}…` : name;
                displayTitle = `${shortName}的生日贺卡`;
            }
            
            return `
                <div class="bg-gray-50 p-3 rounded-lg mb-2">
                    <div class="flex justify-between items-start">
                        <div style="min-width: 0; flex: 1;">
                            <h4 class="font-medium text-headline" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayTitle}</h4>
                            <p class="text-xs text-gray-500 mt-1">${updatedAt}</p>
                        </div>
                        <div class="flex space-x-2" style="flex-shrink: 0; margin-left: 0.5rem;">
                            <button class="load-draft-btn text-xs bg-primary text-white py-1 px-3 rounded-full hover:bg-primary/90 transition-colors" data-draft-id="${draft.draftId}">
                                加载
                            </button>
                            <button class="copy-draft-btn text-xs bg-red-100 text-red-700 py-1 px-3 rounded-full hover:bg-red-200 transition-colors" data-draft-id="${draft.draftId}">
                                复制
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // 绑定事件
        draftsList.querySelectorAll('.load-draft-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const draftId = e.target.dataset.draftId;
                this.loadDraft(draftId);
            });
        });
        
        draftsList.querySelectorAll('.copy-draft-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const draftId = e.currentTarget.dataset.draftId;
                const draft = this.getDrafts().find(d => d.draftId === draftId);
                if (draft) {
                    this.copyDraftToClipboard(draft);
                }
            });
        });
    }
    
    showLoadSuccessModal(title) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center z-[95]';
        overlay.innerHTML = `
            <div class="bg-white text-headline rounded-xl shadow-2xl px-6 py-5 max-w-sm w-[88%] text-center font-sans leading-8">
                草稿“${title}”回填成功<br>可以继续编辑制作贺卡啦
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 1800);
    }

    // 显示提示消息
    showToast(message, type = 'success', duration = 2000) {
        // 与 message-modal.js 的全局 showToast 对齐：页面已有 #customToast（含标题区），
        // 若仅改 toastMessage 且用内联背景色，会残留上一次的标题与 Tailwind 红/蓝渐变样式。
        if (typeof window.showToast === 'function') {
            const title =
                type === 'success'
                    ? '成功'
                    : type === 'error'
                      ? '错误'
                      : type === 'warning'
                        ? '警告'
                        : '提示';
            window.showToast({ title, message }, type, duration);
            return;
        }

        // 检查是否已有toast元素
        let toast = document.getElementById('customToast');
        
        if (!toast) {
            // 创建toast元素
            toast = document.createElement('div');
            toast.id = 'customToast';
            toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 rounded-xl shadow-2xl p-4 flex items-start space-x-4 max-w-md w-[90%] mx-auto text-white z-50 transition-all duration-300 opacity-0 translate-y-[-20px] pointer-events-none';
            toast.innerHTML = `
                <div id="toastIcon" class="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                    <i class="fa fa-info-circle"></i>
                </div>
                <div class="flex-1">
                    <div id="toastMessage" class="font-medium text-white"></div>
                </div>
                <button id="toastClose" class="text-white hover:text-gray-200 transition-colors p-1">
                    <i class="fa fa-times"></i>
                </button>
            `;
            document.body.appendChild(toast);
            
            // 绑定关闭事件
            document.getElementById('toastClose').addEventListener('click', () => {
                this.hideToast();
            });
        }
        
        // 设置消息内容和样式
        document.getElementById('toastMessage').textContent = message;
        
        // 设置不同类型的样式
        switch (type) {
            case 'success':
                toast.style.backgroundColor = '#10b981';
                document.getElementById('toastIcon').innerHTML = '<i class="fa fa-check-circle"></i>';
                break;
            case 'error':
                toast.style.backgroundColor = '#ef4444';
                document.getElementById('toastIcon').innerHTML = '<i class="fa fa-exclamation-circle"></i>';
                break;
            case 'info':
                toast.style.backgroundColor = '#3b82f6';
                document.getElementById('toastIcon').innerHTML = '<i class="fa fa-info-circle"></i>';
                break;
            default:
                toast.style.backgroundColor = '#6b7280';
        }
        
        // 显示toast
        toast.classList.remove('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
        toast.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
        
        // 自动隐藏
        setTimeout(() => {
            this.hideToast();
        }, duration);
    }
    
    // 隐藏提示消息
    hideToast() {
        const toast = document.getElementById('customToast');
        if (toast) {
            toast.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
            toast.classList.add('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
        }
    }
}

// 初始化草稿箱
let draftBox;
document.addEventListener('DOMContentLoaded', () => {
    draftBox = new DraftBox();
});
