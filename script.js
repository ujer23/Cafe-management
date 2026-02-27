// API base URL — works both locally and in Docker/Jenkins
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : `http://${window.location.hostname}:5000`;

let currentUser = null;
let cart = [];
let countdownInterval = null;
let remainingSeconds = 0;

const orderBox = document.getElementById("orderBox");
const mapBox   = document.getElementById("mapBox");

/* ─── RESTORE LOGIN ON PAGE LOAD ─────────────────────────── */
window.onload = () => {
  const u = localStorage.getItem("cafe_user");
  if (u) {
    currentUser = u;
    document.getElementById("userBtn").innerText = "👤 " + u;
  }
  renderBill(true, true);
};

/* ─── NAVIGATION ─────────────────────────────────────────── */
function show(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (id === "orders") stage("placed");
}

/* ─── ADD TO CART ────────────────────────────────────────── */
function add(name, price, btn) {
  cart.push({ name, price });
  btn.innerText = "✔ Added";
  btn.classList.add("added");
  setTimeout(() => {
    btn.innerText = "Add";
    btn.classList.remove("added");
  }, 1200);
}

/* ─── REMOVE FROM CART ───────────────────────────────────── */
function removeItem(i) {
  cart.splice(i, 1);
  stage("placed");
}

/* ─── ORDER STAGES ───────────────────────────────────────── */
function stage(state) {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  document.querySelectorAll(".steps button").forEach(b => b.classList.remove("active"));
  const activeBtn = document.querySelector(`.steps button[onclick="stage('${state}')"]`);
  if (activeBtn) activeBtn.classList.add("active");

  mapBox.innerHTML = "";

  if (state === "placed")    renderBill(true, true);
  if (state === "preparing") renderBill(false, false, "⏳ Your order is being prepared with love…");
  if (state === "ontheway")  startCountdown(20);

  if (state === "delivered") {
    orderBox.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
        <h3 style="font-family:'Playfair Display',serif;font-size:24px;color:#ffb347;margin-bottom:8px;">Order Delivered!</h3>
        <p style="color:#f0e0cf;">Enjoy your meal. Thank you for ordering from Cafe.com ☕</p>
      </div>
    `;
    mapBox.innerHTML = `
      <p>Visit Our Cafe</p>
      <iframe src="https://www.google.com/maps?q=18.53559062907352,73.88057564859866&output=embed"></iframe>
    `;
    cart = [];
  }
}

/* ─── RENDER BILL ────────────────────────────────────────── */
function renderBill(removable, showBtn, extraText = "") {
  if (cart.length === 0) {
    orderBox.innerHTML = `
      <div style="text-align:center;padding:30px 0;color:rgba(255,255,255,0.4);">
        <div style="font-size:40px;margin-bottom:12px;">🛒</div>
        <p>Your cart is empty.</p>
        <p style="font-size:13px;margin-top:6px;">Go to Menu and add some items!</p>
      </div>
    `;
    return;
  }

  let total = 0;
  let html  = "";

  cart.forEach((item, index) => {
    total += item.price;
    html += `
      <div class="item">
        <span>${item.name}</span>
        <span style="display:flex;align-items:center;gap:6px;">
          ₹${item.price}
          ${removable ? `<button onclick="removeItem(${index})">✖</button>` : ""}
        </span>
      </div>
    `;
  });

  orderBox.innerHTML = `
    ${html}
    <div class="total">Total: ₹${total}</div>
    ${extraText ? `<p style="margin-top:12px;color:#f0e0cf;font-size:14px;">${extraText}</p>` : ""}
    ${showBtn ? `<button class="action-btn" onclick="placeOrder()">Place Order →</button>` : ""}
  `;
}

/* ─── PLACE ORDER → SAVE TO MYSQL ───────────────────────── */
async function placeOrder() {
  if (!currentUser) {
    if (!confirm("You're not logged in. Place as guest? (Login to save order history)")) return;
  }

  const total = cart.reduce((s, i) => s + i.price, 0);

  try {
    const res  = await fetch(`${API}/save-order`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser || "guest", items: cart, total })
    });
    const data = await res.json();
    if (data.success) console.log("✅ Order saved to MySQL");
    else console.warn("⚠ Order not saved:", data.message);
  } catch (err) {
    console.warn("Backend offline – order not saved to DB:", err.message);
  }

  stage("preparing");
}

/* ─── COUNTDOWN ──────────────────────────────────────────── */
function startCountdown(minutes) {
  remainingSeconds = minutes * 60;

  orderBox.innerHTML = `
    <div class="delivery">
      🚴 Your delivery partner is on the way!<br>
      <span id="timerText"></span>
    </div>
  `;

  updateTimerText();
  countdownInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      stage("delivered");
    } else {
      updateTimerText();
    }
  }, 1000);
}

function updateTimerText() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const el = document.getElementById("timerText");
  if (el) el.innerHTML = `
    ⏳ Arriving in <b>${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}</b><br>
    <span style="font-size:13px;color:rgba(255,255,255,0.5);">Your order will arrive before or at this time</span>
  `;
}

/* ─── TYPING EFFECT ──────────────────────────────────────── */
const texts = [
  "Fast delivery • Hot meals • Best taste",
  "Loved by students near Wadia College",
  "Your daily cafe since 2017"
];
let ti = 0, tj = 0;
setInterval(() => {
  const el = document.getElementById("typing");
  if (el) el.textContent = texts[ti].slice(0, tj++);
  if (tj > texts[ti].length) { tj = 0; ti = (ti + 1) % texts.length; }
}, 120);

/* ─── SWITCH LOGIN / REGISTER FORM ──────────────────────── */
function switchForm(type) {
  document.getElementById("loginTab").classList.remove("active");
  document.getElementById("registerTab").classList.remove("active");
  if (type === "login") {
    document.getElementById("loginForm").style.display  = "block";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("loginTab").classList.add("active");
  } else {
    document.getElementById("loginForm").style.display  = "none";
    document.getElementById("registerForm").style.display = "block";
    document.getElementById("registerTab").classList.add("active");
  }
}

/* ─── REGISTER → MySQL ───────────────────────────────────── */
async function registerUser() {
  const username = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value.trim();
  const msg      = document.getElementById("registerMsg");

  if (!username || !password) { msg.innerText = "⚠ Please fill all fields!"; return; }
  msg.innerText = "⏳ Creating account…";

  try {
    const res  = await fetch(`${API}/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = username;
      localStorage.setItem("cafe_user", username);
      document.getElementById("userBtn").innerText = "👤 " + username;
      msg.innerText = "✅ Registered successfully!";
      setTimeout(() => show("home"), 1200);
    } else {
      msg.innerText = "❌ " + (data.message || "Registration failed");
    }
  } catch (err) {
    msg.innerText = "❌ Cannot reach server. Is Flask running?";
  }
}

/* ─── LOGIN → MySQL ──────────────────────────────────────── */
async function loginUser() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();
  const msg      = document.getElementById("loginMsg");

  if (!username || !password) { msg.innerText = "⚠ Please fill all fields!"; return; }
  msg.innerText = "⏳ Logging in…";

  try {
    const res  = await fetch(`${API}/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = username;
      localStorage.setItem("cafe_user", username);
      document.getElementById("userBtn").innerText = "👤 " + username;
      msg.innerText = "🎉 Login successful!";
      setTimeout(() => show("home"), 1200);
    } else {
      msg.innerText = "❌ " + (data.message || "Invalid credentials");
    }
  } catch (err) {
    msg.innerText = "❌ Cannot reach server. Is Flask running?";
  }
}
