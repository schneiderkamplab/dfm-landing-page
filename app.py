from datetime import UTC, datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_mail import Mail, Message
import json
import os
import uuid

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['NEWS_FILE'] = os.getenv('NEWS_FILE', 'news.jsonl')
app.config['ADMIN_PASSWORD'] = os.getenv('ADMIN_PASSWORD', 'changeme')
app.config['CONTACT_FILE'] = os.getenv('CONTACT_FILE', 'contact.jsonl')
app.config['NEWSLETTER_FILE'] = os.getenv('NEWSLETTER_FILE', 'newsletter.jsonl')
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')  # Your email address
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')  # Your email password or app password
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', app.config['MAIL_USERNAME'])
app.config['MAIL_RECIPIENT'] = os.getenv('MAIL_RECIPIENT', app.config['MAIL_USERNAME'])
mail = Mail(app)

TOKENS = {}

def load_news():
    if not os.path.exists(app.config['NEWS_FILE']):
        return []
    with open(app.config['NEWS_FILE']) as f:
        return [json.loads(line) for line in f]

def save_news(item):
    with open(app.config['NEWS_FILE'], 'a') as f:
        f.write(json.dumps(item) + '\n')
        
@app.route('/api/news', methods=['GET'])
def get_news():
    return jsonify(load_news())

@app.route('/api/news', methods=['POST'])
def post_news():
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '')
    token_expiry = TOKENS.get(token, None)
    if not token_expiry or datetime.now(UTC) > token_expiry:
        TOKENS.pop(token, None)
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    item = {
        'id': str(uuid.uuid4()),
        'title': data.get('title', '').strip(),
        'date': data.get('date', '').strip(),
        'content': data.get('content', '').strip()
    }
    if not item['title'] or not item['date'] or not item['content']:
        return jsonify({'error': 'Missing fields'}), 400
    save_news(item)
    return jsonify(item), 201

@app.route('/api/news/<news_id>', methods=['DELETE'])
def delete_news(news_id):
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '')
    token_expiry = TOKENS.get(token, None)
    if not token_expiry or datetime.now(UTC) > token_expiry:
        TOKENS.pop(token, None)
        return jsonify({'error': 'Unauthorized'}), 401
    news_items = load_news()
    updated_news = [item for item in news_items if item.get('id') != news_id]
    if len(news_items) == len(updated_news):
        return jsonify({'error': 'News item not found'}), 404
    with open(app.config['NEWS_FILE'], 'w') as f:
        for item in updated_news:
            f.write(json.dumps(item) + '\n')
    return jsonify({'success': True})

@app.route('/api/news/<news_id>', methods=['PUT'])
def update_news(news_id):
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '')
    token_expiry = TOKENS.get(token, None)
    if not token_expiry or datetime.now(UTC) > token_expiry:
        TOKENS.pop(token, None)
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    title = data.get('title', '').strip()
    date = data.get('date', '').strip()
    content = data.get('content', '').strip()
    if not title or not date or not content:
        return jsonify({'error': 'Missing fields'}), 400
    news_items = load_news()
    updated = False
    for item in news_items:
        if item.get('id') == news_id:
            item['title'] = title
            item['date'] = date
            item['content'] = content
            updated = True
            break
    if not updated:
        return jsonify({'error': 'News item not found'}), 404
    with open(app.config['NEWS_FILE'], 'w') as f:
        for item in news_items:
            f.write(json.dumps(item) + '\n')
    return jsonify({'success': True})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password')
    if password == app.config['ADMIN_PASSWORD']:
        token = str(uuid.uuid4())
        TOKENS[token] = datetime.now(UTC) + timedelta(hours=1)
        return jsonify({'token': token})
    return jsonify({'error': 'Invalid password'}), 403

@app.route('/api/contact', methods=['POST'])
def contact():
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    subject = data.get('subject', '').strip()
    message = data.get('message', '').strip()
    if not name or not email or not subject or not message:
        return jsonify({'error': 'All fields are required.'}), 400
    timestamp = datetime.now(UTC).isoformat()
    entry = {
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "timestamp": timestamp
    }
    with open(app.config['CONTACT_FILE'], 'a') as f:
        f.write(json.dumps(entry) + '\n')
    try:
        msg = Message(subject=f"[DFM] Contact: {subject}",
                      sender=app.config['MAIL_DEFAULT_SENDER'],
                      recipients=[app.config['MAIL_RECIPIENT']])
        msg.body = f"""
New contact form submission:

Name: {name}
Email: {email}
Subject: {subject}
Message:
{message}

Timestamp: {timestamp}
"""
        mail.send(msg)
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500
    return jsonify({'success': True, 'message': 'Message received and email sent.'}), 200

@app.route('/api/newsletter', methods=['POST'])
def newsletter():
    data = request.json
    email = data.get('email', '').strip()
    consent = data.get('consent', False)
    timestamp = datetime.now(UTC).isoformat()
    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    if not consent:
        return jsonify({'error': 'You must provide GDPR consent to subscribe.'}), 400
    entry = {
        "email": email,
        "consent": True,
        "timestamp": timestamp
    }
    with open(app.config['NEWSLETTER_FILE'], 'a') as f:
        f.write(json.dumps(entry) + '\n')
    try:
        msg = Message(subject=f"[DFM] Newsletter: signup {email}",
                      sender=app.config['MAIL_DEFAULT_SENDER'],
                      recipients=[app.config['MAIL_RECIPIENT']])
        msg.body = f"""
New newsletter signup:
Email: {email}
Timestamp: {timestamp}
GDPR Consent: Yes
"""
        mail.send(msg)
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500
    return jsonify({'success': True, 'message': 'Subscription successful with GDPR consent.'}), 200

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(debug=True)
