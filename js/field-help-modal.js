/**
 * 表单字段说明：点击/悬停 .field-help-btn[data-field-help] 在图标附近显示浮层提示。
 */
(function () {
    var CAN_HOVER = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    function getBirthdayHelpText() {
        return '请选择寿星生日的月日\n系统会自动按月日保存并用于生成贺卡';
    }
    var FIELD_HELP = {
        name: '填写寿星的姓名，或者昵称',
        birthday: getBirthdayHelpText(),
        sender: '填写你的姓名，或者昵称',
        blessing: '最多可以写2000字',
        photos:
            '贺卡默认展示8张图，上传的图片小于8张时，剩余的图片会展示默认图片。',
        voice:
            '上传设备里的音频文件，或带声音的视频文件\n' +
            '单个文件不超过 60MB',
        music:
            '设置背景音乐的3种方式\n' +
            '（1）使用推荐音乐\n' +
            '（2）上传音频文件，如MP3文件\n' +
            '（3）上传视频文件，文件需小于60MB',
        email:
            '（1）可以不填写\n' +
            '（2）如果填写，会在生日阳历凌晨零点，发送祝福邮件给寿星',
        advanced: '可以不填写'
    };

    var popoverEl = null;
    var activeBtn = null;

    function ensurePopover() {
        if (popoverEl) return;
        popoverEl = document.createElement('div');
        popoverEl.id = 'fieldHelpPopover';
        popoverEl.className =
            'fixed z-[110] w-[min(88vw,360px)] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] leading-6 text-gray-700 shadow-xl whitespace-pre-wrap opacity-0 pointer-events-none transition-opacity duration-150';
        document.body.appendChild(popoverEl);
        popoverEl.addEventListener('mouseleave', closePopover);
    }

    function positionPopover(btn) {
        var rect = btn.getBoundingClientRect();
        var margin = 8;
        var left = rect.left;
        var top = rect.bottom + margin;
        var maxLeft = window.innerWidth - popoverEl.offsetWidth - margin;
        if (left > maxLeft) left = Math.max(margin, maxLeft);

        // If bottom space is not enough, place above.
        if (top + popoverEl.offsetHeight > window.innerHeight - margin) {
            top = rect.top - popoverEl.offsetHeight - margin;
        }
        if (top < margin) top = margin;

        popoverEl.style.left = left + 'px';
        popoverEl.style.top = top + 'px';
    }

    function openPopover(btn, key) {
        var text = FIELD_HELP[key];
        if (!text) return;
        ensurePopover();
        activeBtn = btn;
        popoverEl.textContent = text;
        popoverEl.classList.remove('opacity-0', 'pointer-events-none');
        popoverEl.classList.add('opacity-100', 'pointer-events-auto');
        positionPopover(btn);
    }

    function closePopover() {
        if (!popoverEl) return;
        popoverEl.classList.add('opacity-0', 'pointer-events-none');
        popoverEl.classList.remove('opacity-100', 'pointer-events-auto');
        activeBtn = null;
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.field-help-btn');
        if (btn) {
            var key = btn.getAttribute('data-field-help');
            if (!key) return;
            e.preventDefault();
            e.stopPropagation();
            ensurePopover();
            var isOpen =
                popoverEl &&
                popoverEl.classList.contains('opacity-100') &&
                popoverEl.classList.contains('pointer-events-auto');
            // 同一感叹号第二次点击关闭（触控与桌面点击均生效）
            if (activeBtn === btn && isOpen) {
                closePopover();
            } else {
                openPopover(btn, key);
            }
            return;
        }

        if (popoverEl && !e.target.closest('#fieldHelpPopover')) {
            closePopover();
        }
    });

    if (CAN_HOVER) {
        document.addEventListener('mouseover', function (e) {
            var btn = e.target.closest('.field-help-btn');
            if (!btn) return;
            var key = btn.getAttribute('data-field-help');
            if (!key) return;
            openPopover(btn, key);
        });

        document.addEventListener('mouseout', function (e) {
            var btn = e.target.closest('.field-help-btn');
            if (!btn || activeBtn !== btn) return;
            var next = e.relatedTarget;
            if (next && (next.closest('.field-help-btn') || next.closest('#fieldHelpPopover'))) return;
            closePopover();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePopover();
    });

    window.addEventListener('resize', function () {
        if (activeBtn && popoverEl && popoverEl.classList.contains('opacity-100')) {
            positionPopover(activeBtn);
        }
    });
})();
