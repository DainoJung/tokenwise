/**
 * TokenWise Web Dashboard — Cost analytics UI served by the proxy
 */

export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TokenWise Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .subtitle { color: #888; margin-bottom: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1.25rem; }
  .card .label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .card .value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
  .card .value.green { color: #4ade80; }
  .card .value.blue { color: #60a5fa; }
  .card .value.yellow { color: #facc15; }
  table { width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 8px; overflow: hidden; }
  th { text-align: left; padding: 0.75rem 1rem; background: #222; font-size: 0.75rem; color: #888; text-transform: uppercase; }
  td { padding: 0.75rem 1rem; border-top: 1px solid #2a2a2a; font-size: 0.875rem; }
  .refresh { background: #333; color: #e0e0e0; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.875rem; margin-bottom: 1rem; }
  .refresh:hover { background: #444; }
  #error { color: #f87171; display: none; margin-bottom: 1rem; }
  .empty { text-align: center; padding: 2rem; color: #666; }
</style>
</head>
<body>
<h1>TokenWise Dashboard</h1>
<p class="subtitle">Spend less, agent more.</p>
<button class="refresh" onclick="load()">Refresh</button>
<div id="error"></div>
<div class="grid" id="cards"></div>
<h2 style="margin-bottom:1rem; font-size:1.1rem;">Usage by Model</h2>
<table id="models"><thead><tr><th>Model</th><th>Requests</th><th>Input Tokens</th><th>Output Tokens</th><th>Cost</th></tr></thead><tbody></tbody></table>

<script>
function fmt(n) { return n.toLocaleString(); }
function usd(n) { return '$' + n.toFixed(4); }

async function load() {
  const errEl = document.getElementById('error');
  errEl.style.display = 'none';
  try {
    const res = await fetch('/v1/tokenwise/savings', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('tw_key') || prompt('Enter API key:') || '') }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    if (d.totalRequests === undefined) { document.getElementById('cards').innerHTML = '<div class="empty">No data yet. Make some API calls through the proxy first.</div>'; return; }

    document.getElementById('cards').innerHTML = [
      card('Total Requests', fmt(d.totalRequests), 'blue'),
      card('Input Tokens', fmt(d.totalInputTokens), ''),
      card('Original Tokens', fmt(d.totalOriginalInputTokens), ''),
      card('Tokens Saved', fmt(d.totalSavedInputTokens), 'green'),
      card('Actual Cost', usd(d.totalCostUSD), 'yellow'),
      card('Without TokenWise', usd(d.totalOriginalCostUSD), ''),
      card('You Saved', usd(d.totalSavingsUSD), 'green'),
      card('Savings', d.savingsPercent.toFixed(1) + '%', 'green'),
    ].join('');

    const tbody = document.querySelector('#models tbody');
    tbody.innerHTML = '';
    for (const [model, info] of Object.entries(d.byModel || {})) {
      const r = info;
      tbody.innerHTML += '<tr><td>' + model + '</td><td>' + fmt(r.requests) + '</td><td>' + fmt(r.inputTokens) + '</td><td>' + fmt(r.outputTokens) + '</td><td>' + usd(r.costUSD) + '</td></tr>';
    }
    if (!Object.keys(d.byModel || {}).length) tbody.innerHTML = '<tr><td colspan="5" class="empty">No model data yet</td></tr>';
  } catch(e) {
    errEl.textContent = 'Error loading data: ' + e.message;
    errEl.style.display = 'block';
  }
}

function card(label, value, colorClass) {
  return '<div class="card"><div class="label">' + label + '</div><div class="value ' + colorClass + '">' + value + '</div></div>';
}

load();
</script>
</body>
</html>`;
}
