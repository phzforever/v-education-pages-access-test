// Rendering is shared by the browser and focused tests. All source text is escaped.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function route(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (key !== 'mode' && value !== null && value !== undefined && value !== '') params.set(key, String(value));
  return `#${path}${params.size ? '?' + params : ''}`;
}
export function parseRoute(hash) {
  const url = new URL((hash || '#/').slice(1), 'https://reader.invalid');
  url.searchParams.delete('mode');
  return { path: url.pathname, params: url.searchParams };
}
export function date(value, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value));
}
const h = escapeHtml;
const link = (path, query) => h(route(path, query));
function original(url) {
  const safe = safeUrl(url);
  return safe ? `<a class="source-link" href="${h(safe)}" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>` : '<span class="meta">原文链接暂不可用</span>';
}
export function itemCard(item, categories = []) {
  const cat = categories.find(c => c.key === item.category)?.label;
  return `<article class="card" data-item-id="${h(item.id)}">
    <a class="title" href="${link('/items/' + encodeURIComponent(item.id))}">${h(item.title)}</a>
    <div class="meta"><span>${h(item.source)}</span><time>${h(date(item.publishedAt ?? item.timelineAt, true))}</time>${cat ? `<span>${h(cat)}</span>` : ''}</div>
    <p class="summary">${h(item.summary || '摘要暂未提供，请核对原文。')}</p>
    <div class="tags">${(item.tags ?? []).map(t => `<a class="tag" href="${link('/all', { tag: t })}">${h(t)}</a>`).join('')}</div>
    <div class="card-foot"><span class="selected">${item.selected ? '精选' : ''}</span>${original(item.originalUrl)}</div>
  </article>`;
}
export function filterItems(items, { path, params }) {
  const q = (params.get('q') ?? '').trim().slice(0, 200).toLocaleLowerCase();
  const cat = params.get('category');
  const tag = params.get('tag');
  return items.filter(i => (path !== '/' || i.selected) && (!cat || i.category === cat) && (!tag || i.tags.includes(tag)) && (!q || [i.title, i.originalTitle, i.summary, i.source, ...i.tags].join(' ').toLocaleLowerCase().includes(q)));
}
function empty(title, text) {
  return `<div class="empty"><h3>${h(title)}</h3><p>${h(text)}</p></div>`;
}
function toolbar(snapshot, r) {
  const cat = r.params.get('category');
  const keep = { q: r.params.get('q'), tag: r.params.get('tag') };
  return `<div class="toolbar"><nav class="filters" aria-label="分类筛选">${[{ key: '', label: '全部' }, ...snapshot.categories].map(c => `<a ${c.key === (cat || '') ? 'aria-current="page"' : ''} href="${link(r.path, { ...keep, category: c.key })}">${h(c.label)}</a>`).join('')}</nav>
    <form class="search" role="search"><label class="sr-only" hidden for="search-q">搜索教育动态</label><input id="search-q" name="q" placeholder="搜索标题、摘要、标签…" aria-label="搜索教育动态" maxlength="200" value="${h(r.params.get('q') ?? '')}"><button type="submit">搜索</button></form></div>`;
}
function listing(snapshot, data, r) {
  const items = filterItems(data.items, r);
  const perPage = 20, pages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(pages, Math.max(1, parseInt(r.params.get('page') || '1', 10) || 1));
  const title = r.params.get('q') ? `搜索“${r.params.get('q')}”` : r.params.get('tag') ? `#${r.params.get('tag')}` : r.path === '/' ? '精选' : '全部教育动态';
  const pageItems = items.slice((page - 1) * perPage, page * perPage);
  let lastDay = '';
  const cards = pageItems.map(i => {
    const day = date(i.timelineAt);
    const header = lastDay !== day ? `<div class="day-title">${h(day)}</div>` : '';
    lastDay = day;
    return header + itemCard(i, snapshot.categories);
  }).join('');
  const pagination = pages > 1 ? `<nav class="pagination" aria-label="分页">${Array.from({ length: pages }, (_, n) => `<a ${n + 1 === page ? 'aria-current="page"' : ''} href="${link(r.path, { ...Object.fromEntries(r.params), page: n + 1 })}">${n + 1}</a>`).join('')}</nav>` : '';
  return `<h1>${h(title)}</h1><p class="subline">共 ${items.length} 条 · 按时间排序${r.params.get('q') ? ' · 搜索当前快照的标题、摘要、标签和来源' : ''}</p>${toolbar(snapshot, r)}${cards || empty('没有找到相关内容', '换个类别或搜索词再试。')}${pagination}`;
}
function hotPage(data, r) {
  return `<h1>热点榜</h1><p class="subline">按事件排序 · 最近 ${h(data.hot.windowHours)} 小时 · ${data.hot.computedAt ? '榜单计算于 ' + h(date(data.hot.computedAt, true)) : '尚无榜单快照'}</p>
    <details class="card"><summary>热度怎么算？</summary><p class="summary">沿用原站规则：48 小时内，每个独立来源只计一次；24 小时权重减半。热度为加权来源数乘以 10，至少两个参与来源且含一个编辑来源才进入榜单。页面显示导出时已有的计算结果。</p></details>
    ${data.hot.entries.map(e => `<article class="card hot-card"><span class="rank">${e.rank}</span><div><a class="title" href="${link('/story/' + encodeURIComponent(e.id))}">${h(e.title)}</a><div class="meta"><span>${e.sourceCount} 个报道来源 · ${e.participantCount} 个独立参与来源</span><span class="badge">${h(({ new: '新上榜', up: '上升', down: '下降', flat: '持平', unknown: '趋势未提供' })[e.trend])}${e.trendPct !== null ? ' ' + h(e.trendPct) + '%' : ''}</span></div><p class="summary">${h(e.summary)}</p><div class="meta">${h(e.sourceNames.join(' · '))}</div></div><div class="heat">${h(e.heat)}<small>热度</small></div></article>`).join('') || empty('暂无上榜事件', '最近 48 小时内暂未形成符合上榜条件的教育事件。')}`;
}
function citationCard(c) {
  return `<article class="card"><h3>${c.itemId ? `<a href="${link('/items/' + encodeURIComponent(c.itemId))}">${h(c.title)}</a>` : h(c.title)}</h3><p class="summary">${h(c.summary)}</p><div class="card-foot"><span class="meta">${h(c.source)}</span>${c.available ? original(c.originalUrl) : ''}</div></article>`;
}
function dailyPage(data, r) {
  const key = r.path.split('/')[2];
  if (!key) return `<h1>教育日报</h1><p class="subline">已发布 ${data.reports.length} 期 · 每期汇总前一日 08:00 至当日 08:00 的新增精选</p>${data.reports.map(report => `<article class="card"><a class="title" href="${link('/daily/' + report.key)}">${h(report.title)}</a><div class="meta">${h(report.key)} · ${report.sections.reduce((n, s) => n + s.items.length, 0)} 条主要内容</div><p class="summary">${h(report.lead)}</p></article>`).join('') || empty('暂无已发布日报', '日报汇总当期新增精选，历史补采内容不计入。当前尚未启用自动成刊，已有内容也暂未形成符合规则的日报。')}`;
  const report = data.reports.find(x => x.key === key);
  if (!report) return empty('没有找到这期日报', '请返回日报目录选择已发布的日期。');
  return `<a class="back" href="${link('/daily')}">← 日报目录</a><div class="report-head"><div class="report-name">教育日报</div><div class="meta">${h(report.key)} · 窗口 ${h(date(report.windowStart, true))} — ${h(date(report.windowEnd, true))}</div><h1>${h(report.title)}</h1><p class="lead">${h(report.lead)}</p></div>
    ${report.highlights.length ? '<h2>今日要点</h2>' + report.highlights.map(c => citationCard(c)).join('') : ''}
    ${report.sections.map(s => `<h2>${h(s.label)}</h2>${s.summary ? `<p class="summary">${h(s.summary)}</p>` : ''}${s.items.map(c => citationCard(c)).join('')}`).join('')}
    ${report.flashes.length ? '<h2>简讯</h2>' + report.flashes.map(c => citationCard(c)).join('') : ''}`;
}
const repo = 'https://github.com/phzforever/v-education-pages-access-test/issues';
export const legal = {
  terms: `<h1>使用说明</h1><p>版本：2026-10-02 · 本说明适用于 GitHub Pages 托管的 V 教育热点。项目维护入口为 GitHub 用户 phzforever 的 V 教育热点仓库。</p><h2>内容与用途</h2><p>本站展示公开来源的标题、摘要和原文链接，部分内容经过模型筛选与摘要整理，关键词线索需要核验原文。</p><p>原文版权归各来源所有。本站不提供原文全文或转载授权。考试、申请、竞赛、签证和产品信息请以来源原文及相关机构的最新公告为准。</p><h2>更新与可用性</h2><p>这是定期导出后发布的内容快照。页面显示快照时间，暂未配置自动更新，不保证完整、准确或持续可用。内容更正、撤回和新刊会在下一次发布快照后反映到网页。</p><h2>联系与更正</h2><p>如需更正、下架或反馈访问问题，请通过<a href="${repo}" target="_blank" rel="noopener noreferrer">GitHub 仓库 Issues</a>提交。提交内容在 GitHub 上公开，请勿填写密钥、个人证件或其他敏感资料。</p>`,
  privacy: `<h1>隐私说明</h1><p>版本：2026-10-02 · 适用于 GitHub Pages 托管的 V 教育热点。项目维护入口为 GitHub 用户 phzforever 的 V 教育热点仓库。</p><h2>浏览本站</h2><p>本站无访客注册、登录或反馈表单，不接入访客统计。搜索和分类筛选在浏览器中对当前内容快照执行；本站应用不会将搜索词提交给项目后端或模型服务，不保存收藏、已读记录或个人档案。</p><h2>托管与第三方</h2><p>网页由 GitHub Pages 托管。GitHub 官方说明会为安全目的记录访客 IP，处理方式按其<a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" target="_blank" rel="noopener noreferrer">托管方说明</a>及<a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">隐私政策</a>执行。本项目无法控制 GitHub 日志的保存期限。</p><p>点击原文链接、GitHub Issues 或其他外部链接后，将访问对应网站，适用其隐私政策。在 GitHub Issues 提交的反馈及账号信息由 GitHub 处理；Issues 内容公开。</p><h2>联系</h2><p>本站自身不保存访客账号或反馈数据库。内容和隐私相关问题可通过<a href="${repo}" target="_blank" rel="noopener noreferrer">GitHub 仓库 Issues</a>联系维护者；请勿在公开反馈中提交敏感个人资料。</p>`,
};
export function renderPage(snapshot, r) {
  const data = snapshot.live;
  if (!data) return empty('内容暂未更新', '请稍后重试。');
  if (r.path === '/' || r.path === '/all') return listing(snapshot, data, r);
  if (r.path === '/hot') return hotPage(data, r);
  if (/^\/daily(?:\/[^/]+)?$/.test(r.path)) return dailyPage(data, r);
  if (r.path.startsWith('/items/')) {
    const item = data.items.find(i => i.id === r.path.split('/')[2]);
    if (!item) return empty('没有找到这条内容', '此内容未包含在当前公开快照中。');
    return `<a class="back" href="${link('/all')}">← 全部动态</a><article class="detail card"><h1>${h(item.title)}</h1><p class="original-title">${h(item.originalTitle)}</p><div class="meta">${h(item.source)} · ${h(date(item.publishedAt ?? item.timelineAt, true))}</div><p class="summary">${h(item.summary)}</p>${item.reason ? `<h2>收录说明</h2><p class="summary">${h(item.reason)}</p>` : ''}<div class="card-foot">${original(item.originalUrl)}</div>${item.storyId ? `<p><a class="source-link" href="${link('/story/' + item.storyId)}">查看关联事件 →</a></p>` : ''}</article>`;
  }
  if (r.path.startsWith('/story/')) {
    const story = data.stories.find(s => s.id === r.path.split('/')[2]);
    if (!story) return empty('没有找到此事件', '此事件未包含在当前公开快照中。');
    return `<a class="back" href="${link('/hot')}">← 热点榜</a><h1>${h(story.title)}</h1><p class="subline">${story.sourceCount} 个来源 · ${story.reportCount} 篇报道 · 最新 ${h(date(story.latestAt, true))}</p><p class="lead">${h(story.summary)}</p><h2>事件报道</h2>${story.reports.map(i => itemCard({ ...i, timelineAt: i.publishedAt, tags: [] })).join('')}`;
  }
  if (r.path === '/topics') {
    const counts = new Map();
    for (const i of data.items) for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return `<h1>主题</h1><p class="subline">按内容标签浏览当前快照</p><div class="topic-grid">${[...counts].sort((a, b) => b[1] - a[1]).map(([tag, count]) => `<a href="${link('/all', { tag })}">${h(tag)}<small>${count} 条动态</small></a>`).join('')}</div>`;
  }
  if (r.path === '/terms' || r.path === '/privacy') return `<article class="prose">${legal[r.path.slice(1)]}</article>`;
  if (r.path === '/about') return `<article class="prose"><h1>关于 V 教育热点</h1><p>${h(snapshot.site.description)}</p><div class="stats"><div><strong>${data.items.length}</strong><span>公开动态</span></div><div><strong>${data.items.filter(i => i.selected).length}</strong><span>精选</span></div><div><strong>${data.hot.entries.length}</strong><span>热点事件</span></div><div><strong>${data.reports.length}</strong><span>日报</span></div></div><h2>当前版本</h2><p>本站聚合教育行业资讯，展示标题、摘要和原文链接。实际信息与重要安排请核对原始来源。</p><p>网页展示截至 ${h(date(snapshot.exportedAt, true))} 导出的内容。采集、筛选与成刊在后端运行；当前没有启用持续自动采集或自动更新网页。新的资料需要重新导出并发布后才会出现。</p><p>可通过<a href="${repo}" target="_blank" rel="noopener noreferrer">GitHub Issues</a>反馈问题。</p></article>`;
  return empty('页面不存在', '请通过导航进入已有页面。');
}
