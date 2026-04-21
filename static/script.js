let user_id = null;
let pieChart1Instance = null;
let pieChart2Instance = null;

// UI Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set current date as default for date input
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);

    // Initial check for user_id
    const storedUser = localStorage.getItem('user_id');
    const storedUsername = localStorage.getItem('username');
    if (storedUser) {
        user_id = parseInt(storedUser);
        if (storedUsername) updateUsernameUI(storedUsername);
        onLoginSuccess();
    }
});

function updateUsernameUI(name) {
    const badge = document.getElementById('userBadge');
    const display = document.getElementById('displayUsername');
    if (badge && display) {
        display.innerText = name;
        badge.style.display = 'inline-flex';
    }
}

function showPopup(msg, type = 'success') {
    const toast = document.getElementById("popup");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="toast-icon"></i>
        <span class="toast-message">${msg}</span>
    `;
    lucide.createIcons({context: toast});
    
    // Trigger animation
    toast.style.display = 'flex';
    void toast.offsetWidth; // Force reflow
    
    setTimeout(() => {
        toast.classList.add('hide-toast');
        setTimeout(() => {
            toast.style.display = 'none';
            toast.classList.remove('hide-toast');
        }, 200);
    }, 4000);
}

// THEME TOGGLE
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
    
    // Refresh charts to apply new theme colors if needed
    if (user_id) loadCharts();
}

function updateThemeIcons(theme) {
    const sun = document.getElementById('sunIcon');
    const moon = document.getElementById('moonIcon');
    if (theme === 'dark') {
        sun.style.display = 'none';
        moon.style.display = 'block';
    } else {
        sun.style.display = 'block';
        moon.style.display = 'none';
    }
}

// AUTH
async function registerUser() {
    const uname = username.value.trim();
    const pass = password.value.trim();

        if (!uname || !pass) {
            return showPopup("Username & Password required", 'error');
        }

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uname, password: pass })
        });

        const d = await res.json();
        if (!res.ok) return showPopup(d.error, 'error');

        user_id = d.user_id;
        localStorage.setItem('user_id', user_id);
        localStorage.setItem('username', uname);
        updateUsernameUI(uname);
        showPopup("Registered successfully!", 'success');
        onLoginSuccess();
    } catch (e) {
        showPopup("Connection error", 'error');
    }
}

async function loginUser() {
    const uname = username.value.trim();
    const pass = password.value.trim();

    if (!uname || !pass) {
        return showPopup("Username & Password required", 'error');
    }

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uname, password: pass })
        });

        const d = await res.json();
        if (!res.ok) return showPopup(d.error, 'error');

        user_id = d.user_id;
        localStorage.setItem('user_id', user_id);
        localStorage.setItem('username', uname);
        updateUsernameUI(uname);
        showPopup("Login success", 'success');
        onLoginSuccess();
    } catch (e) {
        showPopup("Connection error", true);
    }
}

function onLoginSuccess() {
    document.getElementById('loginInputs').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'flex';
    loadData();
}

function logoutUser() {
    user_id = null;
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');

    // Reset UI
    document.getElementById('loginInputs').style.display = 'flex';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('userBadge').style.display = 'none';
    
    document.getElementById('transactionList').innerHTML = `
        <div class="empty-state">
            <i data-lucide="receipt"></i>
            <p>Login to see your transactions</p>
        </div>
    `;
    lucide.createIcons();
    
    document.getElementById('income').innerText = "₹0";
    document.getElementById('expense').innerText = "₹0";
    document.getElementById('balance').innerText = "₹0";

    if (pieChart1Instance) pieChart1Instance.destroy();
    if (pieChart2Instance) pieChart2Instance.destroy();

    showPopup("Logged out successfully", 'success');
}

// TRANSACTIONS
async function addTransaction() {
    if (!user_id) return showPopup("Please login first", 'error');

    const cat = document.getElementById('category').value.trim();
    const amt = document.getElementById('amount').value;
    const typ = document.getElementById('type').value;
    const dt = document.getElementById('date').value;

    if (!cat || !amt || !dt) {
        return showPopup("Please fill all fields", 'error');
    }

    try {
        const res = await fetch('/add_transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id,
                category: cat,
                amount: amt,
                type: typ,
                date: dt
            })
        });

    const d = await res.json();
    if (!res.ok) return showPopup(d.error, 'error');

    showPopup("Transaction added", 'success');
        document.getElementById('category').value = "";
        document.getElementById('amount').value = "";
        loadData();
    } catch (e) {
        showPopup("Error adding transaction", 'error');
    }
}

async function loadData() {
    if (!user_id) return;

    const filterType = document.getElementById('filterType').value;
    // Search is removed from requirements, but we keep the API compatible by passing empty search
    const res = await fetch(`/get_transactions?user_id=${user_id}&search=&type=${filterType}`);
    const data = await res.json();

    renderTransactions(data);
    loadDashboard();
    loadCharts();
}

function renderTransactions(data) {
    const list = document.getElementById('transactionList');
    if (data.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="receipt"></i>
                <p>No transactions found</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = "";
    data.forEach(t => {
        const isExpense = t.type === 'expense';
        const date = new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        
        html += `
            <div class="transaction-item">
                <div class="t-info">
                    <div class="t-icon" style="background: ${isExpense ? 'var(--error-bg)' : 'var(--success-bg)'}; color: ${isExpense ? 'var(--error)' : 'var(--success)'}">
                        <i data-lucide="${isExpense ? 'arrow-down-left' : 'arrow-up-right'}"></i>
                    </div>
                    <div class="t-details">
                        <h4>${t.category}</h4>
                        <p>${date}</p>
                    </div>
                </div>
                <div class="t-amount">
                    <div class="t-value" style="color: ${isExpense ? 'var(--error)' : 'var(--success)'}">
                        ${isExpense ? '-' : '+'} ₹${parseFloat(t.amount).toLocaleString('en-IN')}
                    </div>
                    <div class="t-actions">
                        <button class="action-icon-btn" onclick="editAmount(${t.id}, ${t.amount})" title="Edit">
                            <i data-lucide="pencil" style="width:14px;height:14px"></i>
                        </button>
                        <button class="action-icon-btn" onclick="del(${t.id})" title="Delete">
                            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
    lucide.createIcons();
}

