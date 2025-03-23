
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
import uuid, qrcode, os, smtplib
from datetime import datetime
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

# Email Sender
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
    except Exception as e:
        print("Email failed:", e)

# Generate QR Code
import os

def generate_qr(queue_id):
    url = f"https://qure-1.onrender.com/join/{queue_id}"
    img = qrcode.make(url)

    qr_folder = os.path.join('static', 'qrcodes')
    os.makedirs(qr_folder, exist_ok=True)  # Create the folder if it doesn't exist

    filename = f"{queue_id}.png"
    filepath = os.path.join(qr_folder, filename)
    img.save(filepath)

    return url_for('static', filename=f'qrcodes/{filename}')


# Home Page
@app.route('/')
def home():
    return render_template('admin_dashboard.html')

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

    qr_path = generate_qr(queue_id)  # returns proper URL path now
    flash(f"Queue generated successfully. Queue ID: {queue_id}")
    return render_template('admin_dashboard.html', qr_path=qr_path, queue_id=queue_id)

# Join Queue via QR
@app.route('/join/<queue_id>', methods=['GET', 'POST'])
def join_queue(queue_id):
    queue = mongo.db.queues.find_one({"queue_id": queue_id})
    if not queue or queue['status'] != 'active':
        return render_template('queue_closed.html', queue_id=queue_id)

    if request.method == 'POST':
        email = request.form['email'].strip().lower()
        
        user_data = {
            "queue_id": queue_id,
            "user_email": email,
            "join_time": datetime.utcnow(),
            "status": "waiting"
        }

        position = mongo.db.queue_users.count_documents({"queue_id": queue_id, "status": "waiting"})
        
        avg_time = (queue['total_service_time'] / queue['served_count']) if queue['served_count'] > 0 else 120
        est_wait_time = avg_time * position

        user_data['est_wait'] = est_wait_time
        mongo.db.queue_users.insert_one(user_data)

        return render_template(
            'user_joined.html',
            position=position + 1,
            est_time=round(est_wait_time / 60, 2),
            queue_id=queue_id,
            email=email
        )

    return render_template('join_queue.html', queue_id=queue_id)


# Admit Next User
@app.route('/admit_next/<queue_id>')
def admit_next(queue_id):
    user = mongo.db.queue_users.find_one({"queue_id": queue_id, "status": "waiting"})
    if not user:
        flash("No more users in the queue")
        return redirect(url_for('home'))
    end_time = datetime.utcnow()
    service_time = (end_time - user['join_time']).total_seconds()
    mongo.db.queue_users.update_one({"_id": user['_id']}, {"$set": {"status": "served", "served_time": end_time}})
    mongo.db.queues.update_one(
        {"queue_id": queue_id},
        {"$inc": {"served_count": 1, "total_service_time": service_time}}
    )
    send_email(user['user_email'], "Your Turn Has Arrived", f"Please proceed now. Your queue number has been called.")
    flash(f"User {user['user_email']} admitted and notified")
    return redirect(url_for('home'))

# Close Queue
@app.route('/close_queue/<queue_id>')
def close_queue(queue_id):
    mongo.db.queues.update_one({"queue_id": queue_id}, {"$set": {"status": "inactive"}})
    flash("Queue closed successfully")
    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True)
