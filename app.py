from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector
import bcrypt
import os

app = Flask(__name__)
CORS(app)  # Allow browser to call this API

# ─── DB CONFIG (reads from environment variables set in Docker/Jenkins) ───
DB_CONFIG = {
    "host":     os.environ.get("DB_HOST",     "localhost"),
    "user":     os.environ.get("DB_USER",     "root"),
    "password": os.environ.get("DB_PASSWORD", ""),
    "database": os.environ.get("DB_NAME",     "devops"),
    "port":     int(os.environ.get("DB_PORT", 3306))
}

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

# ─── CREATE TABLES ON FIRST RUN ──────────────────────────────────────────
def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            username   VARCHAR(100) NOT NULL UNIQUE,
            password   VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            user_id    INT DEFAULT NULL,
            username   VARCHAR(100) DEFAULT NULL,
            item_name  VARCHAR(200) NOT NULL,
            price      DECIMAL(10,2) NOT NULL,
            total      DECIMAL(10,2) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Tables ready in database:", DB_CONFIG["database"])

# ─── HOME (SHOW WEBSITE) ────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")

# ─── HEALTH CHECK (API) ─────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Cafe.com API is running 🚀"})

# ─── REGISTER ─────────────────────────────────────────────────────────────
@app.route("/register", methods=["POST"])
def register():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn   = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password) VALUES (%s, %s)",
            (username, hashed)
        )
        conn.commit()
        print(f"✅ New user registered: {username}")
        return jsonify({"success": True, "message": "Registered successfully", "username": username})
    except mysql.connector.IntegrityError:
        return jsonify({"success": False, "message": "Username already taken"}), 409
    finally:
        cursor.close()
        conn.close()

# ─── LOGIN ─────────────────────────────────────────────────────────────────
@app.route("/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    conn   = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if user and bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
            print(f"✅ User logged in: {username}")
            return jsonify({"success": True, "message": "Login successful", "username": username})
        else:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401
    finally:
        cursor.close()
        conn.close()

# ─── SAVE ORDER ────────────────────────────────────────────────────────────
@app.route("/save-order", methods=["POST"])
def save_order():
    data     = request.get_json()
    username = data.get("username", "guest")
    items    = data.get("items", [])
    total    = data.get("total", 0)

    if not items:
        return jsonify({"success": False, "message": "Cart is empty"}), 400

    conn   = get_db()
    cursor = conn.cursor()
    try:
        user_id = None
        if username and username != "guest":
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            row = cursor.fetchone()
            if row:
                user_id = row[0]

        for item in items:
            cursor.execute(
                "INSERT INTO orders (user_id, username, item_name, price, total) VALUES (%s, %s, %s, %s, %s)",
                (user_id, username, item["name"], item["price"], total)
            )
        conn.commit()
        print(f"✅ Order saved for user '{username}': {[i['name'] for i in items]}, total ₹{total}")
        return jsonify({"success": True, "message": f"Order saved! {len(items)} items stored."})
    finally:
        cursor.close()
        conn.close()

# ─── GET ORDER HISTORY ──────────────────────────────────────────────────────
@app.route("/orders/<username>", methods=["GET"])
def get_orders(username):
    conn   = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT * FROM orders WHERE username = %s ORDER BY created_at DESC",
            (username,)
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
        return jsonify({"success": True, "orders": rows})
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
