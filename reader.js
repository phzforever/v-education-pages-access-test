import { parseRoute, route, renderPage, date } from './render.js?v=20261002-published';

const app = document.getElementById('app');
let snapshot;
function render() {
  const r = parseRoute(location.hash);
  app.innerHTML = renderPage(snapshot, r);
  document.title = `${app.querySelector('h1')?.textContent ?? '教育动态'} · V 教育热点`;
  document.getElementById('updated').textContent = `内容更新于 ${date(snapshot.exportedAt, true)}（北京时间）`;
  for (const a of document.querySelectorAll('[data-nav]')) {
    a.href = route(a.dataset.nav);
    if (r.path === a.dataset.nav || (a.dataset.nav !== '/' && r.path.startsWith(a.dataset.nav + '/'))) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  for (const form of app.querySelectorAll('form[role=search]')) form.addEventListener('submit', e => {
    e.preventDefault();
    const q = new FormData(form).get('q').trim();
    location.hash = route('/all', { q, category: r.params.get('category') });
  });
}
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
