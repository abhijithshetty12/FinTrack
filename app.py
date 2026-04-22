from flask import Flask, render_template, request, jsonify
import mysql.connector
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def get_db_connection():
    return mysql.connector.connect(
        host="mysql-1feceda-abhijithshetty2008-9ab9.h.aivencloud.com",
        user="avnadmin",
        password="AVNS_IEIIV2idk8dCIsIRfL_",
        database="defaultdb"
    )

@app.route('/')
def home():
    return render_template("index.html")

# ---------------- AUTH ----------------
@app.route('/register', methods=['POST'])
def register():
    data = request.json

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    # ❌ Empty validation
    if not username or not password:
        return jsonify({"error": "Username and password cannot be empty"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("INSERT INTO Users (username, password) VALUES (%s,%s)",
                    (username, password))
        conn.commit()
        return jsonify({"user_id": cur.lastrowid})

    except Exception as e:
        if "Duplicate" in str(e):
            return jsonify({"error": "User already exists"}), 400
        return jsonify({"error": str(e)}), 500
    

@app.route('/login', methods=['POST'])
def login():
    data = request.json

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    # ❌ Empty validation
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT id FROM Users WHERE username=%s AND password=%s",
                (username, password))
    user = cur.fetchone()

    if user:
        return jsonify({"user_id": user['id']})

    return jsonify({"error": "Invalid credentials"}), 401


# ---------------- ADD TRANSACTION ----------------
@app.route('/add_transaction', methods=['POST'])
def add_transaction():
    data = request.json

    if float(data['amount']) <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        INSERT INTO Transactions (user_id, category, amount, type, date)
        VALUES (%s,%s,%s,%s,%s)
        """, (data['user_id'], data['category'], data['amount'], data['type'], data['date']))
        conn.commit()
        return jsonify({"message": "Added"})
    except Exception as e:
        if "Duplicate" in str(e):
            return jsonify({"error": "Already exists!"}), 400
        return jsonify({"error": str(e)}), 500

# ---------------- GET TRANSACTIONS ----------------
@app.route('/get_transactions')
def get_transactions():
    user_id = request.args.get('user_id')
    type_filter = request.args.get('type')
    search = request.args.get('search')

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    query = "SELECT * FROM Transactions WHERE user_id=%s"
    params = [user_id]

    if type_filter:
        query += " AND type=%s"
        params.append(type_filter)

    if search:
        query += " AND category LIKE %s"
        params.append(f"%{search}%")

    cur.execute(query, params)
    return jsonify(cur.fetchall())

# ---------------- DELETE ----------------
@app.route('/delete_transaction/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM Transactions WHERE id=%s", (id,))
    conn.commit()
    return jsonify({"message": "Deleted"})

# ---------------- DASHBOARD ----------------
@app.route('/dashboard/<int:user_id>')
def dashboard(user_id):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT SUM(amount) FROM Transactions WHERE type='income' AND user_id=%s", (user_id,))
    income = cur.fetchone()[0] or 0

    cur.execute("SELECT SUM(amount) FROM Transactions WHERE type='expense' AND user_id=%s", (user_id,))
    expense = cur.fetchone()[0] or 0

    return jsonify({
        "income": income,
        "expense": expense,
        "balance": income - expense
    })

@app.route('/update_transaction/<int:id>', methods=['PUT'])
def update_transaction(id):
    data = request.json

    amount = data.get('amount')

    # Validation
    if float(amount) <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "UPDATE Transactions SET amount=%s WHERE id=%s",
            (amount, id)
        )
        conn.commit()
        return jsonify({"message": "Updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- CHART ----------------
@app.route('/chart_data/<int:user_id>')
def chart_data(user_id):
    conn = get_db_connection()
    cur = conn.cursor()

    # Income & Expense
    cur.execute("SELECT SUM(amount) FROM Transactions WHERE type='income' AND user_id=%s", (user_id,))
    income = cur.fetchone()[0] or 0

    cur.execute("SELECT SUM(amount) FROM Transactions WHERE type='expense' AND user_id=%s", (user_id,))
    expense = cur.fetchone()[0] or 0

    balance = income - expense

    # Expense category breakdown
    cur = conn.cursor(dictionary=True)
    cur.execute("""
    SELECT category, SUM(amount) as total 
    FROM Transactions 
    WHERE type='expense' AND user_id=%s 
    GROUP BY category
    """, (user_id,))
    category_data = cur.fetchall()

    # Monthly data
    cur.execute("""
    SELECT DATE_FORMAT(date,'%Y-%m') as month, SUM(amount) as total 
    FROM Transactions 
    WHERE user_id=%s 
    GROUP BY month
    """, (user_id,))
    bar = cur.fetchall()

    return jsonify({
        "pie1": {
            "income": income,
            "expense": expense,
            "balance": balance
        },
        "pie2": category_data,
        "bar": bar
    })
if __name__ == "__main__":
    app.run(debug=True)
