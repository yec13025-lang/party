// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 移动端菜单切换
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    // 主题颜色选择器交互 - 带对勾显示
    document.querySelectorAll('.theme-color-option input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function () {
            // 重置所有选择器样式
            document.querySelectorAll('.theme-color-dot i').forEach(icon => {
                icon.style.opacity = '0';
            });
            document.querySelectorAll('.theme-color-dot').forEach(dot => {
                dot.classList.remove('border-primary');
            });

            // 设置当前选中项样式
            const dot = this.nextElementSibling;
            const icon = dot.querySelector('i');
            dot.classList.add('border-primary');
            icon.style.opacity = '1';
        });
    });

    // 初始化已选中的主题颜色
    const checkedRadio = document.querySelector('.theme-color-option input[type="radio"]:checked');
    if (checkedRadio) {
        const dot = checkedRadio.nextElementSibling;
        const icon = dot.querySelector('i');
        dot.classList.add('border-primary');
        icon.style.opacity = '1';
    }

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
            const icon = menuToggle.querySelector('i');
            if (mobileMenu.classList.contains('hidden')) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            } else {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            }
        });
    }

    // 滚动效果
    const header = document.getElementById('header');
    const backToTop = document.getElementById('back-to-top');

    window.addEventListener('scroll', function () {
        // 头部样式变化
        if (header && window.scrollY > 100) {
            header.classList.add('py-2', 'shadow-md');
            header.classList.remove('py-4', 'shadow-sm');
        } else if (header) {
            header.classList.add('py-4', 'shadow-sm');
            header.classList.remove('py-2', 'shadow-md');
        }

        // 返回顶部按钮显示/隐藏
        if (backToTop) {
            if (window.scrollY > 500) {
                backToTop.classList.remove('opacity-0', 'invisible');
                backToTop.classList.add('opacity-100', 'visible');
            } else {
                backToTop.classList.add('opacity-0', 'invisible');
                backToTop.classList.remove('opacity-100', 'visible');
            }
        }
    });

    // 返回顶部功能
    if (backToTop) {
        backToTop.addEventListener('click', function () {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 平滑滚动到锚点
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }

            // 关闭移动端菜单
            if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });
});