// region 图片上传与预览（共享）
window.uploadedImages = [];

function compressImage(file, callback) {
    // 特殊处理GIF文件，直接返回原始数据而不压缩，以保留动画效果
    if (file.type === 'image/gif') {
        const reader = new FileReader();
        reader.onload = function(e) {
            callback(e.target.result);
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // 其他图片格式按原压缩逻辑处理
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxWidth = 1200;
            const maxHeight = 1200;
            let width = img.width;
            let height = img.height;
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            let quality = 1.0;
            if (file.size > 5 * 1024 * 1024) {
                quality = 0.7;
            } else if (file.size > 1024 * 1024) {
                quality = 0.8;
            }
            const isPNG = file.type === 'image/png';
            const dataURL = canvas.toDataURL(isPNG ? 'image/png' : 'image/jpeg', quality);
            callback(dataURL);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleImageUpload(event) {
    const files = event.target.files;
    window.__recommendedImageGroup = '';
    if (window.uploadedImages.length + files.length > 8) {
        alert('最多只能上传8张照片');
        event.target.value = '';
        return;
    }
    
    // 允许的图片文件类型
    const allowedImageTypes = [
        'image/jpeg',   // jpg, jpeg
        'image/jpg',    // jpg
        'image/png',    // png
        'image/gif',    // gif
        'image/webp'    // webp
    ];
    
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    Array.from(files).forEach(file => {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        // 验证图片文件格式
        if (!allowedImageTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            alert('请选择有效的图片文件（支持格式：jpg、jpeg、png、gif、webp）');
            event.target.value = '';
            return;
        }
        // 检查是否需要压缩图片
        const compressCheckbox = document.getElementById('compressImage');
        const isCompressChecked = compressCheckbox ? compressCheckbox.checked : true;
        const shouldCompress = isCompressChecked && file.size > 1 * 1024 * 1024;
        if (shouldCompress) {
            const placeholderId = `compressing_${Date.now()}`;
            window.uploadedImages.push({name: file.name, data: '', isCompressing: true, placeholderId: placeholderId});
            updateImagePreview();
            compressImage(file, compressedData => {
                const index = window.uploadedImages.findIndex(img => img.placeholderId === placeholderId);
                if (index !== -1) {
                    window.uploadedImages[index] = {name: file.name, data: compressedData};
                    updateImagePreview();
                }
            });
        } else {
            const reader = new FileReader();
            reader.onload = e => {
                window.uploadedImages.push({name: file.name, data: e.target.result});
                updateImagePreview();
            };
            reader.readAsDataURL(file);
        }
    });
    event.target.value = '';
}

function updateImagePreview() {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    preview.innerHTML = '';
    window.uploadedImages.forEach((img, index) => {
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.cursor = 'grab';
        container.style.width = '80px';
        container.style.height = '80px';
        container.style.backgroundColor = '#f5f5f5';
        container.style.borderRadius = '4px';
        container.style.margin = '5px';
        // 增强阻止选择和拖拽的样式
        container.style.userSelect = 'none';
        container.style.webkitUserSelect = 'none';
        container.style.msUserSelect = 'none';
        container.style.touchAction = 'none'; // 防止浏览器默认触摸行为
        container.style.webkitTouchCallout = 'none'; // 阻止iOS长按菜单
        // 添加拖拽属性
        container.draggable = true;
        container.dataset.index = index;

        renderImageLoadArea(container, img);

        // 添加顺序选择器（优化设计：减小尺寸，移除箭头，点击显示下拉选项）
        const orderContainer = document.createElement('div');
        orderContainer.style.position = 'absolute';
        orderContainer.style.bottom = '0';
        orderContainer.style.left = '0';
        orderContainer.style.zIndex = '5';
        orderContainer.style.cursor = 'pointer';
        orderContainer.style.width = '26px';
        orderContainer.style.height = '26px';
        orderContainer.style.display = 'flex';
        orderContainer.style.alignItems = 'center';
        orderContainer.style.justifyContent = 'center';
        orderContainer.style.borderRadius = '0 0 0 4px';
        orderContainer.style.background = 'rgba(99, 102, 241, 0.9)'; // 使用主题色
        orderContainer.style.color = 'white';
        orderContainer.style.fontSize = '12px';
        orderContainer.style.fontWeight = 'bold';
        orderContainer.style.border = '1px solid white';
        orderContainer.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
        
        // 显示当前顺序号
        const orderNumber = document.createElement('span');
        orderNumber.textContent = (index + 1).toString();
        orderNumber.style.userSelect = 'none';
        orderContainer.appendChild(orderNumber);
        
        // 创建隐藏的下拉选项容器
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.position = 'absolute';
        dropdownContainer.style.bottom = '100%';
        dropdownContainer.style.left = '0';
        dropdownContainer.style.background = 'rgba(99, 102, 241, 0.95)';
        dropdownContainer.style.borderRadius = '4px 4px 0 4px';
        dropdownContainer.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.3)';
        dropdownContainer.style.border = '1px solid white';
        dropdownContainer.style.padding = '4px';
        dropdownContainer.style.display = 'none';
        dropdownContainer.style.zIndex = '15';
        
        // 添加1到当前上传图片总数的选项
        const totalImages = window.uploadedImages.length;
        for (let i = 1; i <= totalImages; i++) {
            const option = document.createElement('div');
            option.style.padding = '8px 12px';
            option.style.borderRadius = '3px';
            option.style.color = 'white';
            option.style.textAlign = 'center';
            option.style.cursor = 'pointer';
            option.style.margin = '2px 0';
            option.style.userSelect = 'none';
            option.style.fontSize = '14px';
            
            // 当前选中项高亮
            if (i === index + 1) {
                option.style.background = 'rgba(255, 255, 255, 0.2)';
                option.style.fontWeight = 'bold';
            }
            
            option.textContent = i;
            
            // 选项点击事件（同时支持PC和移动端）
            const handleOptionSelect = (e) => {
                e.stopPropagation();
                const newOrder = parseInt(option.textContent);
                if (newOrder === index + 1) {
                    // 如果点击的是当前顺序，不做处理
                    dropdownContainer.style.display = 'none';
                    return;
                }
                
                // 从当前位置移除图片
                const [movedImage] = window.uploadedImages.splice(index, 1);
                
                // 插入到新位置
                window.uploadedImages.splice(newOrder - 1, 0, movedImage);
                
                // 更新预览
                updateImagePreview();
            };
            
            // 为PC添加点击事件
            option.addEventListener('click', handleOptionSelect);
            
            // 为移动端添加触摸事件
            option.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleOptionSelect(e);
            });
            
            // 确保移动端可以点击
            option.style.touchAction = 'auto';
            option.style.pointerEvents = 'auto';
            
            dropdownContainer.appendChild(option);
        }
        
        orderContainer.appendChild(dropdownContainer);
        
        // 点击显示/隐藏下拉选项（同时支持PC和移动端）
        const toggleDropdown = (e) => {
            e.stopPropagation();
            dropdownContainer.style.display = dropdownContainer.style.display === 'none' ? 'block' : 'none';
        };
        
        // 为PC添加点击事件
        orderContainer.addEventListener('click', toggleDropdown);
        
        // 为移动端添加触摸事件
        orderContainer.addEventListener('touchend', (e) => {
            e.preventDefault();
            toggleDropdown(e);
        });
        
        // 确保移动端可以触发点击
        orderContainer.style.touchAction = 'auto';
        orderContainer.style.pointerEvents = 'auto';
        
        // 点击页面其他地方隐藏下拉选项（同时支持PC和移动端）
        const hideDropdown = () => {
            dropdownContainer.style.display = 'none';
        };
        
        // 为PC添加点击事件
        document.addEventListener('click', hideDropdown);
        
        // 为移动端添加触摸事件
        document.addEventListener('touchend', hideDropdown);
        
        // 阻止事件冒泡，避免立即关闭（同时支持PC和移动端）
        const stopPropagation = (e) => {
            e.stopPropagation();
        };
        
        // 为PC添加点击事件冒泡阻止
        dropdownContainer.addEventListener('click', stopPropagation);
        
        // 为移动端添加触摸事件冒泡阻止
        dropdownContainer.addEventListener('touchend', stopPropagation);
        
        container.appendChild(orderContainer);
        
        // 创建删除按钮并保持与新角标视觉协调
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '<i class="fa fa-times"></i>'; // 使用Font Awesome图标代替×符号
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '-8px'; // 调整位置，保持与新角标协调
        deleteBtn.style.right = '-8px';
        deleteBtn.style.background = 'red';
        deleteBtn.style.color = 'white';
        deleteBtn.style.width = '26px'; // 调整尺寸，与新角标保持一致
        deleteBtn.style.height = '26px';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '14px'; // 调整图标尺寸
        deleteBtn.style.lineHeight = '1';
        deleteBtn.style.zIndex = '10'; // 仅比图片容器高
        deleteBtn.style.pointerEvents = 'auto';
        deleteBtn.style.touchAction = 'auto';
        deleteBtn.style.border = '1px solid white'; // 调整边框，与新角标保持一致
        deleteBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.25)'; // 保持适当阴影效果
        deleteBtn.style.userSelect = 'none';
        deleteBtn.style.webkitUserSelect = 'none';
        
        // 为删除按钮添加标识，便于选择器识别
        deleteBtn.classList.add('image-delete-btn');
        
        // PC端点击事件
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.uploadedImages.splice(index, 1);
            updateImagePreview();
        });
        
        // 移动端触摸事件 - 使用touchend避免与长按拖拽冲突
        deleteBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // 立即删除图片
            window.uploadedImages.splice(index, 1);
            updateImagePreview();
        }, { passive: false });
        
        // 添加触摸反馈
        deleteBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            deleteBtn.style.background = 'darkred'; // 按下时颜色变化
        });
        
        deleteBtn.addEventListener('touchcancel', () => {
            deleteBtn.style.background = 'red'; // 取消触摸时恢复颜色
        });
        
        container.appendChild(deleteBtn);
        
        // 添加拖拽事件监听器
        container.addEventListener('dragstart', (e) => {
            container.style.opacity = '0.5';
            e.dataTransfer.setData('text/plain', index);
        });
        
        container.addEventListener('dragend', () => {
            container.style.opacity = '1';
        });
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.style.backgroundColor = '#e0e7ff';
        });
        
        container.addEventListener('dragleave', () => {
            container.style.backgroundColor = '#f5f5f5';
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.style.backgroundColor = '#f5f5f5';
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = parseInt(container.dataset.index);
            
            if (draggedIndex !== targetIndex) {
                // 交换图片位置
                const temp = window.uploadedImages[draggedIndex];
                window.uploadedImages[draggedIndex] = window.uploadedImages[targetIndex];
                window.uploadedImages[targetIndex] = temp;
                // 更新预览
                updateImagePreview();
            }
        });
        
        // 移动端触摸事件支持
        let touchStartX, touchStartY;
        let touchStartTime;
        
        // 阻止上下文菜单（右键和长按菜单）
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // 保存拖拽状态
        let isDragging = false;
        let draggedIndex = -1;
        let longPressTimer = null;
        let originalZIndex, originalOpacity, originalTransform;
        
        // 触摸开始事件 - 完整实现长按拖拽功能
        container.addEventListener('touchstart', (e) => {
            // 阻止默认行为，特别是长按菜单
            e.preventDefault();
            e.stopPropagation();
            
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            
            // 保存当前样式用于拖拽结束时恢复
            originalZIndex = container.style.zIndex;
            originalOpacity = container.style.opacity;
            originalTransform = container.style.transform;
            
            // 设置长按定时器
            longPressTimer = setTimeout(() => {
                // 开始拖拽模式
                isDragging = true;
                draggedIndex = index;
                
                // 应用拖拽样式
                container.style.zIndex = '1000';
                container.style.opacity = '0.8';
                container.style.transform = 'scale(1.05)';
                container.style.transition = 'all 0.2s ease';
                

            }, 300);
        });
        
        // 触摸移动事件 - 实现拖拽排序
        container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 如果已经在拖拽状态
            if (isDragging && draggedIndex !== -1) {
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                
                // 查找触摸位置下的其他图片容器
                const targetContainer = findContainerAtPosition(touchX, touchY);
                if (targetContainer && targetContainer !== container) {
                    const targetIndex = parseInt(targetContainer.dataset.index);
                    
                    // 检查目标是否有效
                    if (targetIndex >= 0 && targetIndex < window.uploadedImages.length && targetIndex !== draggedIndex) {
                        // 交换图片位置
                        const temp = window.uploadedImages[draggedIndex];
                        window.uploadedImages[draggedIndex] = window.uploadedImages[targetIndex];
                        window.uploadedImages[targetIndex] = temp;
                        
                        // 更新拖拽索引
                        draggedIndex = targetIndex;
                        
                        // 重新渲染预览
                        updateImagePreview();
                    }
                }
            } else {
                // 如果还没有进入拖拽状态，检查是否移动超过阈值
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const diffX = Math.abs(touchX - touchStartX);
                const diffY = Math.abs(touchY - touchStartY);
                
                // 如果移动超过10px，取消长按定时器
                if (diffX > 10 || diffY > 10) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }
            }
        });
        
        // 触摸结束事件 - 结束拖拽
        container.addEventListener('touchend', () => {
            // 清除长按定时器
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            // 如果是拖拽状态，恢复样式和状态
            if (isDragging) {
                container.style.zIndex = originalZIndex || '';
                container.style.opacity = originalOpacity || '1';
                container.style.transform = originalTransform || '';
                
                // 重置拖拽状态
                isDragging = false;
                draggedIndex = -1;
                
                // 隐藏提示
                hideDragHint();
            }
        });
        
        // 触摸取消事件 - 处理意外中断
        container.addEventListener('touchcancel', () => {
            // 清除长按定时器
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            // 恢复样式
            if (isDragging) {
                container.style.zIndex = originalZIndex || '';
                container.style.opacity = originalOpacity || '1';
                container.style.transform = originalTransform || '';
                
                // 重置拖拽状态
                isDragging = false;
                draggedIndex = -1;
                
                hideDragHint();
            }
        });
        
        preview.appendChild(container);
    });
}

