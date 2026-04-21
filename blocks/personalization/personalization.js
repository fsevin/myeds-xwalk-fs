function isAuthorMode() {
  return window !== window.top
    || document.documentElement.classList.contains('aue-body')
    || !!document.querySelector('[data-aue-resource]');
}

export default function decorate(block) {
  const paramName = block.dataset.urlParam || 'segment';
  const vipValue = block.dataset.vipValue || 'vip';
  const rows = [...block.querySelectorAll(':scope > div')];
  const [vipRow, standardRow] = rows;

  if (isAuthorMode()) {
    if (vipRow) {
      const badge = document.createElement('span');
      badge.className = 'personalization-badge vip';
      badge.textContent = `VIP (${paramName}=${vipValue})`;
      vipRow.prepend(badge);
      vipRow.classList.add('personalization-variant', 'personalization-vip');
    }
    if (standardRow) {
      const badge = document.createElement('span');
      badge.className = 'personalization-badge standard';
      badge.textContent = 'Standard';
      standardRow.prepend(badge);
      standardRow.classList.add('personalization-variant', 'personalization-standard');
    }
    return;
  }

  const segment = new URLSearchParams(window.location.search).get(paramName);
  const showVip = segment === vipValue;
  const activeRow = showVip ? vipRow : (standardRow || vipRow);

  if (activeRow) block.replaceChildren(activeRow);
}
