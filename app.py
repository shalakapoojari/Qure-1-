from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
import uuid, qrcode, os, smtplib
from datetime import datetime
from email.mime.text import MIMEText
from dotenv import load_dotenv
import logging
from werkzeug.middleware.proxy_fix import ProxyFix

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))
app.config["MONGO_URI"] = os.getenv("MONGO_URI")

# Apply ProxyFix for proper IP handling behind proxies
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Initialize MongoDB
mongo = PyMongo(app)

# Email configuration
EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

def send_email(to_email, subject, body):
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = EMAIL_SENDER
    msg['To'] = to_email
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.send_message(msg)
            logger.info(f"Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Email failed: {e}")

def generate_qr(queue_id):
    # Use the full URL from environment or default to localhost
    base_url = os.getenv("BASE_URL", "https://qure-1-1.onrender.com")
    url = f"{base_url}/join/{queue_id}"
    img = qrcode.make(url)

    # Ensure directory exists
    qr_folder = 'static/qrcodes'
    os.makedirs(qr_folder, exist_ok=True)

    path = f"{qr_folder}/{queue_id}.png"
    img.save(path)

    return path

# Home Page
@app.route('/')
def home():
    return render_template('admin_dashboard.html')

# Show Join Form
@app.route('/join/<queue_id>', methods=['GET'])
def show_join_form(queue_id):
    queue = mongo.db.queues.find_one({"queue_id": queue_id})
    if not queue or queue['status'] == 'inactive':
        flash("Queue does not exist or has been closed.")
        return render_template('error.html', message="Queue does not exist or has been closed.")
    
    return render_template('join_queue.html', queue_id=queue_id)

# Generate Queue
@app.route('/generate_queue')
def generate_queue():
    queue_id = str(uuid.uuid4())[:8]
    queue = {
        "queue_id": queue_id,
        "status": "active",
        "start_time": datetime.utcnow(),
        "served_count": 0,
        "total_service_time": 0
    }
    mongo.db.queues.insert_one(queue)

    qr_path = generate_qr(queue_id)
    
    flash(f"Queue generated successfully. Queue ID: {queue_id}")
    return render_template(
        'admin_dashboard.html',
        qr_path=f"/static/qrcodes/{queue_id}.png",
        queue_id=queue_id
    )

# Join Queue via QR
@app.route('/join/<queue_id>', methods=['POST'])
def join_queue(queue_id):
    queue = mongo.db.queues.find_one({"queue_id": queue_id})
    if not queue or queue['status'] == 'inactive':
        flash("Queue does not exist or has been closed.")
        return render_template('error.html', message="Queue does not exist or has been closed.")

    email = request.form.get('email')
    if not email:
        flash("Email is required to join the queue.")
        return redirect(url_for('show_join_form', queue_id=queue_id))

    existing_user = mongo.db.queue_users.find_one({
        "queue_id": queue_id,
        "user_email": email,
        "status": "waiting"
    })

    if existing_user:
        waiting_users = list(mongo.db.queue_users.find(
            {"queue_id": queue_id, "status": "waiting"}
        ).sort("join_time", 1))
        
        position = next((i for i, user in enumerate(waiting_users) 
                        if str(user['_id']) == str(existing_user['_id'])), 0)
    else:
        join_time = datetime.utcnow()
        mongo.db.queue_users.insert_one({
            "queue_id": queue_id,
            "user_email": email,
            "status": "waiting",
            "join_time": join_time
        })
        waiting_users = list(mongo.db.queue_users.find(
            {"queue_id": queue_id, "status": "waiting"}
        ).sort("join_time", 1))
        position = len(waiting_users) - 1

    served_count = queue.get("served_count", 0)
    total_service_time = queue.get("total_service_time", 0)
    avg_service_time = (total_service_time / served_count) if served_count > 0 else 120
    est_wait_time = avg_service_time * position

    return render_template(
        'user_joined.html',
        position=position + 1,
        est_time=round(est_wait_time / 60, 2),
        queue_id=queue_id,
        user_email=email
    )

# Admit Next User
@app.route('/admit_next/<queue_id>')
def admit_next(queue_id):
    queue = mongo.db.queues.find_one({"queue_id": queue_id})
    if not queue:
        flash("Queue not found.")
        return redirect(url_for('home'))

    user = mongo.db.queue_users.find_one(
        {"queue_id": queue_id, "status": "waiting"}, 
        sort=[("join_time", 1)]
    )
    
    if not user:
        flash("No more users in the queue.")
    else:
        end_time = datetime.utcnow()
        service_time = (end_time - user['join_time']).total_seconds()

        # Update user status to 'served'
        mongo.db.queue_users.update_one(
            {"_id": user['_id']},
            {"$set": {"status": "served", "served_time": end_time}}
        )

        # Update queue stats
        mongo.db.queues.update_one(
            {"queue_id": queue_id},
            {"$inc": {
                "served_count": 1,
                "total_service_time": service_time
            }}
        )

        # Notify the user
        send_email(
            user['user_email'], 
            "Your Turn Has Arrived - Qure", 
            f"Hello,\n\nIt's your turn now! Please proceed to the service desk.\n\nThank you for using Qure."
        )
        flash(f"User {user['user_email']} admitted and notified.")

    # Fetch updated queue and users
    queue = mongo.db.queues.find_one({"queue_id": queue_id})
    waiting_users = list(mongo.db.queue_users.find(
        {"queue_id": queue_id, "status": "waiting"}
    ).sort("join_time", 1))
    
    # Calculate estimated wait times for each user
    served_count = queue.get("served_count", 0)
    total_service_time = queue.get("total_service_time", 0)
    avg_service_time = (total_service_time / served_count) if served_count > 0 else 120
    
    for i, user in enumerate(waiting_users):
        user['est_wait'] = avg_service_time * i

    return render_template(
        'admin_dashboard.html', 
        queue_id=queue_id, 
        qr_path=f"/static/qrcodes/{queue_id}.png", 
        queue_status=queue['status'], 
        users=waiting_users
    )

# Close Queue
@app.route('/close_queue/<queue_id>')
def close_queue(queue_id):
    mongo.db.queues.update_one(
        {"queue_id": queue_id}, 
        {"$set": {"status": "inactive"}}
    )
    flash("Queue closed successfully")
    return redirect(url_for('home'))

# Check Status API
@app.route('/check_status/<queue_id>/<email>')
def check_status(queue_id, email):
    user = mongo.db.queue_users.find_one({
        "queue_id": queue_id,
        "user_email": email
    })

    if user:
        # Get position if still waiting
        position = 0
        if user.get("status") == "waiting":
            waiting_users = list(mongo.db.queue_users.find(
                {"queue_id": queue_id, "status": "waiting"}
            ).sort("join_time", 1))
            
            position = next((i for i, u in enumerate(waiting_users) 
                          if str(u['_id']) == str(user['_id'])), 0) + 1
        
        return jsonify({
            "status": user.get("status", "waiting"),
            "position": position
        })
    else:
        return jsonify({"status": "not_found"})

# Error handler for 404
@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', message="Page not found"), 404

# Error handler for 500
@app.errorhandler(500)
def server_error(e):
    return render_template('error.html', message="Server error. Please try again later."), 500

if __name__ == '__main__':
    # In production, you would use a WSGI server like Gunicorn
    # For development:
    app.run(debug=False, host='0.0.0.0')
