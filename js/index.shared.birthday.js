// 生日输入共享逻辑：统一保存为 MMDD，支持日期选择框
(function () {
    const DIGIT_ONLY_REG = /\D+/g;

    function buildBirthdayExampleText(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `如果生日是${Number(month)}月${Number(day)}日，则填写${month}${day}`;
    }

    function normalizeBirthdayInput(raw) {
        const value = (raw || '').trim();
        if (!value) return '';
        // 日期选择器 yyyy-mm-dd -> mmdd
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [, month, day] = value.split('-');
            return `${month}${day}`;
        }
        // 兼容旧展示 yyyy/mm/dd -> mmdd
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
            const [, month, day] = value.split('/');
            return `${month}${day}`;
        }
        // 滚轮仅选月日：MM/DD
        if (/^\d{2}\/\d{2}$/.test(value)) {
            const [month, day] = value.split('/');
            return `${month}${day}`;
        }
        return value.replace(DIGIT_ONLY_REG, '').slice(0, 4);
    }

    function autoPadBirthday(digits) {
        if (!digits || digits.length === 0) return '';
        if (digits.length >= 4) return digits.slice(0, 4);
        if (digits.length === 3) return '0' + digits;
        if (digits.length === 2) return '0' + digits[0] + '0' + digits[1];
        if (digits.length === 1) return '0' + digits + '0' + digits;
        return digits;
    }

    function tryMatchBirthday(input, stored) {
        var digits = String(input || '').replace(/\D/g, '');
        if (!digits || digits.length === 0) return false;
        if (digits === stored) return true;
        if (digits.length === 4) return digits === stored;
        // 3 位：尝试两种解释 — 0+XY 和 X+0Y
        if (digits.length === 3) {
            if ('0' + digits === stored) return true;
            if (digits[0] + '0' + digits[1] + digits[2] === stored) return true;
            if (digits.slice(0, 2) + '0' + digits[2] === stored) return true;
        }
        // 2 位：尝试 0X0Y
        if (digits.length === 2) {
            if ('0' + digits[0] + '0' + digits[1] === stored) return true;
        }
        // 1 位：尝试 0X0X
        if (digits.length === 1) {
            if ('0' + digits + '0' + digits === stored) return true;
        }
        return autoPadBirthday(digits) === stored;
    }

    function mmddToDateValue(mmdd) {
        const normalized = normalizeBirthdayInput(mmdd);
        if (!/^\d{4}$/.test(normalized)) return '';
        const year = new Date().getFullYear();
        return `${year}/${normalized.slice(0, 2)}/${normalized.slice(2, 4)}`;
    }

    function validateBirthday(value, required) {
        var raw = normalizeBirthdayInput(value);
        var normalized = autoPadBirthday(raw);
        if (!required && raw.length === 0) {
            return { valid: true, value: normalized, message: '' };
        }
        if (normalized.length !== 4) {
            return {
                valid: false,
                value: normalized,
                message: '生日格式有误，请输入月日数字。例如：2月15日则填写0215或215'
            };
        }
        return { valid: true, value: normalized, message: '' };
    }

    function bindBirthdayPlainText(inputEl) {
        if (!inputEl) return;

        inputEl.classList.add('hb-birthday-plain');
        inputEl.style.paddingLeft = '2.4rem';
        inputEl.placeholder = '月 日 (如 0215)';
        inputEl.setAttribute('inputmode', 'numeric');
        inputEl.setAttribute('maxlength', '4');
        inputEl.setAttribute('autocomplete', 'off');

        const sanitize = () => {
            const normalized = normalizeBirthdayInput(inputEl.value);
            if (inputEl.value !== normalized) {
                inputEl.value = normalized;
            }
        };

        if (inputEl._hbBirthdayPlainBound) {
            sanitize();
            return;
        }
        inputEl._hbBirthdayPlainBound = true;

        inputEl.addEventListener('input', sanitize);
        inputEl.addEventListener('paste', function () {
            setTimeout(sanitize, 0);
        });
        inputEl.addEventListener('blur', sanitize);
        sanitize();
    }

    function fallbackWheelToPlainText(inputEl) {
        if (!inputEl) return;
        if (window.hbWheelPicker && typeof window.hbWheelPicker.teardownBirthdayWheel === 'function') {
            window.hbWheelPicker.teardownBirthdayWheel(inputEl);
        }
        inputEl.removeAttribute('readonly');
        if (inputEl.dataset) {
            inputEl.dataset.hbPicker = 'plain';
        }
        bindBirthdayPlainText(inputEl);
    }

    function bindBirthdayInput(inputEl) {
        if (!inputEl) return;

        const useWheel = inputEl.dataset && inputEl.dataset.hbPicker === 'wheel';
        if (useWheel && window.hbWheelPicker && typeof window.hbWheelPicker.initBirthday === 'function') {
            inputEl.setAttribute('readonly', 'readonly');
            inputEl.placeholder = '点选月 / 日';
            const inst = window.hbWheelPicker.initBirthday(inputEl, {});
            if (inst) {
                return;
            }
            if (window.hbWheelPicker && typeof window.hbWheelPicker.teardownBirthdayWheel === 'function') {
                window.hbWheelPicker.teardownBirthdayWheel(inputEl);
            }
            inputEl.removeAttribute('readonly');
            if (inputEl.dataset) {
                inputEl.dataset.hbPicker = 'plain';
            }
            bindBirthdayPlainText(inputEl);
            return;
        }

        const isDateInput = inputEl.type === 'date';
        if (isDateInput) {
            if (!inputEl.value) {
                const today = new Date();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                inputEl.value = `${today.getFullYear()}-${month}-${day}`;
            }
            const openPicker = () => {
                if (typeof inputEl.showPicker === 'function') {
                    try {
                        inputEl.showPicker();
                    } catch (e) {
                        // ignore browsers that block programmatic picker in some events
                    }
                }
            };
            inputEl.addEventListener('click', openPicker);
            inputEl.addEventListener('focus', openPicker);
            return;
        }

        bindBirthdayPlainText(inputEl);
    }

    function switchInputMode(inputEl, mode) {
        if (!inputEl) return;
        if (mode === 'plain') {
            inputEl.dataset.hbPicker = 'plain';
            fallbackWheelToPlainText(inputEl);
        } else if (mode === 'wheel') {
            inputEl.dataset.hbPicker = 'wheel';
            var savedVal = inputEl.value;
            if (window.hbWheelPicker && typeof window.hbWheelPicker.teardownBirthdayWheel === 'function') {
                window.hbWheelPicker.teardownBirthdayWheel(inputEl);
            }
            inputEl.removeAttribute('readonly');
            inputEl.removeAttribute('placeholder');
            inputEl.setAttribute('readonly', 'readonly');
            inputEl.placeholder = '点选月 / 日';
            if (window.hbWheelPicker && typeof window.hbWheelPicker.initBirthday === 'function') {
                if (savedVal) {
                    inputEl.value = savedVal;
                }
                var inst = window.hbWheelPicker.initBirthday(inputEl, {});
                if (!inst) {
                    inputEl.dataset.hbPicker = 'plain';
                    inputEl.removeAttribute('readonly');
                    bindBirthdayPlainText(inputEl);
                    if (savedVal) inputEl.value = savedVal;
                }
            } else {
                inputEl.dataset.hbPicker = 'plain';
                inputEl.removeAttribute('readonly');
                bindBirthdayPlainText(inputEl);
                if (savedVal) inputEl.value = savedVal;
            }
        }
    }

    function bindBirthdayToggle(inputEl) {
        if (!inputEl) return;
        var toggleBtn = document.querySelector('[data-hb-toggle="birthday"]');
        if (!toggleBtn) return;
        if (toggleBtn._hbBirthdayToggleBound) return;
        toggleBtn._hbBirthdayToggleBound = true;

        toggleBtn.addEventListener('click', function () {
            var current = inputEl.dataset.hbPicker || 'wheel';
            var next = current === 'wheel' ? 'plain' : 'wheel';
            switchInputMode(inputEl, next);
            // 以实际切换后状态更新按钮文字（wheel init 可能失败降级）
            var actual = inputEl.dataset.hbPicker || 'plain';
            toggleBtn.innerHTML = actual === 'wheel'
                ? '<i class="fa fa-pencil-square-o" aria-hidden="true"></i> 手动'
                : '<i class="fa fa-calendar" aria-hidden="true"></i> 滚轮';
            if (window.hbBirthday && typeof window.hbBirthday.validateBirthday === 'function') {
                window.hbBirthday.validateBirthday(inputEl.value, false);
            }
        });
    }

    window.hbBirthday = {
        buildBirthdayExampleText,
        normalizeBirthdayInput,
        autoPadBirthday: autoPadBirthday,
        tryMatchBirthday: tryMatchBirthday,
        mmddToDateValue,
        validateBirthday,
        bindBirthdayInput,
        bindBirthdayPlainText,
        fallbackWheelToPlainText,
        switchInputMode: switchInputMode,
        bindBirthdayToggle: bindBirthdayToggle
    };

    document.addEventListener('DOMContentLoaded', function () {
        var birthdayInput = document.getElementById('birthday');
        bindBirthdayInput(birthdayInput);
        if (birthdayInput) {
            bindBirthdayToggle(birthdayInput);
        }
    });
})();
