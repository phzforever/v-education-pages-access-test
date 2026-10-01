import { parseRoute, route, renderPage, date } from './render.js?v=20261001-model-round';

const app = document.getElementById('app');
const notice = document.getElementById('notice');
let snapshot;
function render() {
  const r = parseRoute(location.hash);
  app.innerHTML = renderPage(snapshot, r);
  document.title = `${app.querySelector('h1')?.textContent ?? '教育动态'} · V 教育热点`;
  notice.classList.toggle('demo', r.mode === 'demo');
  notice.textContent = r.mode === 'demo'
    ? '功能演示：全部事件和来源均为虚构样例，仅用于测试热点榜与日报。榜单固定回放，不代表真实热点。'
    : '公开阅读测试：真实来源内容经模型筛选和摘要整理。关键词线索需核验原文；内容更新以快照时间为准。';
  document.getElementById('updated').textContent = `内容快照：${date(snapshot.exportedAt, true)}（北京时间）`;
  for (const a of document.querySelectorAll('[data-nav]')) {
    a.href = route(a.dataset.nav, r.mode);
    if (r.path === a.dataset.nav || (a.dataset.nav !== '/' && r.path.startsWith(a.dataset.nav + '/'))) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === r.mode));
    button.hidden = button.dataset.mode === 'demo' && !snapshot.demo;
  }
  for (const form of app.querySelectorAll('form[role=search]')) form.addEventListener('submit', e => {
    e.preventDefault();
    const q = new FormData(form).get('q').trim();
    location.hash = route('/all', r.mode, { q, category: r.params.get('category') });
  });
}
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
  const r = parseRoute(location.hash);
  // Details can have IDs that exist in only one dataset; switching returns to that section.
  const path = r.path.startsWith('/items/') ? '/all' : r.path.startsWith('/story/') ? '/hot' : r.path.startsWith('/daily/') ? '/daily' : r.path;
  location.hash = route(path, button.dataset.mode);
});
try {
  const response = await fetch(new URL('./snapshot.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error('内容快照请求失败');
  snapshot = await response.json();
  if (snapshot.version !== 1) throw new Error('内容快照版本不匹配');
  render();
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
} catch {
  app.replaceChildren();
  const title = document.createElement('h1'); title.textContent = '内容暂时无法加载';
  const text = document.createElement('p'); text.textContent = '请刷新重试。若仍无法打开，请将这个页面地址反馈给维护者。';
  const retry = document.createElement('button'); retry.className = 'button'; retry.textContent = '刷新重试'; retry.onclick = () => location.reload();
  app.append(title, text, retry);
}
