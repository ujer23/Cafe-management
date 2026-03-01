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

  if (btn) {
    btn.innerText = "✔ Added";
    btn.classList.add("added");
    setTimeout(() => {
      btn.innerText = "Add";
      btn.classList.remove("added");
    }, 1200);
  }

  // 🔥 update UI immediately
  renderBill(true, true);
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

  const mapBox = document.getElementById("mapBox");
  if (mapBox) mapBox.innerHTML = "";

  if (state === "placed")    renderBill(true, true);
  if (state === "preparing") renderBill(false, false, "⏳ Your order is being prepared with love…");
  if (state === "ontheway")  startCountdown(20);

  if (state === "delivered") {
    const orderBox = document.getElementById("orderBox");
    const mapBox = document.getElementById("mapBox");
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
