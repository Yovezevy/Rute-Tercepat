// ============================================
// DATA
// ============================================
const locations = {
  Gudang: { name: "Gudang (Kantor Kurir)", x: 300, y: 50, lat: -6.2000, lng: 106.8166 },
  A: { name: "Jl. Merdeka No. 10", x: 100, y: 150, lat: -6.1950, lng: 106.8100 },
  B: { name: "Jl. Sudirman No. 25", x: 520, y: 130, lat: -6.2100, lng: 106.8230 },
  C: { name: "Jl. Ahmad Yani No. 8", x: 150, y: 280, lat: -6.2200, lng: 106.8050 },
  D: { name: "Jl. Gatot Subroto No. 15", x: 480, y: 260, lat: -6.2150, lng: 106.8280 },
  E: { name: "Jl. Diponegoro No. 33", x: 80, y: 400, lat: -6.2350, lng: 106.7980 },
  F: { name: "Jl. Kartini No. 12", x: 300, y: 350, lat: -6.2300, lng: 106.8150 },
  G: { name: "Jl. Pahlawan No. 7", x: 550, y: 380, lat: -6.2250, lng: 106.8350 },
  H: { name: "Jl. Veteran No. 20", x: 180, y: 460, lat: -6.2450, lng: 106.8080 },
  I: { name: "Jl. Pemuda No. 5", x: 430, y: 460, lat: -6.2400, lng: 106.8300 }
};

const originalGraph = {
  Gudang: { A: 3.2, B: 4.1, C: 5.5, D: 6.0 },
  A: { Gudang: 3.2, C: 2.8, E: 4.5, B: 5.0 },
  B: { Gudang: 4.1, D: 3.0, A: 5.0, G: 5.5 },
  C: { A: 2.8, Gudang: 5.5, E: 2.2, F: 3.5, D: 4.8 },
  D: { Gudang: 6.0, B: 3.0, F: 3.2, G: 2.8, C: 4.8 },
  E: { A: 4.5, C: 2.2, H: 2.0, F: 4.0 },
  F: { C: 3.5, D: 3.2, E: 4.0, H: 2.5, I: 3.0, G: 4.2 },
  G: { B: 5.5, D: 2.8, F: 4.2, I: 2.5 },
  H: { E: 2.0, F: 2.5, I: 4.0 },
  I: { F: 3.0, G: 2.5, H: 4.0 }
};

let graph = JSON.parse(JSON.stringify(originalGraph));

// STATE
let selectedDestinations = [];
let packages = [];
let deliveryHistory = [];
let blockedRoads = [];
let trafficRoads = [];
let stats = { totalKm: 0, delivered: 0, trips: 0, date: "" };
let settings = { name: "Kurir", vehicle: "motorcycle", capacity: 50, speed: 30, fuel: 35, stopTime: 5, theme: "dark", accent: "#00d4ff" };
let lastResult = null;
let leafletMap = null;
let mapMarkers = [];
let mapRouteLayer = null;
let activities = [];

// ============================================
// INIT
// ============================================
function init() {
  loadAll();
  populateSelects();
  drawGraph();
  generateDistanceTable();
  renderPackages();
  updateAllDashboards();
  renderHistory();
  renderActivities();
  updateSettingsUI();
  updateDataInfo();

  document.getElementById("sidebarCourierName").textContent = settings.name;
}

function loadAll() {
  const s = localStorage.getItem("ks_settings");
  if (s) settings = { ...settings, ...JSON.parse(s) };

  if (settings.theme === "light") { document.body.classList.add("light-mode"); document.getElementById("themeIcon").className = "fas fa-sun"; }
  document.documentElement.style.setProperty("--accent", settings.accent);

  const p = localStorage.getItem("ks_packages");
  if (p) packages = JSON.parse(p);

  const h = localStorage.getItem("ks_history");
  if (h) deliveryHistory = JSON.parse(h);

  const st = localStorage.getItem("ks_stats");
  if (st) {
    const parsed = JSON.parse(st);
    if (parsed.date === new Date().toDateString()) stats = parsed;
    else stats = { totalKm: 0, delivered: 0, trips: 0, date: new Date().toDateString() };
  }

  const a = localStorage.getItem("ks_activities");
  if (a) activities = JSON.parse(a);
}

function saveAll() {
  localStorage.setItem("ks_settings", JSON.stringify(settings));
  localStorage.setItem("ks_packages", JSON.stringify(packages));
  localStorage.setItem("ks_history", JSON.stringify(deliveryHistory));
  localStorage.setItem("ks_stats", JSON.stringify(stats));
  localStorage.setItem("ks_activities", JSON.stringify(activities));
}

function populateSelects() {
  const ids = ["startLocation", "addDestination", "roadFrom", "roadTo", "pkgDestination"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = el.options[0]?.textContent || "";
    el.innerHTML = `<option value="">${first}</option>`;
    for (let key in locations) {
      el.innerHTML += `<option value="${key}">${key} - ${locations[key].name}</option>`;
    }
  });
}

// ============================================
// NAVIGATION
// ============================================
function navigateTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));

  document.getElementById("page-" + page).classList.add("active");
  document.querySelector(`[data-page="${page}"]`).classList.add("active");

  const names = { home: "Beranda", dashboard: "Dashboard", route: "Cari Rute", packages: "Paket", map: "Peta", history: "Riwayat", settings: "Pengaturan" };
  document.getElementById("breadcrumb").textContent = names[page] || page;

  if (page === "map") { setTimeout(() => { if (!leafletMap) initMap(); else leafletMap.invalidateSize(); }, 200); }
  if (page === "dashboard") { updateAllDashboards(); drawWeeklyChart(); }
  if (page === "packages") { renderPackages(); }
  if (page === "history") { renderHistory(); }
  if (page === "settings") { updateSettingsUI(); updateDataInfo(); }
  if (page === "home") { updateHomeStats(); }

  // Close sidebar on mobile
  if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (window.innerWidth <= 768) { sb.classList.toggle("open"); }
  else { sb.classList.toggle("collapsed"); }
}

// ============================================
// THEME
// ============================================
function toggleTheme() {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  document.getElementById("themeIcon").className = isLight ? "fas fa-sun" : "fas fa-moon";
  settings.theme = isLight ? "light" : "dark";
  saveAll();
  drawGraph();
}

function applyThemeSetting() {
  const val = document.getElementById("settingTheme").value;
  if (val === "light") document.body.classList.add("light-mode");
  else document.body.classList.remove("light-mode");
  document.getElementById("themeIcon").className = val === "light" ? "fas fa-sun" : "fas fa-moon";
  settings.theme = val;
}

function applyAccentColor() {
  const val = document.getElementById("settingAccent").value;
  document.documentElement.style.setProperty("--accent", val);
  settings.accent = val;
}

// ============================================
// DESTINATIONS
// ============================================
function addDestination() {
  const val = document.getElementById("addDestination").value;
  if (!val) return;
  if (val === document.getElementById("startLocation").value) { showNotification("Tidak boleh sama dengan lokasi awal!", "warning"); return; }
  if (selectedDestinations.includes(val)) { showNotification("Sudah ditambahkan!", "warning"); return; }
  selectedDestinations.push(val);
  renderDestinations();
  document.getElementById("addDestination").value = "";
  drawGraph();
  updateMapMarkers();
}

function removeDestination(val) {
  selectedDestinations = selectedDestinations.filter(d => d !== val);
  renderDestinations(); drawGraph(); updateMapMarkers();
}

function renderDestinations() {
  const c = document.getElementById("destinationList");
  c.innerHTML = selectedDestinations.map(d => `
    <div class="destination-tag">
      <i class="fas fa-box"></i> ${d} - ${locations[d].name}
      <span class="remove-btn" onclick="removeDestination('${d}')"><i class="fas fa-times"></i></span>
    </div>
  `).join("");
}

// ============================================
// ALGORITHMS
// ============================================
function dijkstra(g, start, end) {
  const dist = {}, prev = {}, unvisited = new Set(Object.keys(g));
  for (let n in g) { dist[n] = Infinity; prev[n] = null; }
  dist[start] = 0;
  const steps = [];

  while (unvisited.size > 0) {
    let cur = null;
    for (let n of unvisited) if (cur === null || dist[n] < dist[cur]) cur = n;
    if (cur === end || dist[cur] === Infinity) break;
    unvisited.delete(cur);
    steps.push(`Kunjungi ${cur} (${dist[cur].toFixed(2)} km)`);
    for (let nb in g[cur]) {
      if (!unvisited.has(nb)) continue;
      const nd = dist[cur] + g[cur][nb];
      if (nd < dist[nb]) { dist[nb] = nd; prev[nb] = cur; steps.push(`  → Update ${nb}: ${nd.toFixed(2)} km`); }
    }
  }

  const path = []; let c = end;
  while (c) { path.unshift(c); c = prev[c]; }
  if (path[0] !== start) return { path: [], distance: Infinity, steps: ["Tidak ada jalur!"] };
  return { path, distance: dist[end], steps };
}

