function isAuthorMode() {
  return window !== window.top
    || document.documentElement.classList.contains('aue-body');
}

export default function decorate(block) {
  const paramName = block.dataset.urlParam || 'segment';
  const rows = [...block.querySelectorAll(':scope > div')];

  if (isAuthorMode()) {
    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        row.style.display = 'none';
      } else {
        const id = rows[i - 1]?.textContent.trim().toLowerCase() || 'default';
        const isDefault = !id || id === 'default';
        const badge = document.createElement('span');
        badge.className = `personalization-badge ${isDefault ? 'standard' : 'vip'}`;
        badge.textContent = isDefault ? 'Default / Standard' : `${paramName}=${id}`;
        row.prepend(badge);
        row.classList.add('personalization-variant', isDefault ? 'personalization-standard' : 'personalization-vip');
      }
    });
    return;
  }

  const currentValue = (new URLSearchParams(window.location.search).get(paramName) || '').toLowerCase();

  const variants = [];
  for (let i = 0; i + 1 < rows.length; i += 2) {
    const id = rows[i].textContent.trim().toLowerCase() || 'default';
    variants.push({ id, content: rows[i + 1] });
  }

  const match = variants.find(({ id }) => id === currentValue)
    || variants.find(({ id }) => id === 'default')
    || variants[variants.length - 1];

  if (match?.content) block.replaceChildren(match.content);
}