/**
 * 渲染单个预览格的图片显示区（加载中/失败/真图）。挂到 img-load-area 供增量更新识别。
 */
function renderImageLoadArea(container, img) {
    const area = document.createElement('div');
    area.className = 'img-load-area';
    area.style.position = 'absolute';
    area.style.top = '0';
    area.style.left = '0';
    area.style.right = '0';
    area.style.bottom = '0';
    area.style.borderRadius = '4px';
    area.style.overflow = 'hidden';
    if (img.isLoading || img.isCompressing) {
        area.style.display = 'flex';
        area.style.alignItems = 'center';
        area.style.justifyContent = 'center';
        const text = document.createElement('div');
        text.innerText = img.isLoading ? '加载中...' : '压缩中...';
        text.style.fontSize = '12px';
        text.style.color = '#666';
        area.appendChild(text);
    } else if (img.loadError) {
        area.style.display = 'flex';
        area.style.alignItems = 'center';
        area.style.justifyContent = 'center';
        const text = document.createElement('div');
        text.innerText = '加载失败';
        text.style.fontSize = '12px';
        text.style.color = '#e74c3c';
        area.appendChild(text);
    } else {
        const imgElement = document.createElement('img');
        imgElement.src = img.data;
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        imgElement.style.objectFit = 'cover';
        imgElement.style.borderRadius = '4px';
        // 增强图片的阻止选择样式
        imgElement.style.userSelect = 'none';
        imgElement.style.webkitUserSelect = 'none';
        imgElement.style.msUserSelect = 'none';
        imgElement.style.webkitTouchCallout = 'none';
        imgElement.style.pointerEvents = 'none'; // 让图片不响应事件，所有事件都由容器处理
        area.appendChild(imgElement);
    }
    container.appendChild(area);
}

