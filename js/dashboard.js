import { db } from "./firebase.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const navDashboard = document.getElementById("navDashboard");
const navBossList = document.getElementById("navBossList");
const dashboardSection = document.getElementById("dashboardSection");
const bossListContainer = document.getElementById("bossListContainer");
const dashboardCards = document.getElementById("dashboardCards");

let isAuthorized = false;

// --- Navigation ---
navDashboard.addEventListener("click", () => {
  navDashboard.classList.add("active");
  navBossList.classList.remove("active");
  dashboardSection.style.display = "block";
  bossListContainer.style.display = "none";
});

navBossList.addEventListener("click", async () => {
  if (!isAuthorized) {
    const entered = prompt("Enter admin access token:");
    if (!entered) return alert("❌ Invalid token");
    try {
      const snap = await get(ref(db, "tokens/" + entered.trim()));
      if (!snap.exists() || snap.val() !== true) {
        return alert("❌ Invalid token");
      }
      isAuthorized = true;
      alert("✅ Access granted!");
    } catch (err) {
      console.error(err);
      return alert("❌ Token check failed");
    }
  }

  navBossList.classList.add("active");
  navDashboard.classList.remove("active");
  dashboardSection.style.display = "none";
  bossListContainer.style.display = "block";

  // Lazy-load bosslist.html only after authorization
  if (!document.getElementById("bossListSection")) {
    const html = await (await fetch("bosslist.html")).text();
    bossListContainer.innerHTML = html;
    // Once loaded, initialize bosslist logic
    const { initBossList } = await import("./bosslist.js");
    initBossList();
  }
});

// --- Dashboard Cards ---
onValue(ref(db, "bosses"), (snapshot) => {
  dashboardCards.innerHTML = "";
  snapshot.forEach((child) => {
    const b = child.val();
    const key = child.key;

    const card = document.createElement("div");
    card.className = "col-md-4";
    card.innerHTML = `
      <div class="boss-card">
        <h5>${b.bossName}</h5>
        <p>Next Spawn: <strong>${new Date(b.nextSpawn).toLocaleString()}</strong></p>
        <div class="countdown" id="countdown-${key}">--:--:--</div>
      </div>`;
    dashboardCards.appendChild(card);
  });
});

// --- Countdown Timer ---
setInterval(() => {
  document.querySelectorAll(".countdown").forEach((el) => {
    const key = el.id.replace("countdown-", "");
    const card = el.closest(".boss-card");
    const nextTimeText = card.querySelector("p strong").textContent;
    const nextTime = new Date(nextTimeText);
    const now = new Date();
    const diff = nextTime - now;

    if (isNaN(diff)) return (el.textContent = "--:--:--");
    if (diff <= 0) {
      el.textContent = "Spawned!";
      el.style.color = "red";
    } else {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el.textContent = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
  });
}, 1000);