function greedyTSP(g, start, dests) {
  let cur = start, route = [start], total = 0, rem = [...dests], segs = [], steps = [];
  steps.push(`Mulai: ${cur}`); steps.push(`Tujuan: ${rem.join(", ")}`); steps.push("---");

  while (rem.length > 0) {
    let nearest = null, nd = Infinity, np = [];
    for (let d of rem) { const r = dijkstra(g, cur, d); if (r.distance < nd) { nd = r.distance; nearest = d; np = r.path; } }
    if (!nearest || nd === Infinity) { steps.push("⚠️ Sisa tujuan tidak terjangkau"); break; }
    steps.push(`${cur} → ${nearest} (${nd.toFixed(2)} km)`); steps.push("---");
    route.push(nearest); total += nd; segs.push(np);
    cur = nearest; rem = rem.filter(x => x !== nearest);
  }

  let full = segs.length > 0 ? [segs[0][0]] : [start];
  for (let s of segs) for (let i = 1; i < s.length; i++) full.push(s[i]);
  return { route, totalDistance: total, fullPath: full, segmentPaths: segs, steps };
}

function bruteForceTSP(g, start, dests) {
  if (dests.length > 8) return { route: [], totalDistance: Infinity, fullPath: [], steps: ["Maks 8 tujuan"] };
  const perms = getPermutations(dests);
  let best = null, bestDist = Infinity, bestSegs = [];

  for (let p of perms) {
    let total = 0, cur = start, segs = [], valid = true;
    for (let d of p) { const r = dijkstra(g, cur, d); if (r.distance === Infinity) { valid = false; break; } total += r.distance; segs.push(r.path); cur = d; }
    if (valid && total < bestDist) { bestDist = total; best = [start, ...p]; bestSegs = segs; }
  }

  let full = bestSegs.length > 0 ? [bestSegs[0][0]] : [start];
  for (let s of bestSegs) for (let i = 1; i < s.length; i++) full.push(s[i]);
  return { route: best || [start], totalDistance: bestDist, fullPath: full, steps: [`Diuji ${perms.length} kombinasi`, `Optimal: ${(best || []).join(" → ")} (${bestDist.toFixed(2)} km)`] };
}

function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  let r = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (let p of getPermutations(rest)) r.push([arr[i], ...p]);
  }
  return r;
}

// ============================================
// FIND ROUTE
// ============================================
function findRoute() {
  const start = document.getElementById("startLocation").value;
  if (!start) { showNotification("Pilih lokasi awal!", "warning"); return; }
  if (selectedDestinations.length === 0) { showNotification("Tambahkan tujuan!", "warning"); return; }

  const sorted = sortByPriority(selectedDestinations);
  let result;

  if (sorted.length === 1) {
    const r = dijkstra(graph, start, sorted[0]);
    result = { route: [start, sorted[0]], totalDistance: r.distance, fullPath: r.path, steps: r.steps };
  } else {
    result = greedyTSP(graph, start, sorted);
  }

  lastResult = result;
  displayResult(result);
  displaySteps(result.steps);
  drawGraph(result.fullPath);
  drawRouteOnMap(result.fullPath);

  stats.totalKm += result.totalDistance;
  stats.trips++;
  stats.date = new Date().toDateString();
  addActivity(`Rute ditemukan: ${result.route.join(" → ")} (${result.totalDistance.toFixed(2)} km)`);
  saveToHistory(result);

  result.route.forEach(r => {
    if (r !== start) { const pkg = packages.find(p => p.destination === r && p.status === "pending"); if (pkg) pkg.status = "delivering"; }
  });

  saveAll();
  updateAllDashboards();
  showNotification("Rute terpendek ditemukan!", "success");
}

function compareAlgorithms() {
  const start = document.getElementById("startLocation").value;
  if (!start || selectedDestinations.length === 0) { showNotification("Pilih lokasi dan tujuan!", "warning"); return; }

  const sorted = sortByPriority(selectedDestinations);
  const t1 = performance.now();
  const greedy = sorted.length === 1 ? (() => { const r = dijkstra(graph, start, sorted[0]); return { route: [start, sorted[0]], totalDistance: r.distance, fullPath: r.path }; })() : greedyTSP(graph, start, sorted);
  const t1e = performance.now();

  const t2 = performance.now();
  const brute = sorted.length === 1 ? greedy : bruteForceTSP(graph, start, sorted);
  const t2e = performance.now();

  displayComparison(greedy, brute, t1e - t1, t2e - t2);
  showNotification("Perbandingan selesai!", "info");
}

function sortByPriority(dests) {
  const order = { urgent: 0, normal: 1, low: 2 };
  return [...dests].sort((a, b) => {
    const pa = packages.find(p => p.destination === a);
    const pb = packages.find(p => p.destination === b);
    return (order[pa?.priority] ?? 1) - (order[pb?.priority] ?? 1);
  });
}

// ============================================
// DISPLAY RESULTS
// ============================================
function displayResult(result) {
  const box = document.getElementById("result");
  const content = document.getElementById("resultContent");
  const time = (result.totalDistance / settings.speed) * 60 + (result.route.length - 1) * settings.stopTime;
  const fuel = result.totalDistance / settings.fuel;

  let routeHTML = result.route.map((r, i) => i === 0 ? `<span style="color:var(--success)">${r}</span>` : `<span style="color:var(--danger)">${r}</span>`).join(' → ');

  content.innerHTML = `
    <div class="result-route">${routeHTML}</div>
    <p style="text-align:center;color:var(--text-muted);font-size:0.78rem;margin-bottom:10px;">Jalur: ${result.fullPath.join(" → ")}</p>
    <div class="result-info">
      <div class="info-card"><div class="label">Jarak</div><div class="value">${result.totalDistance === Infinity ? "∞" : result.totalDistance.toFixed(2) + " km"}</div></div>
      <div class="info-card"><div class="label">Waktu</div><div class="value">${Math.round(time)} mnt</div></div>
      <div class="info-card"><div class="label">Tujuan</div><div class="value">${selectedDestinations.length}</div></div>
      <div class="info-card"><div class="label">BBM</div><div class="value">${fuel.toFixed(2)} L</div></div>
    </div>`;
  box.classList.remove("hidden");
}

function displaySteps(steps) {
  const box = document.getElementById("steps");
  document.getElementById("stepsContent").innerHTML = steps.map((s, i) => s === "---" ? '<hr style="border-color:var(--border);margin:4px 0;">' : `<div class="step-item"><span class="step-number">${i + 1}.</span>${s}</div>`).join("");
  box.classList.remove("hidden");
}

function displayComparison(greedy, brute, gt, bt) {
  const box = document.getElementById("comparisonResult");
  const better = brute.totalDistance < greedy.totalDistance;
  document.getElementById("comparisonContent").innerHTML = `
    <table class="comparison-table">
      <tr><th>Parameter</th><th>Greedy</th><th>Brute Force</th></tr>
      <tr><td>Rute</td><td>${greedy.route.join("→")}</td><td class="${better ? 'best' : ''}">${brute.route.join("→")}</td></tr>
      <tr><td>Jarak</td><td>${greedy.totalDistance.toFixed(2)} km</td><td class="${better ? 'best' : ''}">${brute.totalDistance.toFixed(2)} km</td></tr>
      <tr><td>Komputasi</td><td class="${gt < bt ? 'best' : ''}">${gt.toFixed(2)} ms</td><td>${bt.toFixed(2)} ms</td></tr>
      <tr><td>Penghematan</td><td colspan="2" style="color:var(--success)">${better ? (greedy.totalDistance - brute.totalDistance).toFixed(2) + " km lebih hemat" : "Greedy sudah optimal"}</td></tr>
    </table>`;
  box.classList.remove("hidden");
}