/**
 * 仅更新指定索引的图片预览格（加载完成/失败时增量刷新，避免整区重建）。
 * 只替换容器内的内容节点，保留既有 order/删除角标与事件绑定。
 */
function updateImagePreviewAtIndex(index) {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    const container = preview.children[index];
    if (!container) return;
    const img = window.uploadedImages[index];
    if (!img) return;
    // 重建内容节点：先清空除顺序角标/删除按钮外的填充内容
    Array.from(container.childNodes).forEach(function (node) {
        // 顺序角标/下拉/删除按钮不带 img-load-area 标记，保留
        if (!node.classList || !node.classList.contains('img-load-area')) {
            return;
        }
        container.removeChild(node);
    });
    renderImageLoadArea(container, img);
}

// 查找指定坐标位置下的图片容器
function findContainerAtPosition(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (const element of elements) {
        if (element.dataset && element.dataset.index !== undefined) {
            return element;
        }
    }
    return null;
}

window.HB_RECOMMENDED_IMAGE_GROUPS = window.HB_RECOMMENDED_IMAGE_GROUPS || null;
window.HB_RECOMMENDED_IMAGE_ORDER = window.HB_RECOMMENDED_IMAGE_ORDER || null;

async function ensureRecommendedImageConfigLoaded() {
    if (window.HB_RECOMMENDED_IMAGE_GROUPS && window.HB_RECOMMENDED_IMAGE_ORDER) return;
    const response = await fetch('/api/default-assets/config', { method: 'GET' });
    const payload = await response.json();
    if (!response.ok || payload.code !== 200 || !payload.data) throw new Error('暂无推荐图片');
    const groups = (payload.data.imageGroups || []).filter(g => g && g.enabled !== false && Array.isArray(g.images) && g.images.length > 0);
    const map = {};
    const order = [];
    groups.forEach(g => {
        const id = (g.id || '').trim();
        if (!id) return;
        map[id] = g.images;
        order.push(id);
    });
    if (!order.length) {
        throw new Error('暂无推荐图片');
    }
    window.HB_RECOMMENDED_IMAGE_GROUPS = map;
    window.HB_RECOMMENDED_IMAGE_ORDER = order;
}

