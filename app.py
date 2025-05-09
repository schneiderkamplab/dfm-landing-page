from datetime import UTC, datetime
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

TOKENS = set()

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
    if token not in TOKENS:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    item = {
        'title': data.get('title', '').strip(),
        'date': data.get('date', '').strip(),
        'content': data.get('content', '').strip()
    }

    if not item['title'] or not item['date'] or not item['content']:
        return jsonify({'error': 'Missing fields'}), 400

    save_news(item)
    return jsonify(item), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password')
    if password == app.config['ADMIN_PASSWORD']:
        token = str(uuid.uuid4())
        TOKENS.add(token)
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

    # Store in contact.jsonl
    with open(app.config['CONTACT_FILE'], 'a') as f:
        f.write(json.dumps(entry) + '\n')

    # Send email
    try:
        msg = Message(subject=f"Contact Form: {subject}",
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

    # Store subscription
    entry = {
        "email": email,
        "consent": True,
        "timestamp": timestamp
    }
    with open(app.config['NEWSLETTER_FILE'], 'a') as f:
        f.write(json.dumps(entry) + '\n')

    # Send email to admin
    try:
        msg = Message(subject="New Newsletter Signup (GDPR)",
                      sender=app.config['MAIL_DEFAULT_SENDER'],
                      recipients=[app.config['MAIL_RECIPIENT']])
        msg.body = f"New GDPR-compliant newsletter signup:\n\nEmail: {email}\nTime: {timestamp}\nConsent: Yes"
        mail.send(msg)
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500

    return jsonify({'success': True, 'message': 'Subscription successful with GDPR consent.'}), 200

@app.route('/privacy-policy')
def privacy_policy():
    return send_from_directory(app.static_folder, 'privacy.html')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    # Serve static files from the static folder
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(debug=True)
