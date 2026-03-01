// API base URL — works both locally and in Docker/Jenkins
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : `http://${window.location.hostname}:5000`;

let currentUser = null;
let cart = [];
let countdownInterval = null;
let remainingSeconds = 0;

/* ─── RESTORE LOGIN ON PAGE LOAD ─────────────────────────── */
window.onload = () => {
  const u = localStorage.getItem("cafe_user");
  if (u) {
    currentUser = u;
    document.getElementById("userBtn").innerText = "👤 " + u;
  }

  // Typing animation
  const phrases = ["Fresh food, fast delivery ☕", "Near Wadia College 🎓", "Order in seconds 🚀"];
  let pi = 0, ci = 0, deleting = false;
  const typingEl = document.getElementById("typing");
  if (typingEl) {
    setInterval(() => {
      const phrase = phrases[pi];
      if (!deleting) {
        typingEl.textContent = phrase.slice(0, ++ci);
        if (ci === phrase.length) deleting = true;
      } else {
        typingEl.textContent = phrase.slice(0, --ci);
        if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
      }
    }, 80);
  }
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
  if (btn) {
    btn.innerText = "✔ Added";
    btn.classList.add("added");
    setTimeout(() => { btn.innerText = "Add"; btn.classList.remove("added"); }, 1200);
  }
}

/* ─── REMOVE FROM CART ───────────────────────────────────── */
function removeItem(i) {
  cart.splice(i, 1);
  renderBill(true, true);
}

/* ─── ORDER STAGES ───────────────────────────────────────── */
function stage(state) {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  // Scoped ONLY to #orders — avoids conflict with Account tabs
  const ordersSection = document.getElementById("orders");
  ordersSection.querySelectorAll(".steps button").forEach(b => b.classList.remove("active"));
  const activeBtn = ordersSection.querySelector(`.steps button[onclick="stage('${state}')"]`);
  if (activeBtn) activeBtn.classList.add("active");

  const mapBox = document.getElementById("mapBox");
  if (mapBox) mapBox.innerHTML = "";

  if (state === "placed")    renderBill(true, true);
  if (state === "preparing") renderBill(false, false, "⏳ Your order is being prepared with love…");
  if (state === "ontheway") {
    startCountdown(20);
    // Disable Delivered button — only unlocks when countdown finishes
    const allBtns = ordersSection.querySelectorAll(".steps button");
    allBtns.forEach(b => { if (b.innerText.includes("Delivered")) b.disabled = true; });
  }

  if (state === "delivered") {
    // Re-enable all buttons
    ordersSection.querySelectorAll(".steps button").forEach(b => b.disabled = false);
    const orderBox = document.getElementById("orderBox");
    orderBox.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
        <h3 style="font-family:'Playfair Display',serif;font-size:24px;color:#ffb347;margin-bottom:8px;">Order Delivered!</h3>
        <p style="color:#f0e0cf;">Enjoy your meal. Thank you for ordering from Cafe.com ☕</p>
      </div>
    `;
    if (mapBox) mapBox.innerHTML = `
      <p>Visit Our Cafe</p>
      <iframe src="https://www.google.com/maps?q=18.53559062907352,73.88057564859866&output=embed"></iframe>
    `;
    cart = [];
  }
}

/* ─── RENDER BILL ────────────────────────────────────────── */
function renderBill(removable, showBtn, extraText = "") {
  const orderBox = document.getElementById("orderBox");
  if (!orderBox) return;

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

  let total = 0, html = "";
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

/* ─── PLACE ORDER → saves to DB via /save-order ─────────── */
async function placeOrder() {
  if (!currentUser) {
    alert("Please login first to place an order!");
    show("user");
    return;
  }
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  const total = cart.reduce((s, i) => s + i.price, 0);

  try {
    const res = await fetch(`${API}/save-order`, {   // ✅ matches Flask route /save-order
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, items: cart, total })
    });
    const data = await res.json();
    if (data.success) {
      stage("preparing");
    } else {
      alert(data.message || "Failed to place order.");
    }
  } catch (err) {
    console.error("Order error:", err);
    alert("Could not connect to server.");
  }
}

/* ─── COUNTDOWN (On The Way) ─────────────────────────────── */
function startCountdown(minutes) {
  const orderBox = document.getElementById("orderBox");
  if (!orderBox) return;

  remainingSeconds = minutes * 60;

  function tick() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    orderBox.innerHTML = `
      <div class="delivery">
        🚴 Your order is on the way!<br>
        Estimated arrival:<br>
        <b>${m}:${s.toString().padStart(2, "0")}</b>
      </div>
    `;
    if (remainingSeconds <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      stage("delivered");
    }
    remainingSeconds--;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

/* ─── LOGIN ──────────────────────────────────────────────── */
async function loginUser() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!username || !password) { msg.innerText = "Please fill in all fields."; return; }

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = username;
      localStorage.setItem("cafe_user", username);
      document.getElementById("userBtn").innerText = "👤 " + username;
      msg.style.color = "#2ecc71";
      msg.innerText = "✅ Logged in successfully!";
    } else {
      msg.style.color = "#ff6b6b";
      msg.innerText = data.message || "Invalid credentials.";
    }
  } catch (err) {
    msg.style.color = "#ff6b6b";
    msg.innerText = "Could not connect to server.";
  }
}

/* ─── REGISTER ───────────────────────────────────────────── */
async function registerUser() {
  const username = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value.trim();
  const msg = document.getElementById("registerMsg");

  if (!username || !password) { msg.innerText = "Please fill in all fields."; return; }

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      msg.style.color = "#2ecc71";
      msg.innerText = "✅ Account created! You can now login.";
      switchForm("login");
    } else {
      msg.style.color = "#ff6b6b";
      msg.innerText = data.message || "Registration failed.";
    }
  } catch (err) {
    msg.style.color = "#ff6b6b";
    msg.innerText = "Could not connect to server.";
  }
}

/* ─── AUTH TAB SWITCHER ──────────────────────────────────── */
function switchForm(form) {
  document.getElementById("loginForm").style.display    = form === "login"    ? "block" : "none";
  document.getElementById("registerForm").style.display = form === "register" ? "block" : "none";
  document.getElementById("loginTab").classList.toggle("active",    form === "login");
  document.getElementById("registerTab").classList.toggle("active", form === "register");
}