async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            resolve(e.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function loadRemoteDefaultImages(gender) {
    await ensureRecommendedImageConfigLoaded();
    const config = window.HB_RECOMMENDED_IMAGE_GROUPS ? window.HB_RECOMMENDED_IMAGE_GROUPS[gender] : null;
    if (!config || config.length === 0) {
        throw new Error('暂无推荐图片');
    }

    const urls = config.slice(0, 8);
    const loaded = [];
    const failed = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const blob = await response.blob();
            const dataUrl = await blobToDataUrl(blob);
            loaded.push({ name: `default-${gender}-${i + 1}.jpg`, data: dataUrl });
        } catch (error) {
            failed.push(url);
        }
    }

    if (loaded.length === 0) {
        throw new Error('暂无推荐图片');
    }

    window.__recommendedImageGroup = gender;
    window.uploadedImages = loaded.slice(0, 8);
    updateImagePreview();

    if (typeof showToast === 'function' && failed.length > 0) {
        showToast({ title: '加载失败', message: `${failed.length}张推荐图加载失败` }, 'warning', 2800);
    }
}

function bindDefaultImageButtons() {
    const useBtn = document.getElementById('useRecommendedImagesBtn');
    const switchBtn = document.getElementById('switchRecommendedImagesBtn');
    if (!useBtn || !switchBtn) {
        return;
    }
    let currentGroup = '';

    async function handleClick(gender, btn) {
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '加载中...';
        try {
            await loadRemoteDefaultImages(gender);
            currentGroup = gender;
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast({ title: '加载失败', message: error.message || '默认图片加载失败' }, 'error', 2800);
            } else {
                alert(error.message || '默认图片加载失败');
            }
        } finally {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    }

    useBtn.addEventListener('click', async function () {
        try {
            await ensureRecommendedImageConfigLoaded();
            if (!currentGroup) {
                const order = window.HB_RECOMMENDED_IMAGE_ORDER || [];
                currentGroup = order[0] || '';
            }
            if (!currentGroup) throw new Error('暂无推荐图片');
            handleClick(currentGroup, useBtn);
        } catch (error) {
            const message = (error && error.message) || '默认图片加载失败';
            if (typeof showToast === 'function') {
                showToast({ title: '加载失败', message: message }, 'error', 2800);
            } else {
                alert(message);
            }
        }
    });
    switchBtn.addEventListener('click', async function () {
        try {
            await ensureRecommendedImageConfigLoaded();
            const order = window.HB_RECOMMENDED_IMAGE_ORDER || [];
            if (!order.length) {
                throw new Error('暂无推荐图片');
            } else {
                if (!currentGroup) currentGroup = order[0];
                const currentIdx = order.indexOf(currentGroup);
                currentGroup = order[(currentIdx + 1 + order.length) % order.length];
            }
            handleClick(currentGroup, switchBtn);
        } catch (error) {
            const message = (error && error.message) || '默认图片加载失败';
            if (typeof showToast === 'function') {
                showToast({ title: '加载失败', message: message }, 'error', 2800);
            } else {
                alert(message);
            }
        }
    });
}



