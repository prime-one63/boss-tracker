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
  loadBossDashboard(); // 🔁 Refresh dashboard when coming back
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

  if (!document.getElementById("bossListSection")) {
    const html = await (await fetch("bosslist.html")).text();
    bossListContainer.innerHTML = html;
    const { initBossList } = await import("./bosslist.js");
    initBossList();
  }
});

// --- Fetch + render dashboard tiles ---
async function fetchAndRenderBosses() {
  try {
    const snapshot = await get(ref(db, "bosses"));
    if (!snapshot.exists()) {
      dashboardCards.innerHTML = "<p>No bosses found</p>";
      return;
    }

    const bosses = [];
    snapshot.forEach((childSnap) => {
      const b = childSnap.val();
      b._key = childSnap.key;
      let ts = Date.parse(b.nextSpawn);
      if (isNaN(ts) && typeof b.nextSpawn === "string") {
        ts = Date.parse(b.nextSpawn.replace(" ", "T"));
      }
      b._ts = isNaN(ts) ? Infinity : ts;
      bosses.push(b);
    });

    // Sort by soonest spawn
    bosses.sort((a, b) => a._ts - b._ts);

    // Clear current dashboard
    dashboardCards.innerHTML = "";

    // Apply grid layout
    dashboardCards.style.display = "grid";
    dashboardCards.style.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
    dashboardCards.style.gap = "1rem";

    // Create boss tiles
    bosses.forEach((b) => {
      const card = document.createElement("div");
      card.className =
        "boss-tile bg-white rounded-2xl shadow p-4 transition-transform duration-200 hover:scale-[1.02]";
      card.style.borderLeft = "6px solid #007bff";
      card.style.display = "flex";
      card.style.color = "black";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.height = "150px";

      const name = b.bossName || "Unknown";
      const spawnTime = isFinite(b._ts) ? new Date(b._ts) : null;
      const spawnDisplay = spawnTime
        ? spawnTime.toLocaleString([], { dateStyle: "short", timeStyle: "medium" })
        : "Invalid Time";

      // --- Header: guild badge + title (inline) ---
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.gap = "10px";
      header.style.marginBottom = "6px";

      // Guild tag (small pill)
      if(b.guild){
        const guild = b.guild || "";
        const guildTag = document.createElement("span");
        guildTag.textContent = guild;
        guildTag.className = `guild-badge ${guild}`; // use CSS class for consistent styling
        
        card.appendChild(guildTag);
      }
      

      // Title
      const title = document.createElement("h3");
      title.textContent = name;
      title.style.fontWeight = "700";
      title.style.margin = "0"; // reset default margin
      title.style.color = "#111";
      title.style.fontSize = "1.25rem";

      const spawnInfo = document.createElement("p");
      spawnInfo.innerHTML = `<span style="color:#666;">Next Spawn:</span> <strong>${spawnDisplay}</strong>`;
      spawnInfo.style.fontSize = "0.95em";
      spawnInfo.style.marginBottom = "8px";

      const countdown = document.createElement("p");
      countdown.className = "countdown";
      countdown.style.fontSize = "1.3em";
      countdown.style.fontWeight = "bold";
      countdown.style.color = "#007bff";
      countdown.textContent = "--:--:--";

      card.appendChild(title);
      card.appendChild(spawnInfo);
      card.appendChild(countdown);
      dashboardCards.appendChild(card);

      // Countdown logic
      const updateCountdown = () => {
        if (!spawnTime) {
          countdown.textContent = "--:--:--";
          card.style.borderLeftColor = "#888";
          return;
        }

        const now = new Date();
        const diff = spawnTime - now;
        const endTime = new Date(spawnTime.getTime() + 5 * 60000); // 5 minutes after spawn

        if (diff <= 0 && now <= endTime) {
          countdown.textContent = "SPAWNING NOW!";
          countdown.style.color = "red";
          card.style.borderLeftColor = "red";
        } else if (diff > 0 && diff <= 10 * 60000) {
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          countdown.textContent = `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
          countdown.style.color = "#ff9900";
          card.style.borderLeftColor = "#ff9900";
        } else if (diff > 0) {
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          countdown.textContent = `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
          countdown.style.color = "#007bff";
          card.style.borderLeftColor = "#007bff";
        } else {
          countdown.textContent = "Spawn Passed";
          countdown.style.color = "#777";
          card.style.borderLeftColor = "#777";
        }
      };

      updateCountdown();
      setInterval(updateCountdown, 1000);
    });
  } catch (err) {
    console.error("Error loading bosses:", err);
    dashboardCards.innerHTML = "<p>Error loading bosses</p>";
  }
}

// --- Load on startup ---
window.addEventListener("load", fetchAndRenderBosses);

// --- Refresh when tab visible ---
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchAndRenderBosses();
});
