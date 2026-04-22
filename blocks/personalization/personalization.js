function isAuthorMode() {
  return window !== window.top
    || document.documentElement.classList.contains('aue-body');
}

// Block variant class "segment-vip" → { param: 'segment', value: 'vip' }
function getCondition(block) {
  const variant = [...block.classList]
    .find((c) => c !== 'block' && c !== 'personalization');
  if (!variant) return { param: 'segment', value: 'vip' };
  const sep = variant.indexOf('-');
  if (sep < 1) return { param: 'segment', value: variant };
  return { param: variant.slice(0, sep), value: variant.slice(sep + 1) };
}

export default function decorate(block) {
  const { param, value } = getCondition(block);

  // One row, two cells: [0] shown when param matches, [1] default
  const row = block.querySelector(':scope > div');
  if (!row) return;

  const [matchCell, defaultCell] = [...row.querySelectorAll(':scope > div')];
  if (!matchCell) return;

  if (isAuthorMode()) {
    row.classList.add('personalization-row');
    const badge = (el, label, type) => {
      const b = document.createElement('span');
      b.className = `personalization-badge personalization-${type}`;
      b.textContent = label;
      el.prepend(b);
      el.classList.add(`personalization-cell-${type}`);
    };
    badge(matchCell, `${param} = ${value}`, 'match');
    if (defaultCell) badge(defaultCell, 'default', 'default');
    return;
  }

  const actual = new URLSearchParams(window.location.search).get(param);
  block.replaceChildren(actual === value ? matchCell : (defaultCell ?? matchCell));
}