document.addEventListener('DOMContentLoaded', function () {
    var imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }
    bindDefaultImageButtons();
    
    // 为整个页面添加全局事件阻止，防止长按菜单
    document.addEventListener('contextmenu', (e) => {
        // 如果点击的是图片容器或其子元素
        if (e.target.closest('[data-index]')) {
            e.preventDefault();
            return false;
        }
    });
    
    // 全局触摸事件处理 - 避免阻止删除按钮的事件
    document.addEventListener('touchstart', (e) => {
        // 只有当目标不是删除按钮时才阻止默认行为
        if (e.target.closest('[data-index]') && !e.target.classList.contains('image-delete-btn') && !e.target.closest('.image-delete-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        // 只有当目标不是删除按钮时才阻止默认行为
        if (e.target.closest('[data-index]') && !e.target.classList.contains('image-delete-btn') && !e.target.closest('.image-delete-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
        // 只有当目标不是删除按钮时才阻止默认行为
        if (e.target.closest('[data-index]') && !e.target.classList.contains('image-delete-btn') && !e.target.closest('.image-delete-btn')) {
            e.preventDefault();
        }
    });
    
    // 确保删除按钮在移动端能够正常接收触摸事件
    document.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('image-delete-btn') || e.target.closest('.image-delete-btn')) {
            // 不阻止删除按钮的默认行为
        }
    }, { passive: true });
    
    // 全局阻止图片的默认拖拽行为
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
    });
    
    // 全局阻止选择文本
    document.addEventListener('selectstart', (e) => {
        if (e.target.closest('[data-index]')) {
            e.preventDefault();
        }
    });
    
    // 为body添加样式来阻止长按菜单，但明确允许删除按钮的交互
    const style = document.createElement('style');
    style.textContent = `
        [data-index] {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -khtml-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            touch-action: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }
        [data-index] img {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -khtml-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }
        /* 明确允许删除按钮的所有交互 */
        .image-delete-btn {
            pointer-events: auto !important;
            touch-action: auto !important;
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            z-index: 10 !important;
        }
    `;
    document.head.appendChild(style);
});
// endregion