// ============================================
// ROAD CONDITIONS
// ============================================
function blockRoad() {
  const from = document.getElementById("roadFrom").value, to = document.getElementById("roadTo").value;
  if (!from || !to || from === to) { showNotification("Pilih lokasi yang valid!", "warning"); return; }
  if (!graph[from]?.[to]) { showNotification("Jalan tidak ada!", "warning"); return; }
  blockedRoads.push({ from, to, weight: graph[from][to] });
  delete graph[from][to]; delete graph[to][from];
  renderBlockedRoads(); drawGraph(); generateDistanceTable();
  addActivity(`Jalan ${from} ↔ ${to} ditutup`);
  showNotification(`Jalan ${from} ↔ ${to} ditutup!`, "danger");
}

function addTraffic() {
  const from = document.getElementById("roadFrom").value, to = document.getElementById("roadTo").value;
  if (!from || !to || !graph[from]?.[to]) { showNotification("Jalan tidak valid!", "warning"); return; }
  graph[from][to] *= 2.5; graph[to][from] *= 2.5;
  trafficRoads.push({ from, to });
  renderBlockedRoads(); drawGraph(); generateDistanceTable();
  showNotification(`Jalan ${from} ↔ ${to} macet!`, "warning");
}

function resetRoads() {
  graph = JSON.parse(JSON.stringify(originalGraph));
  blockedRoads = []; trafficRoads = [];
  renderBlockedRoads(); drawGraph(); generateDistanceTable();
  showNotification("Jalan direset!", "success");
}

function renderBlockedRoads() {
  const c = document.getElementById("blockedRoadsList");
  c.innerHTML = blockedRoads.map(r => `<div class="blocked-road-item"><i class="fas fa-ban"></i> ${r.from} ↔ ${r.to}</div>`).join("")
    + trafficRoads.map(r => `<div class="blocked-road-item traffic-road-item"><i class="fas fa-car"></i> ${r.from} ↔ ${r.to} (Macet)</div>`).join("");
}

// ============================================
// PACKAGES
// ============================================
function showAddPackageModal() {
  document.getElementById("pkgId").value = "PKT" + String(packages.length + 1).padStart(3, "0");
  document.getElementById("pkgRecipient").value = "";
  document.getElementById("pkgWeight").value = "";
  document.getElementById("pkgDestination").value = "";
  document.getElementById("packageModal").classList.remove("hidden");
}

function closeModal() { document.getElementById("packageModal").classList.add("hidden"); }

function addPackage() {
  const id = document.getElementById("pkgId").value;
  const recipient = document.getElementById("pkgRecipient").value;
  const dest = document.getElementById("pkgDestination").value;
  const weight = document.getElementById("pkgWeight").value;
  const priority = document.getElementById("pkgPriority").value;
  if (!recipient || !dest || !weight) { showNotification("Lengkapi data!", "warning"); return; }

  packages.push({ id, recipient, destination: dest, weight: parseFloat(weight), priority, status: "pending" });
  saveAll(); renderPackages(); closeModal();
  addActivity(`Paket ${id} ditambahkan untuk ${recipient}`);
  showNotification(`Paket ${id} ditambahkan!`, "success");

  if (!selectedDestinations.includes(dest) && dest !== document.getElementById("startLocation").value) {
    selectedDestinations.push(dest);
    renderDestinations(); drawGraph();
  }
}

function markDelivered(id) {
  const pkg = packages.find(p => p.id === id);
  if (pkg) { pkg.status = "delivered"; stats.delivered++; }
  saveAll(); renderPackages(); updateAllDashboards();
  addActivity(`Paket ${id} terkirim ✓`);
  showNotification(`Paket ${id} terkirim!`, "success");
}

function removePackage(id) {
  packages = packages.filter(p => p.id !== id);
  saveAll(); renderPackages();
}

