// 首页「精选博客」加载器。
//
// index.html 末尾一直引用着 ./js/index-home-blog.js，但本地化时这个文件被删掉了，
// 于是页面每次都多一个 404，并且 #home-featured-blog-loading 里的
// 「正在加载精选博客…」转圈会永远停在那里。
//
// 这里按本地数据实现同样的职责：数据来自 /api/blogs/latest（server.js 读取
// 可选的 data/blog.json）。本地没有博客内容时，把加载占位换成一句诚实的中文提示，
// 既不是空转圈，也不是把错误抛到控制台。
(function () {
    'use strict';

    var GRID_ID = 'home-featured-blog-grid';
    var LIMIT = 3;

    function noticeBox(id, iconClass, text) {
        var box = document.createElement('div');
        box.id = id;
        box.className = 'md:col-span-3 text-center py-12 text-paragraph';
        var icon = document.createElement('i');
        icon.className = iconClass + ' text-primary text-2xl mb-3 block';
        var span = document.createElement('span');
        span.textContent = text;
        box.appendChild(icon);
        box.appendChild(span);
        return box;
    }

    // 只允许站内相对路径和 http(s) 链接，避免本地内容文件里写进 javascript: 之类的东西
    function safeHref(url) {
        if (typeof url !== 'string') return '';
        var value = url.trim();
        if (!value) return '';
        if (/^https?:\/\//i.test(value) || value.charAt(0) === '/') return value;
        return '';
    }

    function pickText(value, fallback) {
        if (value === undefined || value === null) return fallback || '';
        var text = String(value).trim();
        return text || (fallback || '');
    }

    function buildCard(post) {
        var card = document.createElement('article');
        card.className = 'bg-cardBg rounded-xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col';

        var title = document.createElement('h3');
        title.className = 'text-xl font-bold text-headline mb-3';
        title.textContent = pickText(post.title, '未命名');
        card.appendChild(title);

        var summary = pickText(post.summary || post.description || post.content, '');
        if (summary) {
            var p = document.createElement('p');
            p.className = 'text-paragraph leading-relaxed flex-1';
            p.textContent = summary;
            card.appendChild(p);
        } else {
            var spacer = document.createElement('div');
            spacer.className = 'flex-1';
            card.appendChild(spacer);
        }

        var stamp = pickText(post.publishDate || post.updateDate || post.createdAt, '');
        if (stamp) {
            var time = document.createElement('span');
            time.className = 'text-sm text-paragraph mt-4 opacity-70';
            time.textContent = stamp;
            card.appendChild(time);
        }

        var href = safeHref(post.url);
        if (href) {
            var link = document.createElement('a');
            link.href = href;
            link.className = 'text-links hover:text-links/80 font-medium mt-4 inline-flex items-center';
            link.textContent = '阅读全文';
            var arrow = document.createElement('i');
            arrow.className = 'fa fa-angle-right ml-2';
            link.appendChild(arrow);
            card.appendChild(link);
        }

        return card;
    }

    // 用结果整体替换网格内容（原来只有 #home-featured-blog-loading 一个占位节点），
    // 这样「加载中」不会残留，重复调用也不会叠加。
    function render(grid, nodes) {
        while (grid.children.length) grid.removeChild(grid.firstChild);
        nodes.forEach(function (node) { grid.appendChild(node); });
    }

    function renderNotice(grid, id, text) {
        render(grid, [noticeBox(id, 'fa fa-info-circle', text)]);
    }

    function load() {
        var grid = document.getElementById(GRID_ID);
        if (!grid) return;
        fetch('/api/blogs/latest?limit=' + LIMIT, { headers: { 'Accept': 'application/json' } })
            .then(function (response) {
                return response.ok ? response.json() : null;
            })
            .then(function (payload) {
                var posts = payload && Array.isArray(payload.data) ? payload.data : [];
                if (posts.length) {
                    render(grid, posts.map(buildCard));
                } else {
                    renderNotice(grid, 'home-featured-blog-empty', '暂无博客内容，敬请期待');
                }
            })
            .catch(function () {
                // 接口异常时同样降级成一句人话；接口本身已在服务端记日志。
                renderNotice(grid, 'home-featured-blog-error', '博客内容暂时无法加载，请稍后再试');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();
