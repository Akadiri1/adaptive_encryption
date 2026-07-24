/**
 * Adaptive Encryption System — Dashboard Application
 * Connects to FastAPI backend at localhost:8000
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000/api' : '/api';

// ─── State ────────────────────────────────────────────────────────────────
let state = {
    simulationResults: [],
    benchmarkResults: null,
    nodes: [],
    policyTable: [],
    charts: {},
    isOffline: false,
};

// ─── Color Palette ────────────────────────────────────────────────────────
const colors = {
    cyan:   '#00d4ff',
    violet: '#8b5cf6',
    green:  '#10b981',
    amber:  '#f59e0b',
    red:    '#ef4444',
};

// Map algorithm internal names → display labels + colors
const ALGO_META = {
    'CHACHA20_POLY1305':  { label: 'ChaCha20-Poly1305',      color: colors.green  },
    'AES_128_GCM':        { label: 'AES-128-GCM',            color: colors.cyan   },
    'AES_256_GCM':        { label: 'AES-256-GCM',            color: colors.violet },
    'HYBRID_RSA_AES256':  { label: 'RSA + AES-256-GCM',      color: colors.amber  },
    // Fallbacks for display-friendly names from policy table
    'ChaCha20-Poly1305':            { label: 'ChaCha20-Poly1305',      color: colors.green  },
    'AES-128-GCM':                  { label: 'AES-128-GCM',            color: colors.cyan   },
    'AES-256-GCM':                  { label: 'AES-256-GCM',            color: colors.violet },
    'AES-256-GCM + RSA envelope':   { label: 'RSA + AES-256-GCM',      color: colors.amber  },
    'AES-256-GCM + RSA-2048 envelope': { label: 'RSA + AES-256-GCM',   color: colors.amber  },
};

function algoLabel(raw) { return ALGO_META[raw]?.label || raw; }
function algoColor(raw) { return ALGO_META[raw]?.color || colors.cyan; }

// Map resource-level strings → numeric percent for bars
const RESOURCE_PERCENT = { constrained: 20, medium: 55, high: 90 };

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    createCharts();

    try {
        await Promise.all([fetchNodes(), fetchPolicyTable()]);
        if (state.isOffline) loadMockData();
    } catch (e) {
        console.error('Init error:', e);
    }
}

// ─── API helper ───────────────────────────────────────────────────────────
async function apiCall(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setConnectionStatus(true);
        return data;
    } catch (err) {
        console.warn(`API ${endpoint}:`, err);
        setConnectionStatus(false);
        state.isOffline = true;
        return null;
    }
}

function setConnectionStatus(online) {
    const dot  = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    dot.className  = `status-dot ${online ? 'online' : 'offline'}`;
    text.textContent = online ? 'System Online' : 'API Offline — Mock Mode';
}

// ─── Nodes ────────────────────────────────────────────────────────────────
async function fetchNodes() {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '<div class="loading-skeleton">Loading nodes…</div>';

    let data = await apiCall('/nodes');
    if (!data) {
        data = [
            { node_id: 'node-1', cpu_level: 'constrained', battery_level: 'constrained', bandwidth_level: 'constrained', resource_level: 'constrained' },
            { node_id: 'node-2', cpu_level: 'constrained', battery_level: 'medium',      bandwidth_level: 'medium',      resource_level: 'constrained' },
            { node_id: 'node-3', cpu_level: 'medium',      battery_level: 'medium',      bandwidth_level: 'medium',      resource_level: 'medium' },
            { node_id: 'node-4', cpu_level: 'high',        battery_level: 'high',        bandwidth_level: 'high',        resource_level: 'high' },
        ];
    }
    state.nodes = data;
    renderNodes();
    showNotification('Nodes loaded', 'success');
}

function renderNodes() {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '';

    state.nodes.forEach(node => {
        const pct = (level) => RESOURCE_PERCENT[level] ?? 50;
        const fillClass = (level) => level === 'high' ? 'fill-high' : level === 'medium' ? 'fill-med' : 'fill-low';
        const badgeClass = (level) => {
            if (level === 'high') return 'badge-high';
            if (level === 'medium') return 'badge-medium';
            return 'badge-low';
        };
        const levelLabel = (level) => level.charAt(0).toUpperCase() + level.slice(1);

        container.insertAdjacentHTML('beforeend', `
            <div class="node-card fade-in">
                <div class="node-header">
                    <span class="node-id">${node.node_id}</span>
                    <span class="status-dot online" style="margin-right:0.4rem;display:inline-block"></span>
                    <span class="badge ${badgeClass(node.resource_level)}">${levelLabel(node.resource_level)}</span>
                </div>
                <div class="resource-bar-container">
                    <div class="resource-label"><span>CPU</span><span>${levelLabel(node.cpu_level)}</span></div>
                    <div class="resource-track"><div class="resource-fill ${fillClass(node.cpu_level)}" style="width:${pct(node.cpu_level)}%"></div></div>
                </div>
                <div class="resource-bar-container">
                    <div class="resource-label"><span>Battery</span><span>${levelLabel(node.battery_level)}</span></div>
                    <div class="resource-track"><div class="resource-fill ${fillClass(node.battery_level)}" style="width:${pct(node.battery_level)}%"></div></div>
                </div>
                <div class="resource-bar-container">
                    <div class="resource-label"><span>Bandwidth</span><span>${levelLabel(node.bandwidth_level)}</span></div>
                    <div class="resource-track"><div class="resource-fill ${fillClass(node.bandwidth_level)}" style="width:${pct(node.bandwidth_level)}%"></div></div>
                </div>
            </div>
        `);
    });
}

// ─── Policy Table ─────────────────────────────────────────────────────────
async function fetchPolicyTable() {
    let data = await apiCall('/policy-table');
    if (!data) {
        data = [
            { Sensitivity: 'Low',    'Node Resources': 'Constrained', Algorithm: 'ChaCha20-Poly1305',            rationale: 'Low sensitivity on constrained node → lightweight cipher' },
            { Sensitivity: 'Low',    'Node Resources': 'Medium',      Algorithm: 'AES-128-GCM',                  rationale: 'Low sensitivity on medium node → standard cipher' },
            { Sensitivity: 'Low',    'Node Resources': 'High',        Algorithm: 'AES-128-GCM',                  rationale: 'Low sensitivity on high node → standard cipher' },
            { Sensitivity: 'Medium', 'Node Resources': 'Constrained', Algorithm: 'AES-128-GCM',                  rationale: 'Medium sensitivity on constrained node → balanced' },
            { Sensitivity: 'Medium', 'Node Resources': 'Medium',      Algorithm: 'AES-256-GCM',                  rationale: 'Medium sensitivity on medium node → strong cipher' },
            { Sensitivity: 'Medium', 'Node Resources': 'High',        Algorithm: 'AES-256-GCM',                  rationale: 'Medium sensitivity on high node → strong cipher' },
            { Sensitivity: 'High',   'Node Resources': 'Constrained', Algorithm: 'AES-256-GCM',                  rationale: 'High sensitivity on constrained node → prioritize security' },
            { Sensitivity: 'High',   'Node Resources': 'Medium',      Algorithm: 'AES-256-GCM + RSA envelope',   rationale: 'High sensitivity on medium node → hybrid encryption' },
            { Sensitivity: 'High',   'Node Resources': 'High',        Algorithm: 'AES-256-GCM + RSA-2048 envelope', rationale: 'High sensitivity on high node → maximum security' },
        ];
    }
    state.policyTable = data;
    renderPolicyTable();
}

function renderPolicyTable() {
    const tbody = document.querySelector('#policy-table tbody');
    tbody.innerHTML = '';

    state.policyTable.forEach(row => {
        const sens = row.Sensitivity || row.sensitivity || '';
        const res  = row['Node Resources'] || row.resource_level || '';
        const algo = row.Algorithm || row.algorithm || '';
        const rationale = row.rationale || '';

        const sensBadge = sens.toLowerCase() === 'high' ? 'badge-high' : sens.toLowerCase() === 'medium' ? 'badge-medium' : 'badge-low';
        // For resources: constrained=low badge, medium=medium, high=high
        const resBadge = res.toLowerCase() === 'high' ? 'badge-high' : res.toLowerCase() === 'medium' ? 'badge-medium' : 'badge-low';

        const tr = document.createElement('tr');
        tr.id = `policy-row-${sens}-${res}`;
        tr.innerHTML = `
            <td><span class="badge ${sensBadge}">${sens}</span></td>
            <td><span class="badge ${resBadge}">${res}</span></td>
            <td><strong style="color:${algoColor(algo)}">${algoLabel(algo)}</strong></td>
            <td>${rationale}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── Simulation ───────────────────────────────────────────────────────────
async function runSimulation() {
    showNotification('Running simulation… (encrypting 50 packets)', 'info');

    let data = await apiCall('/simulate');
    if (!data) {
        showNotification('API offline — showing mock data', 'warning');
        data = generateMockSimulation();
    }

    state.simulationResults = data.results;
    updateMetrics(data.summary);
    renderSimulationResults(data.results);
    populateDecryptSelect(data.results);
    showNotification(`Simulation complete — ${data.summary.total_packets} packets processed`, 'success');
}

function renderSimulationResults(results) {
    const tbody = document.getElementById('results-body');
    tbody.innerHTML = '';

    results.forEach((res, i) => {
        setTimeout(() => {
            const sens = res.sensitivity || 'unknown';
            const sensBadge = sens === 'high' ? 'badge-high' : sens === 'medium' ? 'badge-medium' : 'badge-low';

            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.innerHTML = `
                <td title="${res.packet_id}">${res.packet_id.substring(0, 8)}…</td>
                <td><span class="badge ${sensBadge}">${sens}</span></td>
                <td>${formatBytes(res.size_bytes)}</td>
                <td>${res.node_id}</td>
                <td style="color:${algoColor(res.algorithm)}"><strong>${algoLabel(res.algorithm)}</strong></td>
                <td>${Number(res.encryption_time_ms).toFixed(3)}</td>
                <td>${Number(res.cpu_usage_percent).toFixed(3)} ms</td>
                <td>${Number(res.throughput_mbps).toFixed(1)}</td>
            `;
            tbody.appendChild(tr);
        }, i * 60); // staggered animation, faster for 50 rows
    });
}

function updateMetrics(summary) {
    animateCounter('metric-packets', summary.total_packets, 1000);
    animateCounter('metric-time', summary.avg_encryption_time_ms, 1000, true);

    // algorithms_used can be an array or a number
    const algoCount = Array.isArray(summary.algorithms_used) ? summary.algorithms_used.length : summary.algorithms_used;
    animateCounter('metric-algos', algoCount, 800);

    // Compute avg throughput from results if available
    if (state.simulationResults.length) {
        const avgThroughput = state.simulationResults.reduce((s, r) => s + Number(r.throughput_mbps || 0), 0) / state.simulationResults.length;
        animateCounter('metric-throughput', avgThroughput.toFixed(1), 1000, true);
    }
}

function populateDecryptSelect(results) {
    const select = document.getElementById('packet-select');
    select.innerHTML = '<option value="">Select a packet to decrypt…</option>';
    results.forEach((res, i) => {
        const opt = document.createElement('option');
        opt.value = i; // index into state.simulationResults
        opt.textContent = `${res.packet_id.substring(0, 8)}… — ${algoLabel(res.algorithm)} (${res.node_id})`;
        select.appendChild(opt);
    });
}

// ─── Decrypt Demo ─────────────────────────────────────────────────────────
async function handleDecrypt() {
    const select  = document.getElementById('packet-select');
    const resDiv  = document.getElementById('decrypt-result');
    const idx     = parseInt(select.value);

    if (isNaN(idx)) {
        showNotification('Select a packet first', 'warning');
        return;
    }

    const pkt = state.simulationResults[idx];
    resDiv.innerHTML = '<span style="color:var(--text-muted)">Decrypting…</span>';
    resDiv.className = 'decrypt-result';

    // Send the actual encryption data so the backend can decrypt
    let data = await apiCall('/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            packet_id:         pkt.packet_id,
            encrypted_data:    pkt.encrypted_data,
            algorithm:         pkt.algorithm,
            key_id:            pkt.key_id,
            nonce:             pkt.nonce,
            tag:               pkt.tag,
            rsa_encrypted_key: pkt.rsa_encrypted_key,
        }),
    });

    if (!data) {
        await new Promise(r => setTimeout(r, 600));
        data = { success: true, decrypted_data: btoa('mock decrypted payload'), decryption_time_ms: 0.42, packet_id: pkt.packet_id };
    }

    if (data.success) {
        resDiv.className = 'decrypt-result success';
        const preview = tryDecodeBase64(data.decrypted_data);
        resDiv.innerHTML = `
            <div style="color:var(--success-green); margin-bottom:0.5rem; font-size:1.1rem">✓ Decryption Successful</div>
            <div><strong>Packet:</strong> ${data.packet_id}</div>
            <div><strong>Algorithm:</strong> <span style="color:${algoColor(pkt.algorithm)}">${algoLabel(pkt.algorithm)}</span></div>
            <div><strong>Time:</strong> ${Number(data.decryption_time_ms).toFixed(3)} ms</div>
            <div style="margin-top:0.5rem; word-break:break-all;"><strong>Data preview:</strong> ${preview}</div>
        `;
    } else {
        resDiv.className = 'decrypt-result error';
        resDiv.innerHTML = `
            <div style="color:var(--danger-red); font-size:1.1rem">✗ Decryption Failed</div>
            <div>Error: ${data.error || 'Unknown error'}</div>
        `;
    }
}

function tryDecodeBase64(b64) {
    try {
        const decoded = atob(b64);
        // Show first 120 chars, hex if binary
        if (/^[\x20-\x7E\n\r\t]+$/.test(decoded.substring(0, 120))) {
            return decoded.substring(0, 120) + (decoded.length > 120 ? '…' : '');
        }
        // Show as hex for binary data
        const hex = Array.from(decoded.substring(0, 40), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        return `[binary] ${hex}…  (${decoded.length} bytes)`;
    } catch {
        return b64.substring(0, 60) + '…';
    }
}

// ─── Benchmark ────────────────────────────────────────────────────────────
async function runBenchmark() {
    showNotification('Running benchmarks… (this takes ~15 seconds)', 'info');

    let data = await apiCall('/benchmark');
    if (!data) {
        showNotification('API offline — showing mock benchmarks', 'warning');
        data = { results: generateMockBenchmark() };
    }

    state.benchmarkResults = data;
    updateCharts(data.results);
    showNotification('Benchmark complete', 'success');
}

// ─── Charts ───────────────────────────────────────────────────────────────
function createCharts() {
    const gridOpts = { color: 'rgba(255,255,255,0.06)' };
    const tickOpts = { color: '#94a3b8' };
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f8fafc', boxWidth: 14 } } },
        scales: {
            y: { grid: gridOpts, ticks: tickOpts },
            x: { grid: gridOpts, ticks: tickOpts },
        },
    };

    // 1. Encryption Time vs Data Size (line)
    state.charts.time = new Chart(document.getElementById('chart-time'), {
        type: 'line',
        data: { labels: ['1KB', '10KB', '100KB', '1MB'], datasets: [] },
        options: {
            ...commonOptions,
            elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 4, hoverRadius: 6 } },
            plugins: { ...commonOptions.plugins, tooltip: { mode: 'index', intersect: false } },
            scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'Time (ms)', color: '#94a3b8' } } },
        },
    });

    // 2. Throughput (bar)
    state.charts.throughput = new Chart(document.getElementById('chart-throughput'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            ...commonOptions,
            scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'MB/s', color: '#94a3b8' } } },
        },
    });

    // 3. CPU Usage (bar)
    state.charts.cpu = new Chart(document.getElementById('chart-cpu'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            ...commonOptions,
            scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'Compute Time (ms)', color: '#94a3b8' } } },
        },
    });

    // 4. Adaptive vs Fixed (horizontal bar)
    state.charts.comparison = new Chart(document.getElementById('chart-comparison'), {
        type: 'bar',
        data: {
            labels: ['Always RSA+AES-256 (Max Security)', 'Adaptive Strategy'],
            datasets: [{ label: 'Total Encryption Time (ms)', data: [0, 0], backgroundColor: [colors.red, colors.green], borderRadius: 6 }],
        },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
        },
    });
}

function updateCharts(results) {
    const algos = Object.keys(results);
    const sizes = ['1KB', '10KB', '100KB', '1MB'];

    // ── Time Chart (line) ──
    const timeDatasets = algos.map(algo => ({
        label: algoLabel(algo),
        data: sizes.map(s => results[algo]?.[s]?.avg_encrypt_ms ?? null),
        borderColor: algoColor(algo),
        backgroundColor: algoColor(algo) + '22',
        fill: false,
        borderWidth: 2,
    }));
    state.charts.time.data.labels = sizes;
    state.charts.time.data.datasets = timeDatasets;
    state.charts.time.update('active');

    // ── Throughput Chart (grouped bar per size) ──
    const throughputDatasets = sizes.map((s, si) => ({
        label: s,
        data: algos.map(a => results[a]?.[s]?.avg_throughput_mbps ?? 0),
        backgroundColor: [colors.cyan, colors.green, colors.violet, colors.amber][si] + 'cc',
        borderRadius: 4,
    }));
    state.charts.throughput.data.labels = algos.map(algoLabel);
    state.charts.throughput.data.datasets = throughputDatasets;
    state.charts.throughput.update('active');

    // ── CPU Chart ──
    // Windows process_time() has 15.625ms resolution, so most sub-15ms
    // operations show as 0. Use wall-clock encrypt time as a proxy for
    // computational cost instead — it directly reflects how much compute
    // each algorithm consumes.
    const cpuProxyData = algos.map(algo => {
        const vals = Object.values(results[algo]).map(v => v.avg_encrypt_ms);
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    state.charts.cpu.data.labels = algos.map(algoLabel);
    state.charts.cpu.data.datasets = [{
        label: 'Avg Compute Time (ms)',
        data: cpuProxyData,
        backgroundColor: algos.map(a => algoColor(a) + 'cc'),
        borderRadius: 4,
    }];
    state.charts.cpu.update('active');

    // ── Adaptive vs Fixed comparison ──
    // "Fixed" baseline: what if you treated ALL data as high-sensitivity and
    // always used HYBRID_RSA_AES256 (the heaviest, most secure option)?
    // "Adaptive": the policy engine routes packets by sensitivity, so most
    // traffic uses lighter ciphers. Weights match the sensitivity distribution:
    //   40% low  → ChaCha20 / AES-128  (lightweight)
    //   35% med  → AES-128 / AES-256   (mid-weight)
    //   25% high → AES-256 / Hybrid    (heavyweight)
    const PACKETS_PER_SIZE = 12; // ~48 total across 4 sizes
    const heaviestAlgo = 'HYBRID_RSA_AES256';

    // Fixed: every packet encrypted with the heaviest algorithm
    let fixedTotal = 0;
    sizes.forEach(s => {
        fixedTotal += (results[heaviestAlgo]?.[s]?.avg_encrypt_ms ?? 0) * PACKETS_PER_SIZE;
    });

    // Adaptive: realistic mix based on policy distribution
    // Low sensitivity (40% of packets) → mostly ChaCha20/AES-128
    // Medium sensitivity (35%) → mostly AES-128/AES-256
    // High sensitivity (25%) → AES-256 or Hybrid
    const adaptiveWeights = {
        'CHACHA20_POLY1305': 0.20,  // low-sens on constrained nodes
        'AES_128_GCM':       0.35,  // low-sens on medium/high + med-sens on constrained
        'AES_256_GCM':       0.30,  // med-sens on medium/high + high-sens on constrained
        'HYBRID_RSA_AES256': 0.15,  // high-sens on medium/high nodes only
    };

    let adaptiveTotal = 0;
    sizes.forEach(s => {
        algos.forEach(a => {
            const weight = adaptiveWeights[a] ?? (1 / algos.length);
            adaptiveTotal += (results[a]?.[s]?.avg_encrypt_ms ?? 0) * PACKETS_PER_SIZE * weight;
        });
    });

    state.charts.comparison.data.datasets[0].data = [
        Number(fixedTotal.toFixed(2)),
        Number(adaptiveTotal.toFixed(2)),
    ];
    state.charts.comparison.update('active');
}

// ─── Utility ──────────────────────────────────────────────────────────────
function animateCounter(id, target, duration, isFloat = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseFloat(el.innerText) || 0;
    const end = parseFloat(target);
    if (isNaN(end)) { el.innerText = target; return; }
    const t0 = performance.now();

    function tick(now) {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        const val = start + (end - start) * eased;
        el.innerText = isFloat ? val.toFixed(1) : Math.floor(val);
        if (p < 1) requestAnimationFrame(tick);
        else el.innerText = isFloat ? end.toFixed(1) : end;
    }
    requestAnimationFrame(tick);
}

function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

function showNotification(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function highlightPolicyRow(sensitivity, resourceLevel) {
    document.querySelectorAll('#policy-table tbody tr').forEach(r => r.classList.remove('active-policy'));
    const s = sensitivity.charAt(0).toUpperCase() + sensitivity.slice(1);
    const r = resourceLevel.charAt(0).toUpperCase() + resourceLevel.slice(1);
    const target = document.getElementById(`policy-row-${s}-${r}`);
    if (target) {
        target.classList.add('active-policy');
        setTimeout(() => target.classList.remove('active-policy'), 2000);
    }
}

// ─── Mock Data (offline fallback) ─────────────────────────────────────────
function loadMockData() {
    runSimulation();
    runBenchmark();
}

function generateMockSimulation() {
    const results = [];
    const algos = ['CHACHA20_POLY1305', 'AES_128_GCM', 'AES_256_GCM', 'HYBRID_RSA_AES256'];
    const sensitivities = ['low', 'medium', 'high'];
    const sizes = [1024, 10240, 102400, 1048576];
    const nodes = ['node-1', 'node-2', 'node-3', 'node-4'];

    for (let i = 0; i < 20; i++) {
        const sens = sensitivities[Math.floor(Math.random() * 3)];
        const size = sizes[Math.floor(Math.random() * 4)];
        results.push({
            packet_id: crypto.randomUUID?.() || `mock-${i}`,
            sensitivity: sens,
            size_bytes: size,
            node_id: nodes[Math.floor(Math.random() * 4)],
            algorithm: algos[Math.floor(Math.random() * 4)],
            encryption_time_ms: (Math.random() * 10 + 0.5).toFixed(3),
            cpu_usage_percent: (Math.random() * 2 + 0.1).toFixed(3),
            memory_usage_mb: (Math.random() * 5).toFixed(2),
            throughput_mbps: (Math.random() * 200 + 20).toFixed(1),
            rationale: 'Mock data — start backend for real results',
            encrypted_data: btoa('mock'), nonce: btoa('mock'), tag: btoa('mock'), key_id: 'mock',
        });
    }
    return {
        results,
        summary: { total_packets: results.length, algorithms_used: [...new Set(results.map(r => r.algorithm))], avg_encryption_time_ms: 3.5 },
    };
}

function generateMockBenchmark() {
    const algos = ['CHACHA20_POLY1305', 'AES_128_GCM', 'AES_256_GCM', 'HYBRID_RSA_AES256'];
    const sizes = ['1KB', '10KB', '100KB', '1MB'];
    const result = {};
    algos.forEach((algo, ai) => {
        result[algo] = {};
        sizes.forEach((s, si) => {
            const base = (ai + 1) * 0.5 * (si + 1);
            result[algo][s] = {
                avg_encrypt_ms: base + Math.random() * 2,
                avg_decrypt_ms: base * 0.8 + Math.random(),
                avg_throughput_mbps: (300 - ai * 50) / (si + 1) + Math.random() * 20,
                avg_cpu_ms: (ai + 1) * 0.5 + Math.random() * 1.5,
                avg_memory_mb: Math.random() * 2 + 1,
            };
        });
    });
    return result;
}
