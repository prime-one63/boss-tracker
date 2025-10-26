import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const navDashboard = document.getElementById("navDashboard");
const navBossList = document.getElementById("navBossList");
const dashboardSection = document.getElementById("dashboardSection");
const bossListContainer = document.getElementById("bossListContainer");
const dashboardCards = document.getElementById("dashboardCards");

let isAuthorized = false;

/* ======================
   🔹 NAVIGATION
====================== */
navDashboard.addEventListener("click", () => {
  navDashboard.classList.add("active");
  navBossList.classList.remove("active");
  dashboardSection.style.display = "block";
  bossListContainer.style.display = "none";
  fetchAndRenderBosses(); // Refresh when returning
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

/* ======================
   🔹 HELPER FUNCTIONS
====================== */

// Compute next spawn date for weekly schedules (e.g. "Monday 11:30, Thursday 19:00")
function getNextScheduledSpawn(scheduleStr) {
  if (!scheduleStr) return null;

  const now = new Date();
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const schedules = scheduleStr.split(",").map(s => s.trim());
  let soonest = null;

  for (const entry of schedules) {
    const [dayStr, timeStr] = entry.split(" ");
    const dayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === dayStr.toLowerCase());
    if (dayIndex === -1 || !timeStr) continue;

    const [hour, minute] = timeStr.split(":").map(Number);
    let candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);

    const diffDays = (dayIndex - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + diffDays);

    // If this week’s time already passed, push to next week
    if (candidate <= now) candidate.setDate(candidate.getDate() + 7);

    if (!soonest || candidate < soonest) soonest = candidate;
  }

  return soonest;
}

function formatCountdown(targetDate) {
  if (!targetDate) return "--:--:--";
  const now = new Date();
  let diff = (targetDate - now) / 1000; // seconds
  if (diff <= 0) return "SPAWNING NOW!";
  const hours = Math.floor(diff / 3600);
  diff %= 3600;
  const minutes = Math.floor(diff / 60);
  const seconds = Math.floor(diff % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/* ======================
   🔹 DASHBOARD RENDER
====================== */
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

      // If boss uses fixed schedule, calculate next spawn dynamically
      if (b.bossSchedule && !b.bossHour) {
        const nextDate = getNextScheduledSpawn(b.bossSchedule);
        ts = nextDate ? nextDate.getTime() : Infinity;
        b.nextSpawn = nextDate ? nextDate.toISOString() : b.nextSpawn;
      }

      b._ts = isNaN(ts) ? Infinity : ts;
      bosses.push(b);
    });

    // Sort by soonest spawn
    bosses.sort((a, b) => a._ts - b._ts);

    // Reset layout
    dashboardCards.innerHTML = "";
    dashboardCards.style.display = "grid";
    dashboardCards.style.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
    dashboardCards.style.gap = "1rem";

    // Render each boss tile
    bosses.forEach((b) => {
      const card = document.createElement("div");
      card.className =
        "boss-tile bg-white rounded-2xl shadow p-4 transition-transform duration-200 hover:scale-[1.02]";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.height = "150px";
      card.style.borderLeft = "6px solid #007bff";
      card.style.color = "black";

      const guild = b.guild || "FFA";
      const guildTag = document.createElement("span");
      guildTag.textContent = guild;
      guildTag.className = `guild-badge ${guild}`;
      card.appendChild(guildTag);

      const title = document.createElement("h3");
      title.textContent = b.bossName || "Unknown";
      title.style.fontWeight = "700";
      title.style.fontSize = "1.25rem";
      title.style.margin = "0";
      card.appendChild(title);

      const nextDate = b._ts !== Infinity ? new Date(b._ts) : null;
      const spawnDisplay = nextDate
        ? nextDate.toLocaleString([], { dateStyle: "short", timeStyle: "medium" })
        : "--";

      const spawnInfo = document.createElement("p");
      spawnInfo.innerHTML = `<span style="color:#666;">Next Spawn:</span> <strong>${spawnDisplay}</strong>`;
      spawnInfo.style.fontSize = "0.95em";
      spawnInfo.style.marginBottom = "8px";
      card.appendChild(spawnInfo);

      const countdown = document.createElement("p");
      countdown.className = "countdown";
      countdown.style.fontSize = "1.3em";
      countdown.style.fontWeight = "bold";
      countdown.textContent = formatCountdown(nextDate);
      card.appendChild(countdown);

      dashboardCards.appendChild(card);

      // ⏱ Real-time countdown updater
      setInterval(() => {
        if (!nextDate) {
          countdown.textContent = "--:--:--";
          card.style.borderLeftColor = "#888";
          return;
        }

        const now = new Date();
        const diff = nextDate - now;

        if (diff <= 0 && diff > -5 * 60000) {
          countdown.textContent = "SPAWNING NOW!";
          countdown.style.color = "red";
          card.style.borderLeftColor = "red";
        } else if (diff > 0 && diff <= 10 * 60000) {
          countdown.textContent = formatCountdown(nextDate);
          countdown.style.color = "#ff9900";
          card.style.borderLeftColor = "#ff9900";
        } else if (diff > 0) {
          countdown.textContent = formatCountdown(nextDate);
          countdown.style.color = "#007bff";
          card.style.borderLeftColor = "#007bff";
        } else {
          countdown.textContent = "Spawn Passed";
          countdown.style.color = "#777";
          card.style.borderLeftColor = "#777";
        }
      }, 1000);
    });
  } catch (err) {
    console.error("Error loading bosses:", err);
    dashboardCards.innerHTML = "<p>Error loading bosses</p>";
  }
}

/* ======================
   🔹 STARTUP HOOKS
====================== */
window.addEventListener("load", fetchAndRenderBosses);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchAndRenderBosses();
});