function renderPackages() {
  const grid = document.getElementById("packageGrid");
  if (!grid) return;

  const search = document.getElementById("packageSearch")?.value?.toLowerCase() || "";
  const statusFilter = document.getElementById("packageFilter")?.value || "all";
  const prioFilter = document.getElementById("priorityFilter")?.value || "all";

  let filtered = packages.filter(p => {
    if (search && !p.recipient.toLowerCase().includes(search) && !p.id.toLowerCase().includes(search)) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (prioFilter !== "all" && p.priority !== prioFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;grid-column:1/-1;">Tidak ada paket ditemukan</p>';
  } else {
    grid.innerHTML = filtered.map(p => `
      <div class="package-card">
        <div class="package-card-header">
          <span class="package-card-id">${p.id}</span>
          <span class="btn btn-small ${p.priority === 'urgent' ? 'btn-danger' : p.priority === 'low' ? 'btn-success' : 'btn-warning'}">${p.priority === 'urgent' ? '🔴' : p.priority === 'low' ? '🟢' : '🟡'} ${p.priority}</span>
        </div>
        <div class="package-card-body">
          <p><strong>${p.recipient}</strong></p>
          <p><i class="fas fa-map-pin"></i> ${p.destination} - ${locations[p.destination]?.name || ""}</p>
          <p><i class="fas fa-weight-hanging"></i> ${p.weight} kg | Status: <strong>${p.status}</strong></p>
        </div>
        <div class="package-card-footer">
          ${p.status !== "delivered" ? `<button class="btn btn-small btn-success" onclick="markDelivered('${p.id}')"><i class="fas fa-check"></i> Terkirim</button>` : ""}
          <button class="btn btn-small btn-danger" onclick="removePackage('${p.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join("");
  }

  // Update stats
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el("pkgTotal", packages.length);
  el("pkgPending", packages.filter(p => p.status === "pending").length);
  el("pkgDelivering", packages.filter(p => p.status === "delivering").length);
  el("pkgDelivered", packages.filter(p => p.status === "delivered").length);
}

function filterPackages() { renderPackages(); }

// ============================================
// HISTORY
// ============================================
function saveToHistory(result) {
  deliveryHistory.unshift({
    date: new Date().toLocaleString("id-ID"),
    route: result.route,
    distance: result.totalDistance,
    destinations: selectedDestinations.length,
    time: Math.round((result.totalDistance / settings.speed) * 60)
  });
  if (deliveryHistory.length > 50) deliveryHistory = deliveryHistory.slice(0, 50);
  saveAll(); renderHistory();
}

function renderHistory() {
  const c = document.getElementById("historyList");
  if (!c) return;
  const search = document.getElementById("historySearch")?.value?.toLowerCase() || "";
  const filtered = deliveryHistory.filter(h => !search || h.route.join(" ").toLowerCase().includes(search));

  if (filtered.length === 0) {
    c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada riwayat</p>';
  } else {
    c.innerHTML = filtered.map(h => `
      <div class="history-item">
        <div class="history-date"><i class="fas fa-calendar"></i> ${h.date}</div>
        <div class="history-route">${h.route.join(" → ")}</div>
        <div class="history-stats">
          <span><i class="fas fa-road"></i> ${h.distance.toFixed(2)} km</span>
          <span><i class="fas fa-clock"></i> ${h.time} mnt</span>
          <span><i class="fas fa-box"></i> ${h.destinations} paket</span>
        </div>
      </div>
    `).join("");
  }
}

function filterHistory() { renderHistory(); }
function clearHistory() { deliveryHistory = []; saveAll(); renderHistory(); showNotification("Riwayat dihapus!", "info"); }

// ============================================
// DASHBOARD
// ============================================
function updateAllDashboards() {
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  const time = Math.round((stats.totalKm / settings.speed) * 60);
  const fuel = (stats.totalKm / settings.fuel).toFixed(2);
  const pending = packages.filter(p => p.status === "pending").length;
  const urgent = packages.filter(p => p.priority === "urgent" && p.status !== "delivered").length;

  el("dashTotalKm", stats.totalKm.toFixed(1) + " km");
  el("dashDelivered", stats.delivered);
  el("dashTime", time + " mnt");
  el("dashFuel", fuel + " L");
  el("dashTrips", stats.trips);
  el("dashPending", pending);
  el("dashAvgSpeed", settings.speed + " km/jam");
  el("dashEfficiency", stats.trips > 0 ? (stats.totalKm / stats.trips).toFixed(1) + " km/trip" : "-");
  el("dashUrgent", urgent);
  el("dashBlocked", blockedRoads.length);
  el("dashLastUpdate", new Date().toLocaleTimeString("id-ID"));

  updateHomeStats();
}

function updateHomeStats() {
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el("heroTotalDelivery", stats.trips);
  el("heroTotalKm", stats.totalKm.toFixed(1) + " km");
  el("heroTotalPackage", stats.delivered);
}

function drawWeeklyChart() {
  const canvas = document.getElementById("weeklyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const data = [12, 8, 15, 10, 18, 6, stats.totalKm || 5];
  const max = Math.max(...data) + 5;
  const barW = 40, gap = 25, startX = 50, startY = 170;
  const isLight = document.body.classList.contains("light-mode");

  // Y Axis
  ctx.strokeStyle = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";
  for (let i = 0; i <= 4; i++) {
    const y = startY - (i / 4) * 150;
    ctx.beginPath(); ctx.moveTo(startX - 10, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke();
    ctx.fillStyle = isLight ? "#666" : "#888";
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "right";
    ctx.fillText(Math.round((i / 4) * max) + " km", startX - 14, y + 3);
  }

  // Bars
  days.forEach((day, i) => {
    const x = startX + i * (barW + gap);
    const h = (data[i] / max) * 150;
    const gradient = ctx.createLinearGradient(x, startY - h, x, startY);
    gradient.addColorStop(0, settings.accent);
    gradient.addColorStop(1, "rgba(0,212,255,0.3)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, startY - h, barW, h, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = isLight ? "#333" : "#ccc";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(day, x + barW / 2, startY + 16);
    ctx.fillStyle = isLight ? "#333" : "#fff";
    ctx.font = "bold 10px Segoe UI";
    ctx.fillText(data[i].toFixed(0), x + barW / 2, startY - h - 6);
  });
}

// ============================================
// ACTIVITIES
// ============================================
function addActivity(text) {
  activities.unshift({ text, time: new Date().toLocaleTimeString("id-ID") });
  if (activities.length > 20) activities = activities.slice(0, 20);
  saveAll(); renderActivities();
}

function renderActivities() {
  const c = document.getElementById("recentActivity");
  if (!c) return;
  if (activities.length === 0) { c.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;padding:10px;">Belum ada aktivitas</p>'; return; }
  c.innerHTML = activities.slice(0, 10).map(a => `
    <div class="activity-item"><i class="fas fa-circle" style="font-size:0.5rem;"></i> ${a.text} <span class="activity-time">${a.time}</span></div>
  `).join("");
}

// ============================================
// GRAPH VISUALIZATION
// ============================================
function drawGraph(highlightPath = []) {
  const canvas = document.getElementById("graphCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const start = document.getElementById("startLocation")?.value;
  const isLight = document.body.classList.contains("light-mode");

  for (let n in graph) for (let nb in graph[n]) drawEdge(ctx, n, nb, graph[n][nb], false, isLight);
  for (let r of blockedRoads) drawBlockedEdge(ctx, r.from, r.to);
  if (highlightPath.length > 1) for (let i = 0; i < highlightPath.length - 1; i++) drawEdge(ctx, highlightPath[i], highlightPath[i + 1], null, true, isLight);
  for (let k in locations) drawNode(ctx, k, k === start ? "start" : selectedDestinations.includes(k) ? "dest" : "normal", isLight);
}

function drawEdge(ctx, from, to, w, hl, isLight) {
  const f = locations[from], t = locations[to];
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y);
  if (hl) { ctx.strokeStyle = settings.accent; ctx.lineWidth = 4; ctx.shadowColor = settings.accent; ctx.shadowBlur = 8; }
  else { ctx.strokeStyle = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.shadowBlur = 0; }
  ctx.stroke(); ctx.shadowBlur = 0;
  if (w && !hl) { ctx.fillStyle = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"; ctx.font = "9px Segoe UI"; ctx.textAlign = "center"; ctx.fillText(w.toFixed(1), (f.x + t.x) / 2, (f.y + t.y) / 2 - 4); }
}

function drawBlockedEdge(ctx, from, to) {
  const f = locations[from], t = locations[to];
  ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y);
  ctx.strokeStyle = "rgba(255,71,87,0.5)"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#ff4757"; ctx.font = "bold 11px Segoe UI"; ctx.textAlign = "center";
  ctx.fillText("✕", (f.x + t.x) / 2, (f.y + t.y) / 2);
}

function drawNode(ctx, key, type, isLight) {
  const p = locations[key];
  let r = 15, color = isLight ? "#999" : "#555";
  if (type === "start") { color = "#00ff88"; r = 19; }
  if (type === "dest") { color = "#ff4757"; r = 17; }

  if (type !== "normal") { ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2); ctx.fillStyle = type === "start" ? "rgba(0,255,136,0.1)" : "rgba(255,71,87,0.1)"; ctx.fill(); }
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px Segoe UI"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(key, p.x, p.y);
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)"; ctx.font = "8px Segoe UI"; ctx.fillText(locations[key].name.substring(0, 14), p.x, p.y + r + 10);
}

function generateDistanceTable() {
  const c = document.getElementById("distanceTable");
  if (!c) return;
  const nodes = Object.keys(locations);
  let h = '<table><tr><th></th>' + nodes.map(n => `<th>${n}</th>`).join("") + '</tr>';
  nodes.forEach(from => {
    h += `<tr><th>${from}</th>`;
    nodes.forEach(to => {
      if (from === to) h += '<td>-</td>';
      else if (graph[from]?.[to]) h += `<td>${graph[from][to].toFixed(1)}</td>`;
      else if (blockedRoads.some(r => (r.from === from && r.to === to) || (r.from === to && r.to === from))) h += '<td class="blocked-cell">✕</td>';
      else h += '<td style="color:var(--text-muted)">∞</td>';
    });
    h += '</tr>';
  });
  c.innerHTML = h + '</table>';
}

function switchVisualTab(tab) {
  document.querySelectorAll(".vtab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".vtab-content").forEach(t => t.classList.remove("active"));
  event.currentTarget.classList.add("active");
  document.getElementById("vtab-" + tab).classList.add("active");
}

// ============================================
// MAP
// ============================================
function initMap() {
  if (leafletMap) return;
  const mc = document.getElementById("mapContainer");
  if (!mc || mc.offsetHeight === 0) return;
  leafletMap = L.map("mapContainer").setView([-6.22, 106.815], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(leafletMap);
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!leafletMap) return;
  mapMarkers.forEach(m => leafletMap.removeLayer(m)); mapMarkers = [];
  const start = document.getElementById("startLocation")?.value;
  for (let k in locations) {
    const loc = locations[k];
    const color = k === start ? "#00ff88" : selectedDestinations.includes(k) ? "#ff4757" : "#888";
    const icon = L.divIcon({ className: "", html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${k}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
    mapMarkers.push(L.marker([loc.lat, loc.lng], { icon }).addTo(leafletMap).bindPopup(`<b>${k}</b><br>${loc.name}`));
  }
}

function drawRouteOnMap(path) {
  if (!leafletMap) return;
  if (mapRouteLayer) leafletMap.removeLayer(mapRouteLayer);
  if (path.length < 2) return;
  const coords = path.map(k => [locations[k].lat, locations[k].lng]);
  mapRouteLayer = L.polyline(coords, { color: settings.accent, weight: 4, dashArray: "8,4" }).addTo(leafletMap);
  leafletMap.fitBounds(mapRouteLayer.getBounds(), { padding: [30, 30] });
}

// ============================================
// SETTINGS
// ============================================
function updateSettingsUI() {
  document.getElementById("settingName").value = settings.name;
  document.getElementById("settingVehicle").value = settings.vehicle;
  document.getElementById("settingCapacity").value = settings.capacity;
  document.getElementById("settingSpeed").value = settings.speed;
  document.getElementById("settingFuel").value = settings.fuel;
  document.getElementById("settingStopTime").value = settings.stopTime;
  document.getElementById("settingTheme").value = settings.theme;
  document.getElementById("settingAccent").value = settings.accent;
}

function saveSettings() {
  settings.name = document.getElementById("settingName").value || "Kurir";
  settings.vehicle = document.getElementById("settingVehicle").value;
  settings.capacity = parseInt(document.getElementById("settingCapacity").value) || 50;
  settings.speed = parseInt(document.getElementById("settingSpeed").value) || 30;
  settings.fuel = parseInt(document.getElementById("settingFuel").value) || 35;
  settings.stopTime = parseInt(document.getElementById("settingStopTime").value) || 5;
  document.getElementById("sidebarCourierName").textContent = settings.name;
  saveAll();
  showNotification("Pengaturan disimpan!", "success");
}

function updateDataInfo() {
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el("dataPackageCount", packages.length);
  el("dataHistoryCount", deliveryHistory.length);
  let size = 0;
  for (let k in localStorage) if (k.startsWith("ks_")) size += localStorage[k].length;
  el("dataStorage", (size / 1024).toFixed(1) + " KB");
}

function exportAllData() {
  const data = { settings, packages, history: deliveryHistory, stats };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kurir-data-backup.json"; a.click();
  showNotification("Data di-export!", "success");
}

function clearAllData() {
  if (!confirm("Hapus semua data? Tidak bisa dikembalikan!")) return;
  localStorage.clear(); packages = []; deliveryHistory = []; activities = [];
  stats = { totalKm: 0, delivered: 0, trips: 0, date: "" };
  saveAll(); renderPackages(); renderHistory(); renderActivities(); updateAllDashboards();
  showNotification("Semua data dihapus!", "danger");
}

// ============================================
// EXPORT & PRINT
// ============================================
function exportRoute() {
  if (!lastResult) { showNotification("Cari rute dulu!", "warning"); return; }
  let txt = `=== RUTE PENGIRIMAN ===\nTanggal: ${new Date().toLocaleString("id-ID")}\nKurir: ${settings.name}\nRute: ${lastResult.route.join(" → ")}\nJarak: ${lastResult.totalDistance.toFixed(2)} km\nWaktu: ${Math.round((lastResult.totalDistance / settings.speed) * 60)} menit\n`;
  const blob = new Blob([txt], { type: "text/plain" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rute-kurir.txt"; a.click();
  showNotification("Rute di-export!", "success");
}

function printRoute() { window.print(); }

// ============================================
// NOTIFICATION
// ============================================
function showNotification(msg, type = "info") {
  const n = document.getElementById("notification");
  document.getElementById("notificationText").textContent = msg;
  const icon = document.getElementById("notifIcon");
  icon.className = type === "success" ? "fas fa-check-circle" : type === "warning" ? "fas fa-exclamation-circle" : type === "danger" ? "fas fa-times-circle" : "fas fa-info-circle";
  n.querySelector(".notification-content").style.borderColor = type === "success" ? "var(--success)" : type === "danger" ? "var(--danger)" : type === "warning" ? "var(--warning)" : "var(--accent)";
  n.classList.remove("hidden");
  setTimeout(() => n.classList.add("hidden"), 3000);
}

// ============================================
// RESET
// ============================================
function resetAll() {
  selectedDestinations = []; lastResult = null;
  document.getElementById("startLocation").value = "";
  document.getElementById("result").classList.add("hidden");
  document.getElementById("steps").classList.add("hidden");
  document.getElementById("comparisonResult").classList.add("hidden");
  renderDestinations(); drawGraph();
  if (mapRouteLayer && leafletMap) { leafletMap.removeLayer(mapRouteLayer); mapRouteLayer = null; }
  updateMapMarkers();
  showNotification("Reset berhasil!", "info");
}

// ============================================
// START
// ============================================
window.onload = init;
// ============================================
// ============================================
//    FITUR BARU: ACO, TRACKING, QR, GPS
// ============================================
// ============================================

// ============================================
// 1. ANT COLONY OPTIMIZATION (ACO)
// ============================================

const acoParams = {
  antCount: 20,
  iterations: 100,
  alpha: 1.0,       // pengaruh pheromone
  beta: 3.0,        // pengaruh jarak (heuristik)
  evaporation: 0.5, // tingkat penguapan
  Q: 100,           // konstanta deposit pheromone
  elitistWeight: 2  // bobot semut terbaik
};

function runACO() {
  const start = document.getElementById("startLocation").value;
  if (!start) { showNotification("Pilih lokasi awal!", "warning"); return; }
  if (selectedDestinations.length === 0) { showNotification("Tambahkan tujuan!", "warning"); return; }
  if (selectedDestinations.length > 10) { showNotification("Maks 10 tujuan untuk ACO!", "warning"); return; }

  showNotification("🐜 Menjalankan Ant Colony Optimization...", "info");

  const sorted = sortByPriority(selectedDestinations);

  setTimeout(() => {
    const result = antColonyOptimization(graph, start, sorted);
    displayACOResult(result, start, sorted);
    drawGraph(result.fullPath);
    drawRouteOnMap(result.fullPath);
    addActivity(`ACO: ${result.route.join("→")} (${result.totalDistance.toFixed(2)} km, ${result.iterations} iterasi)`);
    showNotification("🐜 ACO selesai! Rute optimal ditemukan.", "success");
  }, 100);
}

function antColonyOptimization(g, start, destinations) {
  const { antCount, iterations, alpha, beta, evaporation, Q, elitistWeight } = acoParams;
  const allNodes = [start, ...destinations];
  const n = allNodes.length;

  // Pre-compute jarak antar semua node
  const distMatrix = {};
  const pathMatrix = {};
  for (let i of allNodes) {
    distMatrix[i] = {};
    pathMatrix[i] = {};
    for (let j of allNodes) {
      if (i === j) { distMatrix[i][j] = 0; pathMatrix[i][j] = [i]; continue; }
      const result = dijkstra(g, i, j);
      distMatrix[i][j] = result.distance;
      pathMatrix[i][j] = result.path;
    }
  }

  // Inisialisasi pheromone
  let pheromone = {};
  for (let i of allNodes) {
    pheromone[i] = {};
    for (let j of allNodes) {
      pheromone[i][j] = 1.0;
    }
  }

  let globalBestRoute = null;
  let globalBestDist = Infinity;
  let iterationLog = [];

  for (let iter = 0; iter < iterations; iter++) {
    let iterBestRoute = null;
    let iterBestDist = Infinity;
    let allAntRoutes = [];

    // Setiap semut membangun solusi
    for (let ant = 0; ant < antCount; ant++) {
      let current = start;
      let visited = [start];
      let remaining = [...destinations];
      let totalDist = 0;

      while (remaining.length > 0) {
        // Hitung probabilitas untuk setiap tujuan yang tersisa
        let probabilities = [];
        let totalProb = 0;

        for (let next of remaining) {
          const dist = distMatrix[current][next];
          if (dist === Infinity || dist === 0) continue;

          const tau = Math.pow(pheromone[current][next], alpha);
          const eta = Math.pow(1.0 / dist, beta);
          const prob = tau * eta;
          probabilities.push({ node: next, prob, dist });
          totalProb += prob;
        }

        if (probabilities.length === 0) break;

        // Roulette wheel selection
        let chosen = probabilities[0];
        let rand = Math.random() * totalProb;
        for (let p of probabilities) {
          rand -= p.prob;
          if (rand <= 0) { chosen = p; break; }
        }

        visited.push(chosen.node);
        totalDist += chosen.dist;
        current = chosen.node;
        remaining = remaining.filter(r => r !== chosen.node);
      }

      allAntRoutes.push({ route: visited, distance: totalDist });

      if (totalDist < iterBestDist && visited.length === allNodes.length) {
        iterBestDist = totalDist;
        iterBestRoute = visited;
      }
    }

    // Update global best
    if (iterBestDist < globalBestDist) {
      globalBestDist = iterBestDist;
      globalBestRoute = iterBestRoute;
    }

    // Evaporasi pheromone
    for (let i of allNodes) {
      for (let j of allNodes) {
        pheromone[i][j] *= (1 - evaporation);
        if (pheromone[i][j] < 0.01) pheromone[i][j] = 0.01;
      }
    }

    // Deposit pheromone oleh semua semut
    for (let antRoute of allAntRoutes) {
      if (antRoute.distance === 0 || antRoute.distance === Infinity) continue;
      const deposit = Q / antRoute.distance;
      for (let i = 0; i < antRoute.route.length - 1; i++) {
        pheromone[antRoute.route[i]][antRoute.route[i + 1]] += deposit;
        pheromone[antRoute.route[i + 1]][antRoute.route[i]] += deposit;
      }
    }

    // Elitist: semut terbaik global deposit extra pheromone
    if (globalBestRoute) {
      const elitistDeposit = (Q / globalBestDist) * elitistWeight;
      for (let i = 0; i < globalBestRoute.length - 1; i++) {
        pheromone[globalBestRoute[i]][globalBestRoute[i + 1]] += elitistDeposit;
        pheromone[globalBestRoute[i + 1]][globalBestRoute[i]] += elitistDeposit;
      }
    }

    // Log setiap 10 iterasi
    if (iter % 10 === 0 || iter === iterations - 1) {
      iterationLog.push({
        iteration: iter + 1,
        bestDist: globalBestDist,
        iterDist: iterBestDist,
        route: globalBestRoute ? [...globalBestRoute] : []
      });
    }
  }

  // Bangun full path dari rute terbaik
  let fullPath = [];
  if (globalBestRoute) {
    for (let i = 0; i < globalBestRoute.length - 1; i++) {
      const segment = pathMatrix[globalBestRoute[i]][globalBestRoute[i + 1]];
      if (i === 0) fullPath = [...segment];
      else fullPath = [...fullPath, ...segment.slice(1)];
    }
  }

  return {
    route: globalBestRoute || [start],
    totalDistance: globalBestDist,
    fullPath: fullPath.length > 0 ? fullPath : [start],
    iterations,
    antCount,
    log: iterationLog,
    pheromone
  };
}

function displayACOResult(result, start, destinations) {
  const box = document.getElementById("acoResult");
  const content = document.getElementById("acoContent");

  // Bandingkan dengan Greedy
  const greedyResult = destinations.length === 1
    ? (() => { const r = dijkstra(graph, start, destinations[0]); return { totalDistance: r.distance, route: [start, destinations[0]] }; })()
    : greedyTSP(graph, start, destinations);

  const improvement = greedyResult.totalDistance - result.totalDistance;
  const improvementPct = (improvement / greedyResult.totalDistance * 100).toFixed(1);

  content.innerHTML = `
    <div class="aco-params">
      <div class="aco-param">
        <div class="aco-param-label">Semut</div>
        <div class="aco-param-value">${result.antCount}</div>
      </div>
      <div class="aco-param">
        <div class="aco-param-label">Iterasi</div>
        <div class="aco-param-value">${result.iterations}</div>
      </div>
      <div class="aco-param">
        <div class="aco-param-label">Alpha (τ)</div>
        <div class="aco-param-value">${acoParams.alpha}</div>
      </div>
      <div class="aco-param">
        <div class="aco-param-label">Beta (η)</div>
        <div class="aco-param-value">${acoParams.beta}</div>
      </div>
      <div class="aco-param">
        <div class="aco-param-label">Evaporasi</div>
        <div class="aco-param-value">${acoParams.evaporation}</div>
      </div>
      <div class="aco-param">
        <div class="aco-param-label">Q</div>
        <div class="aco-param-value">${acoParams.Q}</div>
      </div>
    </div>

    <div class="result-route" style="border-color:rgba(243,156,18,0.3);background:rgba(243,156,18,0.05);">
      🐜 ${result.route.join(' → ')}
    </div>

    <div class="result-info">
      <div class="info-card">
        <div class="label">Jarak ACO</div>
        <div class="value" style="color:#f39c12;">${result.totalDistance.toFixed(2)} km</div>
      </div>
      <div class="info-card">
        <div class="label">Jarak Greedy</div>
        <div class="value">${greedyResult.totalDistance.toFixed(2)} km</div>
      </div>
      <div class="info-card">
        <div class="label">Penghematan</div>
        <div class="value" style="color:var(--success);">${improvement > 0 ? improvement.toFixed(2) + " km" : "0 km"}</div>
      </div>
      <div class="info-card">
        <div class="label">Peningkatan</div>
        <div class="value" style="color:var(--success);">${improvement > 0 ? improvementPct + "%" : "Sama"}</div>
      </div>
    </div>

    <div class="aco-iteration-log">
      <strong style="color:var(--text-primary);font-size:0.82rem;">Log Konvergensi:</strong>
      ${result.log.map(l => `
        <div class="aco-iteration">
          Iterasi ${l.iteration}: Best = <span class="${l.iteration === result.iterations ? 'best' : ''}">${l.bestDist.toFixed(2)} km</span>
          ${l.route.length > 0 ? `(${l.route.join("→")})` : ""}
        </div>
      `).join("")}
    </div>
  `;

  box.classList.remove("hidden");
}

// ============================================
// 2. REAL-TIME TRACKING & SIMULATION
// ============================================

let trackingMap = null;
let trackingMarkers = [];
let trackingCourierMarker = null;
let trackingRouteLine = null;
let trackingInterval = null;
let trackingIndex = 0;
let trackingStartTime = null;
let trackingFullPath = [];
let trackingVisited = [];
let gpsWatchId = null;
let currentGPSPosition = null;

function initTrackingMap() {
  if (trackingMap) return;
  const container = document.getElementById("trackingMapContainer");
  if (!container || container.offsetHeight === 0) return;

  trackingMap = L.map("trackingMapContainer").setView([-6.22, 106.815], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(trackingMap);

  // Tambah marker semua lokasi
  for (let key in locations) {
    const loc = locations[key];
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#888;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:bold;border:2px solid #fff;">${key}</div>`,
      iconSize: [20, 20], iconAnchor: [10, 10]
    });
    L.marker([loc.lat, loc.lng], { icon }).addTo(trackingMap).bindPopup(`<b>${key}</b><br>${loc.name}`);
  }
}

// GPS Tracking menggunakan HTML5 Geolocation
function startGPSTracking() {
  if (!navigator.geolocation) {
    showNotification("GPS tidak didukung oleh browser ini!", "danger");
    return;
  }

  const indicator = document.getElementById("gpsIndicator");
  const status = document.getElementById("gpsStatus");

  // Geolocation API dapat melacak posisi GPS perangkat secara real-time
  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      currentGPSPosition = { lat, lng, accuracy };

      // Update UI
      indicator.classList.add("active");
      status.textContent = "Aktif";
      status.style.color = "var(--success)";
      document.getElementById("gpsLat").textContent = lat.toFixed(6);
      document.getElementById("gpsLng").textContent = lng.toFixed(6);
      document.getElementById("gpsAccuracy").textContent = accuracy.toFixed(0) + " m";

      // Update marker di peta tracking
      if (trackingMap) {
        if (trackingCourierMarker) {
          trackingCourierMarker.setLatLng([lat, lng]);
        } else {
          const courierIcon = L.divIcon({
            className: "courier-marker",
            html: `<div style="background:#00ff88;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#000;font-size:12px;border:3px solid #fff;box-shadow:0 0 15px rgba(0,255,136,0.6);"><i class="fas fa-motorcycle"></i></div>`,
            iconSize: [28, 28], iconAnchor: [14, 14]
          });
          trackingCourierMarker = L.marker([lat, lng], { icon: courierIcon }).addTo(trackingMap);
        }
        trackingMap.setView([lat, lng], 15);
      }

      showNotification(`📍 GPS aktif: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, "success");
    },
    (error) => {
      indicator.classList.remove("active");
      status.textContent = "Error: " + error.message;
      status.style.color = "var(--danger)";
      showNotification("GPS Error: " + error.message, "danger");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function stopGPSTracking() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  document.getElementById("gpsIndicator").classList.remove("active");
  document.getElementById("gpsStatus").textContent = "Tidak Aktif";
  document.getElementById("gpsStatus").style.color = "";
}

// Simulasi Pengiriman Real-time
function startSimulation() {
  if (!lastResult || !lastResult.fullPath || lastResult.fullPath.length < 2) {
    showNotification("Cari rute terlebih dahulu di halaman Cari Rute!", "warning");
    return;
  }

  // Init tracking map
  if (!trackingMap) initTrackingMap();
  setTimeout(() => { if (trackingMap) trackingMap.invalidateSize(); }, 200);

  trackingFullPath = lastResult.fullPath;
  trackingIndex = 0;
  trackingVisited = [];
  trackingStartTime = Date.now();

  // Gambar rute di peta
  const coords = trackingFullPath.map(k => [locations[k].lat, locations[k].lng]);
  if (trackingRouteLine) trackingMap.removeLayer(trackingRouteLine);
  trackingRouteLine = L.polyline(coords, { color: settings.accent, weight: 3, dashArray: "8,4", opacity: 0.6 }).addTo(trackingMap);

  // Buat courier marker
  const startLoc = locations[trackingFullPath[0]];
  const courierIcon = L.divIcon({
    className: "courier-marker",
    html: `<div style="background:#00ff88;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#000;font-size:14px;border:3px solid #fff;box-shadow:0 0 20px rgba(0,255,136,0.7);"><i class="fas fa-motorcycle"></i></div>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
  });

  if (trackingCourierMarker) trackingMap.removeLayer(trackingCourierMarker);
  trackingCourierMarker = L.marker([startLoc.lat, startLoc.lng], { icon: courierIcon }).addTo(trackingMap).bindPopup("🏍️ Kurir");

  trackingMap.setView([startLoc.lat, startLoc.lng], 14);

  // Update UI
  document.getElementById("btnStartSim").style.display = "none";
  document.getElementById("btnStopSim").style.display = "block";

  renderTrackingProgress();
  speakDirection(`Simulasi pengiriman dimulai dari ${locations[trackingFullPath[0]].name}`);

  // Mulai interval simulasi
  trackingInterval = setInterval(() => {
    trackingIndex++;

    if (trackingIndex >= trackingFullPath.length) {
      stopSimulation();
      showNotification("✅ Semua paket berhasil dikirim!", "success");
      speakDirection("Semua paket telah terkirim. Pengiriman selesai.");
      return;
    }

    const currentNode = trackingFullPath[trackingIndex];
    const loc = locations[currentNode];

    // Gerakkan marker kurir
    trackingCourierMarker.setLatLng([loc.lat, loc.lng]);
    trackingMap.panTo([loc.lat, loc.lng]);

    // Cek apakah ini node tujuan
    if (selectedDestinations.includes(currentNode) && !trackingVisited.includes(currentNode)) {
      trackingVisited.push(currentNode);

      // Update paket
      const pkg = packages.find(p => p.destination === currentNode && p.status !== "delivered");
      if (pkg) {
        pkg.status = "delivered";
        stats.delivered++;
        saveAll();
      }

      speakDirection(`Sampai di ${locations[currentNode].name}. Paket berhasil dikirim.`);
      showNotification(`📦 Paket terkirim di ${currentNode} - ${locations[currentNode].name}!`, "success");

      // Tambah marker visited
      const visitedIcon = L.divIcon({
        className: "",
        html: `<div style="background:#ffa502;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:bold;border:2px solid #fff;">✓</div>`,
        iconSize: [20, 20], iconAnchor: [10, 10]
      });
      L.marker([loc.lat, loc.lng], { icon: visitedIcon }).addTo(trackingMap);
    }

    // Update info
    updateTrackingInfo();
    renderTrackingProgress();

  }, 2500); // Gerak setiap 2.5 detik
}

