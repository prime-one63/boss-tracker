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

  bossForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = {
      bossName: bossName.value.trim(),
      bossHour: bossHour.value,
      lastKilled: lastKilled.value,
      nextSpawn: nextSpawn.value
    };
    if (editKey.value) await update(ref(db, "bosses/" + editKey.value), entry);
    else await set(push(ref(db, "bosses")), entry);

    bossForm.reset();
    nextSpawn.value = "";
    editKey.value = "";
    bossModal.hide();
  });

  onValue(ref(db, "bosses"), (snapshot) => {
    bossTable.innerHTML = "";
    snapshot.forEach((child) => {
      const key = child.key;
      const b = child.val();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.bossName}</td>
        <td>${b.bossHour} hr</td>
        <td>${b.lastKilled}</td>
        <td>${b.nextSpawn}</td>
        <td>
          <button class="btn btn-warning btn-sm reset-btn" data-key="${key}">Reset</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${key}">Delete</button>
        </td>`;
      bossTable.appendChild(tr);
    });

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

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("Delete this boss?")) await remove(ref(db, "bosses/" + btn.dataset.id));
      });
    });
  });
}
