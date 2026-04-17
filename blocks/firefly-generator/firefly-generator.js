const FIREFLY_API = 'https://firefly-api.adobe.io/v3/images/generate';

function getConfig(block) {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  return {
    prompt: block.dataset.prompt || '',
    size: block.dataset.size || '1024x1024',
    apiKey: block.dataset.apikey || meta('firefly-api-key'),
    accessToken: block.dataset.accesstoken || meta('firefly-access-token'),
    selectedImageUrl: block.dataset.selectedimageurl || '',
  };
}

function isAuthorMode() {
  return window !== window.top
    || document.documentElement.classList.contains('aue-body')
    || !!document.querySelector('[data-aue-resource]');
}

function renderPublishView(block, url, prompt) {
  block.innerHTML = `
    <figure class="firefly-figure">
      <img src="${url}" alt="${prompt}">
    </figure>
  `;
}

function renderAuthorView(block) {
  const { prompt, selectedImageUrl } = getConfig(block);

  block.innerHTML = `
    <div class="firefly-author-ui">
      <div class="firefly-author-header">
        <span class="firefly-label">Firefly Generator</span>
        <p class="firefly-prompt-display">${prompt || '<em>Set a prompt in block properties</em>'}</p>
        <button class="firefly-generate-btn" type="button">Generate Images</button>
      </div>
      <div class="firefly-status" aria-live="polite"></div>
      <div class="firefly-content"></div>
      ${selectedImageUrl ? `
        <div class="firefly-current">
          <p class="firefly-current-label">Current image:</p>
          <img src="${selectedImageUrl}" alt="${prompt}">
        </div>` : ''}
    </div>
  `;

  const btn = block.querySelector('.firefly-generate-btn');
  const status = block.querySelector('.firefly-status');
  const content = block.querySelector('.firefly-content');

  btn.addEventListener('click', async () => {
    const cfg = getConfig(block);

    if (!cfg.prompt) {
      status.innerHTML = '<p class="firefly-error">No prompt set — type one in the <strong>Image Prompt</strong> field in the properties panel on the right.</p>';
      return;
    }
    if (!cfg.apiKey || !cfg.accessToken) {
      status.innerHTML = '<p class="firefly-error">API key or access token missing. Set them in block properties or as page &lt;meta&gt; tags.</p>';
      return;
    }

    const [width, height] = cfg.size.split('x').map(Number);
    btn.disabled = true;
    btn.textContent = 'Generating…';
    content.innerHTML = '';
    status.innerHTML = '<div class="firefly-loading"><span class="firefly-spinner"></span> Generating 4 variations…</div>';

    try {
      const res = await fetch(FIREFLY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': cfg.apiKey,
          Authorization: `Bearer ${cfg.accessToken}`,
        },
        body: JSON.stringify({ prompt: cfg.prompt, size: { width, height }, numVariations: 4 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Firefly API error ${res.status}`);
      }

      const { outputs = [] } = await res.json();
      if (!outputs.length) throw new Error('No images returned.');

      status.innerHTML = '<p class="firefly-pick-label">Select an image to use:</p>';
      content.innerHTML = `
        <div class="firefly-grid">
          ${outputs.map(({ image }, i) => `
            <button class="firefly-option" data-url="${image.url}" type="button">
              <img src="${image.url}" alt="${cfg.prompt} — option ${i + 1}" loading="lazy">
              <span class="firefly-option-label">Use this</span>
            </button>
          `).join('')}
        </div>
      `;

      content.querySelectorAll('.firefly-option').forEach((optBtn) => {
        optBtn.addEventListener('click', () => {
          const { url } = optBtn.dataset;
          status.innerHTML = '';
          content.innerHTML = `
            <div class="firefly-selected-wrap">
              <img class="firefly-selected-img" src="${url}" alt="${cfg.prompt}">
              <div class="firefly-selected-actions">
                <a class="firefly-btn-secondary" href="${url}" download="firefly-image.jpg">Download</a>
                <button class="firefly-btn-secondary firefly-copy-btn" type="button" data-url="${url}">Copy URL</button>
              </div>
              <p class="firefly-persist-hint">
                Paste this URL into <strong>Selected Image URL</strong> in block properties to persist on the published page.
              </p>
            </div>
          `;
          content.querySelector('.firefly-copy-btn').addEventListener('click', (e) => {
            navigator.clipboard.writeText(e.target.dataset.url);
            e.target.textContent = 'Copied!';
          });

          const current = block.querySelector('.firefly-current');
          if (current) {
            current.querySelector('img').src = url;
          } else {
            block.querySelector('.firefly-author-ui').insertAdjacentHTML('beforeend', `
              <div class="firefly-current">
                <p class="firefly-current-label">Current image:</p>
                <img src="${url}" alt="${cfg.prompt}">
              </div>
            `);
          }
        });
      });
    } catch (err) {
      status.innerHTML = `<p class="firefly-error">Error: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Images';
    }
  });
}

export default function decorate(block) {
  const config = getConfig(block);

  if (!isAuthorMode() && config.selectedImageUrl) {
    renderPublishView(block, config.selectedImageUrl, config.prompt);
    return;
  }

  renderAuthorView(block);

  // Re-render when UE updates block data attributes after saving properties
  const observer = new MutationObserver(() => renderAuthorView(block));
  observer.observe(block, { attributes: true, attributeFilter: ['data-prompt', 'data-api-key', 'data-access-token', 'data-size', 'data-selected-image-url'] });
}
