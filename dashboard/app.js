(() => {
  'use strict';
  const data = window.RADAR;
  if (!data) throw new Error('Radar data is missing. Run main.ts first.');
  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
  const money = (n) => n == null ? '—' : '$' + fmt.format(n);
  const shortMoney = (n) => {
    if (n == null) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return money(n);
  };
  const esc = (s) => String(s ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = (s) => s ? new Date(s + 'T00:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}) : 'Not listed';
  const categoryLabel = (s) => s || 'Unclassified';
  const allRows = data.rows;
  const allCategories = [...new Set(allRows.map(r => categoryLabel(r.category)))].sort((a,b) => a.localeCompare(b));
  const allChains = [...new Set(allRows.flatMap(r => r.chains))].sort((a,b) => a.localeCompare(b));
  for (const value of allCategories) $('category-filter').insertAdjacentHTML('beforeend', `<option value="${esc(value)}">${esc(value)}</option>`);
  for (const value of allChains) $('chain-filter').insertAdjacentHTML('beforeend', `<option value="${esc(value)}">${esc(value)}</option>`);
  $('as-of-label').textContent = 'AS OF ' + data.as_of;
  $('source-label').textContent = `DefiLlama · frozen snapshot · ${data.universe_size} protocols`;
  $('coverage-value').textContent = `${data.watchlist_size} / ${data.watchlist_size}`;
  $('coverage-sub').textContent = `${allRows.length} rows ranked`;
  $('multiple-value').textContent = data.market_multiple.toFixed(4) + '×';
  $('multiple-sub').textContent = `${data.market_sample_size} positive mcap / TVL samples`;
  $('formula-multiple').textContent = data.market_multiple.toFixed(4) + '×';
  $('formula-note').textContent = `Lower middle observed ratio from ${data.market_sample_size} token-bearing protocols with positive market cap and TVL.`;
  $('live-count').textContent = String(data.live.length).padStart(2,'0');
  $('board-count').textContent = String(allRows.length).padStart(3,'0');
  $('snapshot-copy').textContent = `As of ${data.as_of}. Source: ${data.source}. Universe: ${data.universe_size} protocols at or above $5M TVL. The watchlist floor is ${money(data.floor_usd)}; ${data.candidate_count} records meet the candidate rule across the snapshot. A null listed date uses a 365-day model age.`;
  let sortKey = 'rank', sortDir = 1;
  const state = {search:'', category:'', chain:'', watch:false};
  const filteredRows = () => allRows.filter(r => (!state.search || `${r.name} ${r.slug} ${r.category ?? ''}`.toLowerCase().includes(state.search)) && (!state.category || categoryLabel(r.category) === state.category) && (!state.chain || r.chains.includes(state.chain)) && (!state.watch || r.watchlist));
  const chainMarkup = (chains) => `${chains.slice(0,2).map(c=>`<span class="chain-chip">${esc(c)}</span>`).join('')}${chains.length>2?`<span class="chain-more">+${chains.length-2}</span>`:''}` || '<span class="chain-more">—</span>';
  function renderBoard() {
    const rows = filteredRows().sort((a,b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      if (sortKey === 'change_7d' || sortKey === 'age_days') { av ??= -Infinity; bv ??= -Infinity; }
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return a.rank-b.rank;
    });
    $('board-rows').innerHTML = rows.map(r => {
      const ch = r.change_7d == null ? '—' : `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(1)}%`;
      const chClass = r.change_7d == null ? 'change-neutral' : r.change_7d > 0 ? 'change-positive' : r.change_7d < 0 ? 'change-negative' : 'change-neutral';
      return `<tr data-slug="${esc(r.slug)}" tabindex="0" aria-label="Open ${esc(r.name)} details"><td class="rank-cell">${String(r.rank).padStart(2,'0')}</td><td class="name-cell"><span class="name-main">${esc(r.name)}</span><span class="slug-sub">${esc(r.slug)}</span></td><td class="category-cell">${esc(categoryLabel(r.category))}</td><td>${chainMarkup(r.chains)}</td><td class="numeric">${shortMoney(r.tvl_usd)}</td><td class="numeric ${chClass}">${ch}</td><td class="numeric">${fmt.format(r.age_days)}d</td><td class="numeric value-cell">${shortMoney(r.implied_value_usd)}</td><td>${r.watchlist?'<span class="watch-badge">WATCHLIST</span>':'<span class="watch-empty">—</span>'}</td></tr>`;
    }).join('');
    $('board-count').textContent = String(rows.length).padStart(3,'0');
    $('table-range').textContent = `Showing ${rows.length ? `1–${rows.length}` : '0'} of ${allRows.length} protocols`;
    $('empty-state').hidden = rows.length > 0;
    document.querySelectorAll('[data-sort]').forEach(button => {
      button.removeAttribute('aria-sort');
      if (button.dataset.sort === sortKey) button.setAttribute('aria-sort',sortDir === 1?'ascending':'descending');
    });
  }
  function renderLive() {
    $('live-rows').innerHTML = data.live.map((r,i)=>`<tr><td class="rank-cell">${String(i+1).padStart(2,'0')}</td><td>${esc(r.name)}<span class="slug-sub">${esc(r.slug)}</span></td><td>${esc(categoryLabel(r.category))}</td><td>${chainMarkup(r.chains)}</td><td class="numeric">${shortMoney(r.tvl_usd)}</td><td class="numeric market-value">${shortMoney(r.mcap_usd)}</td></tr>`).join('');
  }
  function openDetail(slug) {
    const r = allRows.find(row => row.slug === slug);
    if (!r) return;
    $('detail-panel').innerHTML = `<div class="detail-top"><span class="detail-label">PROTOCOL DOSSIER <span style="color:var(--lime)">/ 01</span></span><button class="close-detail" type="button" aria-label="Close details">×</button></div><div class="detail-hero"><span class="detail-rank">RANK ${String(r.rank).padStart(3,'0')} ${r.watchlist?'· WATCHLIST':''}</span><h2>${esc(r.name)}</h2><p>${esc(r.slug)} · ${esc(categoryLabel(r.category))}</p></div><div class="detail-value-grid"><div class="detail-stat accent"><span>IMPLIED VALUE</span><strong>${money(r.implied_value_usd)}</strong></div><div class="detail-stat"><span>TVL</span><strong>${money(r.tvl_usd)}</strong></div><div class="detail-stat"><span>7D CHANGE</span><strong>${r.change_7d == null?'Not reported':`${r.change_7d>0?'+':''}${r.change_7d.toFixed(2)}%`}</strong></div><div class="detail-stat"><span>TRACKED AGE</span><strong>${fmt.format(r.age_days)} days</strong></div></div><section class="detail-block"><h3>PROTOCOL RECORD</h3><div class="field-grid"><div class="field"><span>Chains</span><strong>${esc(r.chains.join(', ')||'Not listed')}</strong></div><div class="field"><span>Listed at</span><strong>${date(r.listed_at)}</strong></div><div class="field"><span>Market cap</span><strong>${money(r.mcap_usd)}</strong></div><div class="field"><span>CoinGecko ID</span><strong>${esc(r.gecko_id ?? 'Not recorded')}</strong></div><div class="field"><span>Symbol</span><strong>${esc(r.symbol ?? 'Not recorded')}</strong></div><div class="field"><span>Token record</span><strong>Records no token</strong></div><div class="field"><span>Watchlist status</span><strong>${r.watchlist?'Included · $50M floor':'Below-floor candidate'}</strong></div></div></section><section class="detail-block"><h3>VALUE BREAKDOWN</h3><div class="breakdown"><span>Market-cap / TVL median</span><strong>${r.model.base_multiple.toFixed(4)}×</strong><span>TVL × base multiple</span><strong>${money(r.tvl_usd*r.model.base_multiple)}</strong><span>7d change · clamped</span><strong>${r.model.growth_pct.toFixed(2)}%</strong><span>Growth multiplier</span><strong>${r.model.growth_multiplier.toFixed(4)}×</strong><span>Maturity multiplier</span><strong>${r.model.maturity_multiplier.toFixed(4)}×</strong><span>Age used</span><strong>${fmt.format(r.model.age_days)} days</strong><span>Implied value</span><strong>${money(r.implied_value_usd)}</strong></div></section><section class="detail-block"><h3>FARM PLAN <span style="color:var(--faint)">· COSTS ARE ESTIMATES</span></h3><ol class="farm-list">${r.farm_steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></section><p class="detail-disclaimer">This protocol records no token in the snapshot. A missing record does not prove no token exists; this model is not a forecast or reward guarantee.</p>`;
    $('detail-backdrop').hidden = false;
    $('detail-panel').classList.add('open');
    $('detail-panel').setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeDetail() {
    $('detail-panel').classList.remove('open');
    $('detail-panel').setAttribute('aria-hidden','true');
    $('detail-backdrop').hidden = true;
    document.body.style.overflow='';
  }
  document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.sort;
    if(sortKey===next) sortDir *= -1; else {sortKey=next;sortDir=next==='rank'||next==='name'?1:-1;}
    renderBoard();
  }));
  $('search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderBoard();});
  $('category-filter').addEventListener('change',e=>{state.category=e.target.value;renderBoard();});
  $('chain-filter').addEventListener('change',e=>{state.chain=e.target.value;renderBoard();});
  $('watch-filter').addEventListener('change',e=>{state.watch=e.target.checked;renderBoard();});
  const reset=()=>{$('search').value='';$('category-filter').value='';$('chain-filter').value='';$('watch-filter').checked=false;Object.assign(state,{search:'',category:'',chain:'',watch:false});renderBoard();};
  $('clear-filters').addEventListener('click',reset); $('empty-reset').addEventListener('click',reset);
  $('board-rows').addEventListener('click',e=>{const row=e.target.closest('tr[data-slug]');if(row)openDetail(row.dataset.slug);});
  $('board-rows').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-slug]')){e.preventDefault();openDetail(e.target.dataset.slug);}});
  $('detail-backdrop').addEventListener('click',closeDetail);
  $('detail-panel').addEventListener('click',e=>{if(e.target.closest('.close-detail'))closeDetail();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();$('search').focus();}});
  renderBoard(); renderLive();
  const params=new URLSearchParams(location.search);
  if(params.get('shot')==='detail') openDetail(params.get('slug')||allRows[0].slug);
  if(params.get('shot')==='filtered') {
    const category=allRows.some(r=>r.category==='Dexs')?'Dexs':allCategories.sort((a,b)=>allRows.filter(r=>r.category===b).length-allRows.filter(r=>r.category===a).length)[0];
    $('category-filter').value=category;state.category=category;renderBoard();
  }
  setTimeout(()=>{window.__shotReady=true;},360);
})();
