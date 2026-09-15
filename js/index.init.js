(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var genBtn = document.querySelector('.generate-btn');
        if (genBtn && genBtn.dataset.hbGenerateBound !== '1') {
            genBtn.dataset.hbGenerateBound = '1';
            if (!genBtn.dataset.hbGenerateOrigHtml) {
                genBtn.dataset.hbGenerateOrigHtml = genBtn.innerHTML;
            }
            genBtn.addEventListener('click', function () {
                if (window.hbEditMode && window.hbEditMode.isEditMode()) {
                    Promise.resolve(window.hbEditMode.updateBlessing());
                } else {
                    Promise.resolve(generateLink());
                }
            });
        }

        if (window.hbEditMode && typeof window.hbEditMode.initFromUrl === 'function') {
            window.hbEditMode.initFromUrl();
        }
        
        // 显示浏览器推荐提示弹窗
        showBrowserRecommendModal();
    });
    
    // 显示浏览器推荐提示弹窗
    function showBrowserRecommendModal() {
        // 检查是否已经显示过（使用sessionStorage，只在当前会话显示一次）
        if (sessionStorage.getItem('browserRecommendShown')) {
            return;
        }
        
        // 检测是否在QQ或支付宝内置浏览器中
        const ua = navigator.userAgent.toLowerCase();
        const isQQ = /qq\//.test(ua) || /qqbrowser/.test(ua);
        const isAlipay = /alipay/.test(ua);
        const isWechat = /micromessenger/.test(ua);
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.id = 'browserRecommendModal';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-sm w-[90%] mx-auto shadow-2xl overflow-hidden transform scale-95 opacity-0 transition-all duration-300">
                <div class="p-6">
                    <h3 class="text-xl font-bold text-headline text-center mb-4">温馨提示</h3>
                    <p class="text-gray-600 text-center mb-6 leading-relaxed">
                        <span class="text-links font-semibold">推荐使用微信，发给文件传输助手或自己</span><br>
                        打开链接制作<br>
                        左下角可查看
                        <span class="font-bold text-links">「我的制作」</span>
                        和
                        <span class="font-bold text-links">「草稿箱」</span>
                    </p>
                    <button id="closeBrowserModal" class="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-links to-linksAlt text-white font-medium hover:opacity-90 transition-all">
                        我知道了
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 动画显示
        setTimeout(() => {
            const modalContent = modal.querySelector('div');
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('scale-100', 'opacity-100');
        }, 10);
        
        // 关闭按钮事件
        const closeBtn = modal.querySelector('#closeBrowserModal');
        closeBtn.addEventListener('click', function() {
            const modalContent = modal.querySelector('div');
            modalContent.classList.remove('scale-100', 'opacity-100');
            modalContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
        
        // 点击外部关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeBtn.click();
            }
        });
        
        // 标记已显示
        sessionStorage.setItem('browserRecommendShown', 'true');
    }

    async function generateLink() {
        if (window.__hbGenerateInFlight) {
            return;
        }
        window.__hbGenerateInFlight = true;
        const btn = document.querySelector('.generate-btn');
        try {
            const maxBlessingLength = 4000;
            const name = document.getElementById('name').value.trim();
            const birthday = document.getElementById('birthday').value.trim();
            const email = document.getElementById('email').value.trim();
            const emailSendTime = document.getElementById('emailSendTime')?.value.trim() || ''; // 获取邮件发送时间
            const sender = document.getElementById('sender').value.trim();
            let blessingMessage = document.getElementById('blessingMessage').value.trim();
            const timeDisplay = document.getElementById('timeDisplay')?.innerText || '0';
            // 由于index.all.html已移除text1和text2字段，这里不再获取这些字段的值
            if (!name || !birthday || !sender) {
                const firstMissingId = !name ? 'name' : (!birthday ? 'birthday' : 'sender');
                const firstMissingEl = document.getElementById(firstMissingId);
                if (firstMissingEl) {
                    firstMissingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstMissingEl.focus();
                }
                if (window.showToast) {
                    showToast({ title: '提示', message: '该字段必填' }, 'warning', 2200);
                } else {
                    alert('该字段必填');
                }
                return;
            }
            if (name.length > 16) {
                alert('寿星姓名最多输入16个字符');
                return;
            }
            const birthdayValidation = window.hbBirthday
                ? window.hbBirthday.validateBirthday(birthday, true)
                : { valid: birthday.length === 4 && /^\d{4}$/.test(birthday), value: birthday, message: '生日格式应为4位数字（如：0520）' };
            if (!birthdayValidation.valid) {
                alert(birthdayValidation.message);
                return;
            }
            if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                alert('邮箱格式不正确，请检查');
                return;
            }
            // 邮箱发送时间验证（如果有值）；滚轮格式 yyyy/mm/dd hh:mm 在 Safari 下不能依赖原生 Date(string)
            if (emailSendTime) {
                let selectedTime = new Date(emailSendTime);
                if (
                    (Number.isNaN(selectedTime.getTime()) || selectedTime.getTime() <= 0) &&
                    window.hbWheelPicker &&
                    typeof window.hbWheelPicker.parseEmailToDate === 'function'
                ) {
                    const parsed = window.hbWheelPicker.parseEmailToDate(emailSendTime);
                    selectedTime = parsed || selectedTime;
                }
                const currentTime = new Date();
                if (Number.isNaN(selectedTime.getTime()) || selectedTime <= currentTime) {
                    alert('邮件发送时间必须是当前时间之后的时间');
                    return;
                }
            }
            if (blessingMessage.length > maxBlessingLength) {
                alert('祝福语长度不能超过2000字');
                return;
            }
            if (!blessingMessage) {
                blessingMessage = [
                    '成长不期而遇，生日如期而至，愿你遍历山河，仍觉人间值得！',
                    '愿你永远璀璨如星，永远明媚如光，永远温暖纯真，生日快乐！',
                ][Math.floor(Math.random() * 2)];
            }
            if (!btn) {
                return;
            }
            if (!btn.dataset.hbGenerateOrigHtml) {
                btn.dataset.hbGenerateOrigHtml = btn.innerHTML;
            }
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.innerHTML =
                '<i class="fa fa-spinner fa-spin mr-2" aria-hidden="true"></i><span>生成中...</span>';
            const resultDiv = document.getElementById('result');
            if (resultDiv) resultDiv.innerHTML = '🎁 生成中，请稍候...';
            const copyBtnEl = document.querySelector('.copy-btn');
            if (copyBtnEl) copyBtnEl.style.display = 'none';
            const sec = document.getElementById('posterSection');
            if (sec) sec.style.display = 'none';
            window.__posterDataUrl = null;
            const themeColor = document.querySelector('input[name="themeColor"]:checked')?.value || '';
            const body = {
                userName: name,
                birthday: birthdayValidation.value,
                celebrantEmail: email,
                emailSendTime, // 添加邮件发送时间字段
                sender,
                images: window.__recommendedImageGroup ? [] : (window.uploadedImages || []).map(img => img.data),
                blessingMessage,
                themeColor
            };
            if (window.__recommendedImageGroup) {
                body.recommendedImageGroup = window.__recommendedImageGroup;
            }
            // 图片版/录音版高级设置：兼容提交 text1~text9
            for (let i = 1; i <= 9; i++) {
                const textField = document.getElementById(`text${i}`);
                if (textField) {
                    body[`text${i}`] = textField.value.trim();
                }
            }
            if (window.__audioState && window.__audioState.audioBlob) {
                body.audio = await convertBlobToBase64(window.__audioState.audioBlob);
                body.timeDisplay = timeDisplay;
            }

            // 添加音频文件处理逻辑 - 将File对象转换为Base64字符串
            async function processAudioFiles() {
                // 处理自动化音乐
                if (document.getElementById('automationMusic')?.files[0]) {
                    body.automationMusicData = await convertFileToBase64(document.getElementById('automationMusic').files[0]);
                } else if (window.__recommendedMusicKey) {
                    body.recommendedMusicKey = window.__recommendedMusicKey;
                }

                // 处理蛋糕音乐
                if (document.getElementById('birthcakeMusic')?.files[0]) {
                    body.birthcakeMusicData = await convertFileToBase64(document.getElementById('birthcakeMusic').files[0]);
                }

                // 处理回忆音乐
                if (document.getElementById('memoriesMusic')?.files[0]) {
                    body.memoriesMusicData = await convertFileToBase64(document.getElementById('memoriesMusic').files[0]);
                }
            }

            // 先处理音频文件
            await processAudioFiles();

            // 预检请求体体积：base64 会把二进制放大 4/3。超过服务端上限时直接给出可操作的提示，
            // 而不是发出请求后被 413 中断（那样前端只能看到一个网络错误）。
            try {
                const approxBytes = JSON.stringify(body).length;
                const approxLimit = 400 * 1024 * 1024;
                if (approxBytes > approxLimit) {
                    const sizeMsg = '素材体积过大（约 ' + Math.round(approxBytes / 1024 / 1024) +
                        'MB），请减少图片数量，或换用更小的录音 / 背景音乐文件';
                    if (resultDiv) resultDiv.innerHTML = '❌ ' + sizeMsg;
                    if (window.showToast) {
                        showToast({ title: '素材体积过大', message: sizeMsg }, 'error', 4500);
                    } else {
                        alert(sizeMsg);
                    }
                    return;
                }
            } catch (sizeCheckError) {
                // 体积预检失败不应阻塞正常提交
            }

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body)
                });
                const respJson = await response.json();
                if (!response.ok) throw new Error(respJson.msg || '请求异常');
                if (respJson.code === 200) {
                    const imageUpload = document.getElementById('imageUpload');
                    if (imageUpload) imageUpload.value = '';
                    const hasResultModal = window.hbResultModal && typeof window.hbResultModal.showResultModal === 'function';
                    if (hasResultModal) {
                        const posterDataUrl = await createPosterMobile(respJson.data.url, sender, name, themeColor, false);
                        if (!posterDataUrl) {
                            throw new Error('贺卡图片生成失败，请重试');
                        }
                        const oldPosterSection = document.getElementById('posterSection');
                        if (oldPosterSection) oldPosterSection.style.display = 'none';
                        const oldCopyBtn = document.querySelector('.copy-btn');
                        if (oldCopyBtn) oldCopyBtn.style.display = 'none';
                        if (resultDiv) resultDiv.innerHTML = '';
                        await window.hbResultModal.showResultModal(respJson.data.url, true, posterDataUrl, {
                            celebrantName: name,
                            senderName: sender,
                            birthday: birthdayValidation.value
                        });
                    } else {
                        // 无弹窗能力时，降级到旧展示逻辑
                        await createPosterMobile(respJson.data.url, sender, name, themeColor);
                        if (resultDiv) resultDiv.innerHTML = respJson.data.url;
                        const copyShow = document.querySelector('.copy-btn');
                        if (copyShow) copyShow.style.display = 'block';
                    }
                } else {
                    const errMsg = respJson.msg || '未知错误';
                    if (resultDiv) resultDiv.innerHTML = '❌ 生成失败：' + errMsg;
                    if (window.showToast) {
                        showToast({ title: '生成失败', message: errMsg }, 'error', 4000);
                    }
                }
            } catch (error) {
                const errorMsg = error.message || '';
                if (errorMsg.includes('Failed') || errorMsg.includes('Network') || errorMsg.includes('fetch') || !navigator.onLine) {
                    if (resultDiv) resultDiv.innerHTML = '❌ 网络出小差了，请重试！';
                    if (window.showToast) {
                        showToast({ title: '网络异常', message: '网络出小差了，请重试！' }, 'error', 3000);
                    }
                } else {
                    if (resultDiv) resultDiv.innerHTML = '⚠️ ' + (error.message || '服务器连接异常');
                    if (window.showToast) {
                        showToast({ title: '生成失败', message: error.message || '服务器连接异常' }, 'error', 4000);
                    }
                }
            }
        } finally {
            window.__hbGenerateInFlight = false;
            if (btn) {
                btn.disabled = false;
                btn.style.pointerEvents = '';
                btn.innerHTML = btn.dataset.hbGenerateOrigHtml || btn.innerHTML;
            }
        }
    }
})();