function stopSimulation() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  document.getElementById("btnStartSim").style.display = "block";
  document.getElementById("btnStopSim").style.display = "none";
  showNotification("Simulasi dihentikan.", "info");
}

function resetTracking() {
  stopSimulation();
  trackingIndex = 0;
  trackingVisited = [];
  trackingFullPath = [];

  if (trackingCourierMarker && trackingMap) { trackingMap.removeLayer(trackingCourierMarker); trackingCourierMarker = null; }
  if (trackingRouteLine && trackingMap) { trackingMap.removeLayer(trackingRouteLine); trackingRouteLine = null; }

  document.getElementById("trackDistance").textContent = "0 km";
  document.getElementById("trackTime").textContent = "00:00";
  document.getElementById("trackSpeed").textContent = "0 km/h";
  document.getElementById("trackNext").textContent = "-";
  document.getElementById("trackingProgress").innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Belum ada rute aktif</p>';

  showNotification("Tracking direset.", "info");
}

function updateTrackingInfo() {
  // Jarak ditempuh
  let distCovered = 0;
  for (let i = 0; i < trackingIndex && i < trackingFullPath.length - 1; i++) {
    const from = trackingFullPath[i];
    const to = trackingFullPath[i + 1];
    if (graph[from] && graph[from][to]) distCovered += graph[from][to];
    else {
      const r = dijkstra(originalGraph, from, to);
      if (r.distance !== Infinity) distCovered += r.distance;
    }
  }

  // Waktu
  const elapsed = Math.floor((Date.now() - trackingStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  // Kecepatan simulasi (km/h)
  const speed = elapsed > 0 ? ((distCovered / elapsed) * 3600).toFixed(0) : 0;

  // Tujuan berikutnya
  let nextDest = "-";
  for (let i = trackingIndex; i < trackingFullPath.length; i++) {
    if (selectedDestinations.includes(trackingFullPath[i]) && !trackingVisited.includes(trackingFullPath[i])) {
      nextDest = trackingFullPath[i];
      break;
    }
  }

  document.getElementById("trackDistance").textContent = distCovered.toFixed(2) + " km";
  document.getElementById("trackTime").textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  document.getElementById("trackSpeed").textContent = speed + " km/h";
  document.getElementById("trackNext").textContent = nextDest !== "-" ? `${nextDest} - ${locations[nextDest]?.name || ""}` : "Selesai!";
}

function renderTrackingProgress() {
  const container = document.getElementById("trackingProgress");
  if (!lastResult || !lastResult.route) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Cari rute terlebih dahulu</p>';
    return;
  }

  container.innerHTML = lastResult.route.map((r, i) => {
    let status = "waiting";
    let statusText = "Menunggu";
    let dotClass = "pending";

    if (i === 0) {
      status = "done"; statusText = "Awal"; dotClass = "completed";
    } else if (trackingVisited.includes(r)) {
      status = "done"; statusText = "Terkirim ✓"; dotClass = "completed";
    } else {
      const currentNode = trackingFullPath[trackingIndex];
      // check if this is the next unvisited destination
      const nextUnvisited = lastResult.route.find((x, idx) => idx > 0 && !trackingVisited.includes(x));
      if (r === nextUnvisited) { status = "active"; statusText = "Sedang Menuju"; dotClass = "current"; }
    }

    return `
      <div class="progress-stop">
        <div class="progress-dot ${dotClass}"></div>
        <div class="progress-stop-info">
          <div class="progress-stop-name">${r} - ${locations[r]?.name || ""}</div>
          <div class="progress-stop-detail">${i === 0 ? "Titik Awal" : `Tujuan ${i}`}</div>
        </div>
        <span class="progress-stop-status ${status}">${statusText}</span>
      </div>
    `;
  }).join("");
}

// ============================================
// 3. VOICE NAVIGATION (Text-to-Speech)
// ============================================

function speakDirection(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); // stop previous

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  const voiceStatus = document.getElementById("voiceStatus");
  if (voiceStatus) {
    voiceStatus.innerHTML = `<i class="fas fa-volume-up" style="color:var(--accent);"></i> ${text.substring(0, 50)}...`;
  }

  utterance.onend = () => {
    if (voiceStatus) voiceStatus.innerHTML = '<i class="fas fa-microphone-slash"></i> Narasi selesai';
  };

  speechSynthesis.speak(utterance);
}

