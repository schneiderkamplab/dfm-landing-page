document.addEventListener('DOMContentLoaded', function () {
    let authToken = '';

    const API_URL = '/api/news';

    const newsContainer = document.getElementById('news-container');
    const addNewsBtn = document.getElementById('add-news-btn');
    const newsForm = document.getElementById('news-form');
    const newsItemForm = document.getElementById('news-item-form');
    const cancelNews = document.getElementById('cancel-news');

    function showNotification(message, type = 'info', duration = 3000) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        const base = "fixed top-6 right-6 px-4 py-2 rounded-lg shadow-lg z-50";
        const typeClasses = {
            info: "bg-dfmTeal text-white",
            error: "bg-red-600 text-white",
            success: "bg-green-600 text-white",
        };
        notification.className = `${base} ${typeClasses[type] || typeClasses.info}`;
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, duration);
    }

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    async function fetchNews() {
        try {
            const res = await fetch(API_URL);
            const newsData = await res.json();
            displayNews(newsData.reverse());
        } catch (e) {
            console.error('Error fetching news:', e);
        }
    }

    let deleteNewsId = null;

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-news')) {
            deleteNewsId = e.target.getAttribute('data-id');
            document.getElementById('delete-confirmation-modal').classList.remove('hidden');
        }
    });

    document.getElementById('cancel-delete').addEventListener('click', () => {
        deleteNewsId = null;
        document.getElementById('delete-confirmation-modal').classList.add('hidden');
    });

    document.getElementById('confirm-delete').addEventListener('click', async () => {
        if (!deleteNewsId) return;
        try {
            const res = await fetch(`${API_URL}/${deleteNewsId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + authToken
                }
            });
            if (res.ok) {
                fetchNews();
                showNotification('News item deleted successfully', 'success');
            } else {
                const err = await res.json();
                showNotification('Error deleting news item: ' + err.error, 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            showNotification('Error deleting news item', 'error');
        } finally {
            deleteNewsId = null;
            document.getElementById('delete-confirmation-modal').classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-news')) {
            const id = e.target.getAttribute('data-id');
            const title = decodeURIComponent(e.target.getAttribute('data-title'));
            const date = e.target.getAttribute('data-date');
            const content = decodeURIComponent(e.target.getAttribute('data-content'));
            document.getElementById('news-title').value = title;
            document.getElementById('news-date').value = date;
            document.getElementById('news-content').value = content;
            newsForm.classList.remove('hidden');
            addNewsBtn.dataset.editing = id;
            document.getElementById('news-submit-btn').textContent = 'Update News';
            addNewsBtn.classList.add('hidden');
        }
    });

    function sanitizeHTML(input) {
        const template = document.createElement('template');
        template.innerHTML = input;
        const allowedTags = ['br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p'];
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => allowedTags.includes(node.nodeName.toLowerCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        let node;
        while (node = walker.nextNode()) {
            [...node.attributes].forEach(attr => {
                if (node.nodeName.toLowerCase() === 'a' && attr.name === 'href') return;
                node.removeAttribute(attr.name);
            });
        }
        return template.innerHTML;
    }

    function truncateHTML(html, maxChars = 140) {
        const template = document.createElement('template');
        template.innerHTML = html;
        let count = 0;
        const output = document.createElement('div');
        function traverse(node, parent) {
            if (count >= maxChars) return;
            if (node.nodeType === Node.TEXT_NODE) {
                const remaining = maxChars - count;
                const text = node.textContent.slice(0, remaining);
                count += text.length;
                parent.appendChild(document.createTextNode(text));
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const clone = document.createElement(node.tagName);
                for (const attr of node.attributes) {
                    if (node.tagName === 'A' && attr.name === 'href') {
                        clone.setAttribute(attr.name, attr.value);
                    }
                }
                parent.appendChild(clone);
                for (const child of node.childNodes) {
                    traverse(child, clone);
                    if (count >= maxChars) break;
                }
            }
        }
        for (const child of template.content.childNodes) {
            traverse(child, output);
            if (count >= maxChars) break;
        }
        const span = document.createElement('span');
        span.textContent = '...';
        output.lastElementChild?.appendChild(span) || output.appendChild(span);
        return output.innerHTML;
    }

    function displayNews(newsData) {
        newsContainer.innerHTML = '';
        newsData.forEach((news) => {
            const newsItem = document.createElement('div');
            newsItem.className = 'news-item bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg relative';
            const deleteBtnHTML = authToken && news.id
                ? `<button
                    class="delete-news absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 flex items-center justify-center text-lg font-bold"
                    data-id="${news.id}"
                    title="Delete News">&times;</button>`
                : '';
            const editBtnHTML = authToken && news.id
                ? `<button class="edit-news absolute top-10 right-2 w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-600 hover:text-yellow-800 flex items-center justify-center text-lg font-bold"
                    data-id="${news.id}" 
                    data-title="${encodeURIComponent(news.title)}"
                    data-date="${news.date}"
                    data-content="${encodeURIComponent(news.content)}"
                    title="Edit News">✎</button>`
                : '';
            const rawContent = news.content;
            const fullSanitized = sanitizeHTML(rawContent);
            const plainTextLength = rawContent.replace(/<[^>]*>/g, '').length;
            const isLong = plainTextLength > 140;
            const truncatedSanitized = isLong
                ? truncateHTML(fullSanitized, 140)
                : fullSanitized;
            newsItem.innerHTML = `
                    ${deleteBtnHTML}
                    ${editBtnHTML}
                    <div class="p-6">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="text-xl font-bold text-dfmBlue">${news.title}</h3>
                            <span class="text-sm text-gray-500">${formatDate(news.date)}</span>
                        </div>
                        <div class="relative">
                            <div class="content-wrapper"
                                data-full="${encodeURIComponent(fullSanitized)}"
                                data-truncated="${encodeURIComponent(truncatedSanitized)}"
                                data-expanded="false">
                                <div class="text-gray-700 content-text">${truncatedSanitized}</div>
                            </div>
                            ${isLong ? `<button class="mt-2 text-dfmTeal hover:text-dfmBlue font-medium toggle-content-btn">Read more</button>` : ''}
                        </div>
                    </div>
                `;
            newsContainer.appendChild(newsItem);
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('toggle-content-btn')) return;
        const btn = e.target;
        const wrapper = btn.closest('.relative').querySelector('.content-wrapper');
        const contentBox = wrapper.querySelector('.content-text');
        const card = btn.closest('.news-item');
        const isExpanded = wrapper.dataset.expanded === 'true';
        const fullHTML = decodeURIComponent(wrapper.dataset.full);
        const truncatedHTML = decodeURIComponent(wrapper.dataset.truncated);
        contentBox.innerHTML = isExpanded ? truncatedHTML : fullHTML;
        btn.textContent = isExpanded ? 'Read more' : 'Read less';
        wrapper.dataset.expanded = (!isExpanded).toString();
        if (isExpanded) {
            const cardTop = card.getBoundingClientRect().top;
            const navOffset = 100;
            if (cardTop < navOffset) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    addNewsBtn.addEventListener('click', () => {
        if (!authToken) {
            login();
        } else {
            newsForm.classList.toggle('hidden');
            document.getElementById('news-submit-btn').textContent = 'Add News';
            addNewsBtn.classList.add('hidden');
            document.getElementById('news-title').value = '';
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('news-date').value = today;
            document.getElementById('news-content').value = '';
            delete addNewsBtn.dataset.editing;
        }
    });

    cancelNews.addEventListener('click', () => {
        newsForm.classList.add('hidden');
        addNewsBtn.classList.remove('hidden');
        showNotification('News form cancelled.', 'info');
    });

    newsItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('news-title').value;
        const date = document.getElementById('news-date').value;
        const content = document.getElementById('news-content').value;
        const editingId = addNewsBtn.dataset.editing;
        if (!title || !date || !content) {
            showNotification('All fields are required.', 'error');
            return;
        }
        const method = editingId ? 'PUT' : 'POST';
        const url = editingId ? `${API_URL}/${editingId}` : API_URL;
        try {
            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify({ title, date, content })
            });
            if (res.ok) {
                fetchNews();
                newsItemForm.reset();
                newsForm.classList.add('hidden');
                addNewsBtn.classList.remove('hidden');
                showNotification(editingId ? 'News updated successfully!' : 'News posted successfully!', 'success');
            } else {
                const err = await res.json();
                showNotification('Error posting news: ' + err.error, 'error');
            }
        } catch (e) {
            console.error('Error posting news:', e);
            showNotification('Network error. Please try again later.', 'error');
        }
    });
    fetchNews();

    document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const subject = document.getElementById('subject').value;
        const message = document.getElementById('message').value.trim();
        if (!name || !email || !subject || !message) {
            showNotification('All fields are required.', 'error');
            return;
        }
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, subject, message })
            });
            const result = await res.json();
            if (res.ok) {
                showNotification('Message sent successfully!', 'success');
                e.target.reset();
            } else {
                showNotification('Error sending message: ' + result.error, 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('Network error. Please try again later.', 'error');
        }
    });

    document.getElementById('newsletter-submit').addEventListener('click', async () => {
        const emailInput = document.getElementById('newsletter-email');
        const consentCheckbox = document.getElementById('newsletter-consent');
        const email = emailInput.value.trim();
        const consent = consentCheckbox.checked;
        if (!email) {
            showNotification('Email is required.', 'error');
            return;
        }
        if (!consent) {
            showNotification('You must agree to the privacy policy.', 'error');
            return;
        }
        try {
            const res = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, consent })
            });
            const result = await res.json();
            if (res.ok) {
                showNotification('Subscription successful!', 'success');
                emailInput.value = '';
                consentCheckbox.checked = false;
            } else {
                showNotification('Error subscribing: ' + result.error, 'error');
            }
        } catch (e) {
            console.error(e);
            showNotification('Network error. Please try again later.', 'error');
        }
    });

    const loginBox = document.getElementById('admin-login-box');
    const loginLink = document.getElementById('admin-login-link');
    const loginBtn = document.getElementById('admin-login-submit');
    const loginInput = document.getElementById('admin-password');
    const loginError = document.getElementById('admin-login-error');
    const loginLabel = document.getElementById('admin-login-label');
    loginLink.addEventListener('click', (e) => {
        e.preventDefault();

        if (loginLabel.textContent === '[Logout]') {
            // Perform logout
            authToken = '';
            loginLabel.textContent = '[Admin]';
            showNotification('Logged out successfully.', 'success');
            fetchNews();
            addNewsBtn.classList.add('hidden');
            return;
        }

        // Show login form if not logged in
        loginBox.classList.toggle('hidden');
        loginError.classList.add('hidden');
        loginInput.value = '';
        loginInput.focus();
    });
    async function handleLogin() {
        const password = loginInput.value.trim();
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
                addNewsBtn.classList.remove('hidden');
                loginBox.classList.add('hidden');
                loginError.classList.add('hidden');
                loginLabel.textContent = '[Logout]';
                fetchNews();
                showNotification('Logged in successfully.', 'success');
            } else {
                loginError.textContent = data.error || 'Invalid password.';
                loginError.classList.remove('hidden');
                loginInput.focus();
            }
        } catch (err) {
            loginError.textContent = 'Network error.';
            loginError.classList.remove('hidden');
            loginInput.focus();
        }
    }
    loginBtn.addEventListener('click', handleLogin);
    loginInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin();
        }
    });
    document.addEventListener('click', (e) => {
        if (
            !loginBox.contains(e.target) &&
            e.target !== loginLink &&
            !loginLink.contains(e.target)
        ) {
            loginBox.classList.add('hidden');
        }
    });

});
