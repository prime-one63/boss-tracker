import { db } from "./firebase.js";
import { ref, push, set, update, remove, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function initBossList() {
  const bossForm = document.getElementById("bossForm");
  const bossTable = document.querySelector("#bossTable tbody");
  const bossModal = new bootstrap.Modal(document.getElementById("bossModal"));

  const bossName = document.getElementById("bossName");
  const bossHour = document.getElementById("bossHour");
  const lastKilled = document.getElementById("lastKilled");
  const nextSpawn = document.getElementById("nextSpawn");
  const editKey = document.getElementById("editKey");

  function calcNextSpawn() {
    const hours = parseFloat(bossHour.value);
    if (hours && lastKilled.value) {
      const d = new Date(lastKilled.value);
      d.setHours(d.getHours() + hours);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      nextSpawn.value = local;
    }
  }

  bossHour.addEventListener("input", calcNextSpawn);
  lastKilled.addEventListener("input", calcNextSpawn);

  // Convert various stored date strings into a datetime-local input value (YYYY-MM-DDTHH:MM)
  // - if already in the desired format, returns it unchanged
  // - if it contains timezone (Z or offset) or other format, parse to Date then build local string
  function toDatetimeLocalInput(stored) {
    if (!stored) return "";

    // If it's already in YYYY-MM-DDTHH:MM (no seconds, no timezone), return as-is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stored)) {
      return stored;
    }

    // Try to parse and convert to local datetime-local string
    const d = new Date(stored);
    if (isNaN(d)) return "";

    const pad = (n) => String(n).padStart(2, "0");
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const HH = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
  }

  bossForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const lastKilledVal = document.getElementById("lastKilled").value;   // already datetime-local string
    const nextSpawnVal = document.getElementById("nextSpawn").value;     // datetime-local string (keep as-is)
    const bossHourVal = document.getElementById("bossHour").value;
    const guildVal = document.getElementById("guild").value || "FFA";

    // If you want to *recalculate* nextSpawn from lastKilled + bossHour when adding new:
    // (optional) if not editing and lastKilled & bossHour present, compute nextSpawnVal from them.
    // For edit we will trust the nextSpawn input so we won't overwrite it.

    const entry = {
      bossName: document.getElementById("bossName").value.trim(),
      bossHour: bossHourVal,
      lastKilled: lastKilledVal,
      nextSpawn: nextSpawnVal,
      guild: guildVal
    };

    if (document.getElementById("editKey").value) {
      await update(ref(db, "bosses/" + document.getElementById("editKey").value), entry);
    } else {
      await set(push(ref(db, "bosses")), entry);
    }

    bossForm.reset();
    document.getElementById("nextSpawn").value = "";
    document.getElementById("editKey").value = "";
    if (bossModal) bossModal.hide();
  });



  onValue(ref(db, "bosses"), (snapshot) => {
  bossTable.innerHTML = "";

  const bosses = [];

  // Collect all bosses into an array first
  snapshot.forEach((child) => {
    const key = child.key;
    const b = child.val();
    b._key = key;

    // Parse nextSpawn for proper sorting
    let ts = Date.parse(b.nextSpawn);
    if (isNaN(ts) && typeof b.nextSpawn === "string") {
      ts = Date.parse(b.nextSpawn.replace(" ", "T"));
    }
    b._ts = isNaN(ts) ? Infinity : ts;

    bosses.push(b);
  });

  // ✅ Sort bosses by soonest nextSpawn
  bosses.sort((a, b) => a._ts - b._ts);

  // Render sorted table
  bosses.forEach((b) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.bossName || "Unknown"}</td>
      <td><span class="badge bg-secondary">${b.guild || "FFA"}</span></td>
      <td>${b.bossHour || "--"} hr</td>
      <td>${b.lastKilled || "--"}</td>
      <td>${b.nextSpawn || "--"}</td>
      <td>
        <button class="btn btn-info btn-sm edit-btn" data-key="${b._key}">Edit</button>
        <button class="btn btn-warning btn-sm reset-btn" data-key="${b._key}">Reset</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${b._key}">Delete</button>
      </td>`;
    bossTable.appendChild(tr);
  });

  // --- EDIT BUTTON ---
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      const bossRef = ref(db, "bosses/" + key);
      const snap = await get(bossRef);
      if (!snap.exists()) return alert("⚠️ Boss not found!");

      const b = snap.val();

      // Fill modal form fields — convert stored strings to datetime-local format safely
      document.getElementById("bossName").value = b.bossName || "";
      document.getElementById("bossHour").value = b.bossHour || "";

      // Use helper to get correct datetime-local strings for the inputs
      document.getElementById("lastKilled").value = toDatetimeLocalInput(b.lastKilled);
      document.getElementById("nextSpawn").value = toDatetimeLocalInput(b.nextSpawn);

      document.getElementById("guild").value = b.guild || "FFA";
      document.getElementById("editKey").value = key;

      // IMPORTANT: DO NOT auto-recalculate nextSpawn here.
      // Let calcNextSpawn() only run when the user changes bossHour/lastKilled inputs.
      // This prevents overwriting a correct stored nextSpawn.

      const bossModal = new bootstrap.Modal(document.getElementById("bossModal"));
      bossModal.show();
    });
  });

  // Rebind Reset button events
  document.querySelectorAll(".reset-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      const bossRef = ref(db, "bosses/" + key);
      const snap = await get(bossRef);
      if (!snap.exists()) return alert("⚠️ Boss not found!");

      const entry = snap.val();
      if (!confirm(`Reset ${entry.bossName}?`)) return;

      const now = new Date();
      const nextSpawnTime = new Date(now.getTime() + entry.bossHour * 60 * 60 * 1000);

      await update(bossRef, {
        lastKilled: now.toISOString(),
        nextSpawn: nextSpawnTime.toISOString(),
      });
    });
  });

  // Rebind Delete button events
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this boss?")) {
        await remove(ref(db, "bosses/" + btn.dataset.id));
      }
    });
  });
});

}
