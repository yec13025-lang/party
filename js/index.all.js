// 音频文件验证功能
function validateAudioFile(input, displayId) {
    const file = input.files[0];
    if (!file) return;

    // 允许的音频文件类型
    const allowedTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/mp4',
        'audio/ogg',
        'audio/webm',
        'audio/aac',
        'audio/flac',
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo',
        'video/x-matroska',
        'video/mpeg',
        'video/3gpp'
    ];

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac', 'mp4', 'mov', 'mkv', 'avi', 'mpeg', '3gp'];
    
    // 检查文件大小（60MB）
    const maxSize = 60 * 1024 * 1024; // 60MB in bytes
    if (file.size > maxSize) {
        // 显示错误提示
        alert('音频文件大小不能超过60MB');
        // 清空文件输入
        input.value = '';
        // 清空显示的文件名和删除按钮
        clearAudioDisplay(input, displayId);
        return false;
    }

    // 检查文件类型或扩展名
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)
        && !(file.type && file.type.startsWith('audio/'))) {
        alert('请上传有效的音频或带声音的视频');
        // 清空文件输入
        input.value = '';
        // 清空显示的文件名和删除按钮
        clearAudioDisplay(input, displayId);
        return false;
    }

    // 显示文件名和删除按钮
    displayAudioWithDelete(input, displayId, file);

    return true;
}

// 显示音频文件和删除按钮
function displayAudioWithDelete(input, displayId, file) {
    const displayElement = document.getElementById(displayId);
    if (displayElement) {
        // 移除文件名长度限制，允许完整显示文件名
        const fileName = file.name;
        
        // 创建包含文件名和删除按钮的HTML
        displayElement.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${fileName}</span>
                <button type="button" class="delete-audio-btn text-red-500 hover:text-red-700 ml-2" 
                        onclick="deleteAudioFile('${input.id}', '${displayId}')">
                    <i class="fa fa-times"></i> 删除
                </button>
            </div>
        `;
    }
}

// 清空音频显示
function clearAudioDisplay(input, displayId) {
    const displayElement = document.getElementById(displayId);
    if (displayElement) {
        displayElement.textContent = '';
    }
}

// 删除音频文件函数
function deleteAudioFile(inputId, displayId) {
    const inputElement = document.getElementById(inputId);
    if (inputElement) {
        // 重置文件输入
        inputElement.value = '';
        // 清空显示
        clearAudioDisplay(inputElement, displayId);
        // 显示提示
        if (typeof showToast === 'function') {
            showToast('音乐文件已删除', 'success');
        }
    }
}

// 页面加载完成后初始化音乐删除功能
document.addEventListener('DOMContentLoaded', function() {
    // 为已有的音频显示区域添加删除功能支持
    const audioInputs = document.querySelectorAll('input[type="file"][accept*="audio"]');
    audioInputs.forEach(input => {
        // 检查是否已经有文件，为其添加删除按钮
        if (input.files && input.files[0]) {
            const displayId = input.id.replace('Music', 'MusicName');
            displayAudioWithDelete(input, displayId, input.files[0]);
        }
    });
});