function narrateRoute() {
  if (!lastResult) { showNotification("Cari rute terlebih dahulu!", "warning"); return; }

  let narration = `Rute pengiriman dimulai dari ${locations[lastResult.route[0]].name}. `;
  for (let i = 1; i < lastResult.route.length; i++) {
    narration += `Tujuan ${i}: ${locations[lastResult.route[i]].name}. `;
  }
  narration += `Total jarak ${lastResult.totalDistance.toFixed(1)} kilometer. `;
  narration += `Estimasi waktu ${Math.round((lastResult.totalDistance / settings.speed) * 60)} menit. `;
  narration += `Selamat mengantar paket!`;

  speakDirection(narration);
}

function narrateNext() {
  if (!lastResult) return;

  const nextDest = lastResult.route.find((r, i) => i > 0 && !trackingVisited.includes(r));
  if (nextDest) {
    speakDirection(`Tujuan berikutnya adalah ${locations[nextDest].name}. Menuju lokasi ${nextDest}.`);
  } else {
    speakDirection("Semua tujuan sudah dikunjungi.");
  }
}

function stopNarration() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const voiceStatus = document.getElementById("voiceStatus");
  if (voiceStatus) voiceStatus.innerHTML = '<i class="fas fa-microphone-slash"></i> Narasi dihentikan';
}