async function del(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    await fetch(`/delete_transaction/${id}`, { method: 'DELETE' });
    loadData();
}

async function editAmount(id, oldAmount) {
    const newAmount = prompt("Enter new amount:", oldAmount);
    if (newAmount === null) return;

    if (isNaN(newAmount) || parseFloat(newAmount) <= 0) {
        return showPopup("Invalid amount", 'error');
    }

    const res = await fetch(`/update_transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newAmount })
    });

    const d = await res.json();
    if (!res.ok) return showPopup(d.error, 'error');

    showPopup("Updated successfully", 'success');
    loadData();
}

// DASHBOARD & CHARTS
async function loadDashboard() {
    const res = await fetch(`/dashboard/${user_id}`);
    const d = await res.json();

    document.getElementById('income').innerText = `₹${parseFloat(d.income).toLocaleString('en-IN')}`;
    document.getElementById('expense').innerText = `₹${parseFloat(d.expense).toLocaleString('en-IN')}`;
    document.getElementById('balance').innerText = `₹${parseFloat(d.balance).toLocaleString('en-IN')}`;

    // Alert Logic
    if (d.income > 0) {
        let limit = 0.8 * d.income; // Updated to 80% for more realistic warning
        if (d.expense >= limit) {
    showPopup("⚠️ Warning: Your expenses have reached 80% of your income!", 'warning');
        }
    }
}

async function loadCharts() {
    const res = await fetch(`/chart_data/${user_id}`);
    const d = await res.json();

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Chart.js Defaults
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Inter', sans-serif";

    if (pieChart1Instance) pieChart1Instance.destroy();
    if (pieChart2Instance) pieChart2Instance.destroy();

    // 1. Overview Pie
    pieChart1Instance = new Chart(document.getElementById("pieChart1"), {
        type: 'doughnut',
        data: {
            labels: ["Income", "Expense", "Balance"],
            datasets: [{
                data: [d.pie1.income, d.pie1.expense, d.pie1.balance],
                backgroundColor: ['#10b981', '#f43f5e', '#1560BD'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Income vs Expense' }
            },
            cutout: '70%'
        }
    });

    // 2. Category Breakdown
    pieChart2Instance = new Chart(document.getElementById("pieChart2"), {
        type: 'pie',
        data: {
            labels: d.pie2.map(x => x.category),
            datasets: [{
                data: d.pie2.map(x => x.total),
                backgroundColor: [
                    '#1560BD', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Expense by Category' }
            }
        }
    });
}
