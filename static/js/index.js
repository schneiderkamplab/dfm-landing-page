document.addEventListener('DOMContentLoaded', () => {
    let authToken = '';
    const API_URL = '/api/news';

    // Elements
    const $ = id => document.getElementById(id);
    const newsContainer = $('news-container');
    const addNewsBtn = $('add-news-btn');
    const newsForm = $('news-form');
    const newsItemForm = $('news-item-form');
    const cancelNews = $('cancel-news');
    const notification = $('notification');

    /** ------------------- Utility Functions ------------------- */

    const showNotification = (msg, type = 'info', duration = 3000) => {
        const base = "fixed top-6 right-6 px-4 py-2 rounded-lg shadow-lg z-50";
        const styles = {
            info: "bg-dfmTeal text-white",
            error: "bg-red-600 text-white",
            success: "bg-green-600 text-white"
        };
        notification.className = `${base} ${styles[type] || styles.info}`;
        notification.textContent = msg;
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), duration);
    };

    const formatDate = dateStr => new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const sanitizeHTML = input => {
        const allowed = ['br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p'];
        const template = document.createElement('template');
        template.innerHTML = input;
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, {
            acceptNode: node => allowed.includes(node.nodeName.toLowerCase())
                ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        let node;
        while (node = walker.nextNode()) {
            [...node.attributes].forEach(attr => {
                if (node.nodeName.toLowerCase() === 'a' && attr.name === 'href') return;
                node.removeAttribute(attr.name);
            });
        }
        return template.innerHTML;
    };

    const truncateHTML = (html, maxChars = 140) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        let count = 0;
        const output = document.createElement('div');

        const traverse = (node, parent) => {
            if (count >= maxChars) return;
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.slice(0, maxChars - count);
                count += text.length;
                parent.appendChild(document.createTextNode(text));
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const clone = document.createElement(node.tagName);
                [...node.attributes].forEach(attr => {
                    if (node.tagName === 'A' && attr.name === 'href') {
                        clone.setAttribute(attr.name, attr.value);
                    }
                });
                parent.appendChild(clone);
                [...node.childNodes].forEach(child => traverse(child, clone));
            }
        };

        [...template.content.childNodes].forEach(child => traverse(child, output));
        const span = document.createElement('span');
        span.textContent = '...';
        (output.lastElementChild || output).appendChild(span);
        return output.innerHTML;
    };

    /** ------------------- News Logic ------------------- */

    const fetchNews = async () => {
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            renderNews(data.reverse());
        } catch (err) {
            console.error(err);
            showNotification('Failed to fetch news.', 'error');
        }
    };

    const renderNews = newsList => {
        newsContainer.innerHTML = '';
        newsList.forEach(news => newsContainer.appendChild(createNewsItem(news)));
    };

    const createNewsItem = news => {
        const div = document.createElement('div');
        div.className = 'news-item bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg relative';
        const sanitized = sanitizeHTML(news.content);
        const isLong = news.content.replace(/<[^>]*>/g, '').length > 140;
        const preview = isLong ? truncateHTML(sanitized, 140) : sanitized;

        div.innerHTML = `
            ${authToken ? createButton('delete', news.id) + createButton('edit', news) : ''}
            <div class="p-6">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-dfmBlue">${news.title}</h3>
                    <span class="text-sm text-gray-500">${formatDate(news.date)}</span>
                </div>
                <div class="relative">
                    <div class="content-wrapper" data-full="${encodeURIComponent(sanitized)}"
                         data-truncated="${encodeURIComponent(preview)}" data-expanded="false">
                        <div class="text-gray-700 content-text">${preview}</div>
                    </div>
                    ${isLong ? `<button class="toggle-content-btn mt-2 text-dfmTeal hover:text-dfmBlue font-medium">Read more</button>` : ''}
                </div>
            </div>`;
        return div;
    };

    const createButton = (type, data) => {
        if (type === 'delete') {
            return `<button class="delete-news absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 flex items-center justify-center text-lg font-bold" data-id="${data}" title="Delete News">&times;</button>`;
        } else if (type === 'edit') {
            return `<button class="edit-news absolute top-10 right-2 w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-600 hover:text-yellow-800 flex items-center justify-center text-lg font-bold" data-id="${data.id}" data-title="${encodeURIComponent(data.title)}" data-date="${data.date}" data-content="${encodeURIComponent(data.content)}" title="Edit News">✎</button>`;
        }
    };

    /** ------------------- Event Handlers ------------------- */

    // Delegated Click Events
    document.addEventListener('click', async e => {
        const target = e.target;

        if (target.matches('.delete-news')) {
            handleDeletePrompt(target.dataset.id);
        } else if (target.matches('#confirm-delete')) {
            await handleDeleteConfirm();
        } else if (target.matches('#cancel-delete')) {
            $('delete-confirmation-modal').classList.add('hidden');
        } else if (target.matches('.edit-news')) {
            handleEditNews(target);
        } else if (target.matches('.toggle-content-btn')) {
            toggleContent(target);
        }
    });

    const handleDeletePrompt = id => {
        $('delete-confirmation-modal').classList.remove('hidden');
        $('confirm-delete').dataset.id = id;
    };

    const handleDeleteConfirm = async () => {
        const id = $('confirm-delete').dataset.id;
        if (!id) return;
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const result = await res.json();
            if (res.ok) {
                showNotification('News deleted', 'success');
                fetchNews();
            } else {
                showNotification(`Error: ${result.error}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('Error deleting news', 'error');
        } finally {
            $('delete-confirmation-modal').classList.add('hidden');
        }
    };

    const handleEditNews = btn => {
        $('news-title').value = decodeURIComponent(btn.dataset.title);
        $('news-date').value = btn.dataset.date;
        $('news-content').value = decodeURIComponent(btn.dataset.content);
        addNewsBtn.dataset.editing = btn.dataset.id;
        $('news-submit-btn').textContent = 'Update News';
        addNewsBtn.classList.add('hidden');
        newsForm.classList.remove('hidden');
    };

    const toggleContent = btn => {
        const wrapper = btn.closest('.relative').querySelector('.content-wrapper');
        const text = wrapper.querySelector('.content-text');
        const expanded = wrapper.dataset.expanded === 'true';
        text.innerHTML = decodeURIComponent(expanded ? wrapper.dataset.truncated : wrapper.dataset.full);
        wrapper.dataset.expanded = (!expanded).toString();
        btn.textContent = expanded ? 'Read more' : 'Read less';
    };

    // News Form
    addNewsBtn.addEventListener('click', () => {
        if (!authToken) return login();
        newsForm.classList.toggle('hidden');
        $('news-submit-btn').textContent = 'Add News';
        addNewsBtn.classList.add('hidden');
        addNewsBtn.dataset.editing && delete addNewsBtn.dataset.editing;
        newsItemForm.reset();
        $('news-date').value = new Date().toISOString().split('T')[0];
    });

    cancelNews.addEventListener('click', () => {
        newsForm.classList.add('hidden');
        addNewsBtn.classList.remove('hidden');
        showNotification('News form cancelled.');
    });

    newsItemForm.addEventListener('submit', async e => {
        e.preventDefault();
        const title = $('news-title').value.trim();
        const date = $('news-date').value;
        const content = $('news-content').value.trim();
        const id = addNewsBtn.dataset.editing;
        if (!title || !date || !content) return showNotification('All fields required', 'error');

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ title, date, content })
            });
            const data = await res.json();
            if (res.ok) {
                fetchNews();
                newsForm.classList.add('hidden');
                addNewsBtn.classList.remove('hidden');
                newsItemForm.reset();
                showNotification(id ? 'News updated!' : 'News posted!', 'success');
            } else {
                showNotification('Error: ' + data.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('Network error', 'error');
        }
    });

    /** ------------------- Authentication ------------------- */

    const login = () => $('admin-login-box').classList.remove('hidden');

    const handleLogin = async () => {
        const password = $('admin-password').value.trim();
        if (!password) return;
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (res.ok) {
                authToken = data.token;
                $('admin-login-box').classList.add('hidden');
                $('admin-login-label').textContent = '[Logout]';
                addNewsBtn.classList.remove('hidden');
                showNotification('Login successful', 'success');
                fetchNews();
            } else {
                $('admin-login-error').textContent = data.error;
                $('admin-login-error').classList.remove('hidden');
            }
        } catch {
            $('admin-login-error').textContent = 'Login failed';
            $('admin-login-error').classList.remove('hidden');
        }
    };

    $('admin-login-link').addEventListener('click', e => {
        e.preventDefault();
        const label = $('admin-login-label');
        if (label.textContent === '[Logout]') {
            authToken = '';
            label.textContent = '[Admin]';
            addNewsBtn.classList.add('hidden');
            showNotification('Logged out', 'success');
            fetchNews();
        } else {
            login();
        }
    });

    $('admin-login-submit').addEventListener('click', handleLogin);
    $('admin-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin();
        }
    });

    /** ------------------- Initial Load ------------------- */
    fetchNews();
});