// ============================================
// 4. QR CODE PAKET
// ============================================

function populateQRPackageSelect() {
  const select = document.getElementById("qrPackageSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Pilih Paket --</option>';
  packages.forEach(pkg => {
    select.innerHTML += `<option value="${pkg.id}">${pkg.id} - ${pkg.recipient} (${pkg.destination})</option>`;
  });
}

function previewQRData() {
  const select = document.getElementById("qrPackageSelect");
  const pkgId = select.value;
  const preview = document.getElementById("qrPreviewData");
  const dataList = document.getElementById("qrDataList");

  if (!pkgId) { preview.classList.add("hidden"); return; }

  const pkg = packages.find(p => p.id === pkgId);
  if (!pkg) { preview.classList.add("hidden"); return; }

  const qrData = generateQRData(pkg);

  dataList.innerHTML = Object.entries(qrData).map(([key, val]) => `
    <div class="qr-data-row">
      <span class="qr-key">${key}</span>
      <span class="qr-val">${val}</span>
    </div>
  `).join("");

  preview.classList.remove("hidden");
}

function generateQRData(pkg) {
  return {
    id: pkg.id,
    penerima: pkg.recipient,
    tujuan: `${pkg.destination} - ${locations[pkg.destination]?.name || ""}`,
    berat: pkg.weight + " kg",
    prioritas: pkg.priority,
    status: pkg.status,
    kurir: settings.name,
    tanggal: new Date().toLocaleDateString("id-ID"),
    koordinat: locations[pkg.destination] ? `${locations[pkg.destination].lat}, ${locations[pkg.destination].lng}` : "-"
  };
}

function generateQRCode() {
  const pkgId = document.getElementById("qrPackageSelect").value;
  if (!pkgId) { showNotification("Pilih paket terlebih dahulu!", "warning"); return; }

  const pkg = packages.find(p => p.id === pkgId);
  if (!pkg) return;

  const grid = document.getElementById("qrCodeGrid");

  // Cek apakah QR untuk paket ini sudah ada
  const existing = document.getElementById("qr-card-" + pkgId);
  if (existing) { showNotification("QR Code untuk paket ini sudah ada!", "info"); return; }

  const qrData = generateQRData(pkg);
  const qrString = JSON.stringify(qrData);

  const card = document.createElement("div");
  card.className = "qr-card";
  card.id = "qr-card-" + pkgId;
  card.innerHTML = `
    <div class="qr-card-header">${pkg.id}</div>
    <div class="qr-card-image" id="qr-img-${pkgId}"></div>
    <div class="qr-card-info">
      <p><strong>${pkg.recipient}</strong></p>
      <p><i class="fas fa-map-pin"></i> ${pkg.destination} - ${locations[pkg.destination]?.name || ""}</p>
      <p><i class="fas fa-weight-hanging"></i> ${pkg.weight} kg | ${pkg.priority}</p>
    </div>
    <div class="qr-card-actions">
      <button class="btn btn-small btn-success" onclick="downloadQR('${pkgId}')"><i class="fas fa-download"></i></button>
      <button class="btn btn-small btn-danger" onclick="removeQRCard('${pkgId}')"><i class="fas fa-trash"></i></button>
    </div>
  `;

  // Hapus placeholder jika ada
  if (grid.querySelector("p")) grid.innerHTML = "";
  grid.appendChild(card);

  // Generate QR Code menggunakan qrcodejs
  setTimeout(() => {
    const qrContainer = document.getElementById("qr-img-" + pkgId);
    if (qrContainer) {
      new QRCode(qrContainer, {
        text: qrString,
        width: 150,
        height: 150,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 100);

  showNotification(`QR Code untuk ${pkgId} berhasil dibuat!`, "success");
}

function generateAllQR() {
  if (packages.length === 0) { showNotification("Belum ada paket!", "warning"); return; }

  const grid = document.getElementById("qrCodeGrid");
  grid.innerHTML = "";

  packages.forEach(pkg => {
    const qrData = generateQRData(pkg);
    const qrString = JSON.stringify(qrData);

    const card = document.createElement("div");
    card.className = "qr-card";
    card.id = "qr-card-" + pkg.id;
    card.innerHTML = `
      <div class="qr-card-header">${pkg.id}</div>
      <div class="qr-card-image" id="qr-img-${pkg.id}"></div>
      <div class="qr-card-info">
        <p><strong>${pkg.recipient}</strong></p>
        <p><i class="fas fa-map-pin"></i> ${pkg.destination} - ${locations[pkg.destination]?.name || ""}</p>
        <p><i class="fas fa-weight-hanging"></i> ${pkg.weight} kg | ${pkg.priority}</p>
      </div>
      <div class="qr-card-actions">
        <button class="btn btn-small btn-success" onclick="downloadQR('${pkg.id}')"><i class="fas fa-download"></i></button>
        <button class="btn btn-small btn-danger" onclick="removeQRCard('${pkg.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    grid.appendChild(card);

    setTimeout(() => {
      const qrContainer = document.getElementById("qr-img-" + pkg.id);
      if (qrContainer) {
        new QRCode(qrContainer, {
          text: qrString,
          width: 150,
          height: 150,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }, 100 + packages.indexOf(pkg) * 50);
  });

  showNotification(`${packages.length} QR Code berhasil dibuat!`, "success");
}

function removeQRCard(pkgId) {
  const card = document.getElementById("qr-card-" + pkgId);
  if (card) card.remove();

  const grid = document.getElementById("qrCodeGrid");
  if (grid.children.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;">QR Code akan muncul di sini.</p>';
  }
}

function downloadQR(pkgId) {
  const container = document.getElementById("qr-img-" + pkgId);
  if (!container) return;

  const canvas = container.querySelector("canvas");
  if (canvas) {
    const link = document.createElement("a");
    link.download = `qr-${pkgId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showNotification(`QR ${pkgId} diunduh!`, "success");
  } else {
    // Fallback: coba img
    const img = container.querySelector("img");
    if (img) {
      const link = document.createElement("a");
      link.download = `qr-${pkgId}.png`;
      link.href = img.src;
      link.click();
    }
  }
}

function scanQRCode() {
  const input = document.getElementById("qrScanInput").value.trim();
  const resultDiv = document.getElementById("qrScanResult");

  if (!input) { showNotification("Masukkan data QR code!", "warning"); return; }

  try {
    const data = JSON.parse(input);
    resultDiv.innerHTML = `
      <h4><i class="fas fa-check-circle"></i> Paket Ditemukan</h4>
      <div class="qr-data-list">
        ${Object.entries(data).map(([key, val]) => `
          <div class="qr-data-row">
            <span class="qr-key">${key}</span>
            <span class="qr-val">${val}</span>
          </div>
        `).join("")}
      </div>
      <div style="margin-top:12px;">
        <button class="btn btn-small btn-success" onclick="markScannedDelivered('${data.id}')">
          <i class="fas fa-check"></i> Tandai Terkirim
        </button>
      </div>
    `;
    resultDiv.classList.remove("hidden");
    showNotification("QR Code berhasil dipindai!", "success");
  } catch (e) {
    resultDiv.innerHTML = `<h4 style="color:var(--danger);"><i class="fas fa-times-circle"></i> Format QR Tidak Valid</h4><p style="font-size:0.82rem;color:var(--text-muted);">Pastikan data adalah format JSON yang valid.</p>`;
    resultDiv.classList.remove("hidden");
    showNotification("Format QR tidak valid!", "danger");
  }
}

function markScannedDelivered(pkgId) {
  const pkg = packages.find(p => p.id === pkgId);
  if (pkg) {
    pkg.status = "delivered";
    stats.delivered++;
    saveAll();
    renderPackages();
    updateAllDashboards();
    showNotification(`Paket ${pkgId} ditandai terkirim via QR scan!`, "success");
  } else {
    showNotification("Paket tidak ditemukan dalam sistem!", "warning");
  }
}

// ============================================
// UPDATE NAVIGATION UNTUK PAGE BARU
// ============================================

// Override navigateTo untuk handle halaman baru
const originalNavigateTo = navigateTo;
navigateTo = function(page) {
  // Handle halaman baru
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));

  const pageEl = document.getElementById("page-" + page);
  if (pageEl) pageEl.classList.add("active");

  const menuEl = document.querySelector(`[data-page="${page}"]`);
  if (menuEl) menuEl.classList.add("active");

  const names = {
    home: "Beranda", dashboard: "Dashboard", route: "Cari Rute",
    packages: "Paket", map: "Peta", history: "Riwayat",
    settings: "Pengaturan", tracking: "Live Tracking", qrcode: "QR Code"
  };
  document.getElementById("breadcrumb").textContent = names[page] || page;

  // Page-specific actions
  if (page === "map") { setTimeout(() => { if (!leafletMap) initMap(); else leafletMap.invalidateSize(); }, 200); }
  if (page === "tracking") { setTimeout(() => { if (!trackingMap) initTrackingMap(); else trackingMap.invalidateSize(); }, 200); }
  if (page === "dashboard") { updateAllDashboards(); drawWeeklyChart(); }
  if (page === "packages") { renderPackages(); }
  if (page === "history") { renderHistory(); }
  if (page === "settings") { updateSettingsUI(); updateDataInfo(); }
  if (page === "home") { updateHomeStats(); }
  if (page === "qrcode") { populateQRPackageSelect(); }

  if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");
};

// ============================================
// INIT TAMBAHAN
// ============================================

// Tambahkan ke init yang sudah ada
const originalInit = init;
init = function() {
  originalInit();
  // Additional init for new features
  populateQRPackageSelect();
};

// Reinitialize
window.onload = init;
