const OPENAI_API = 'https://api.openai.com/v1/images/generations';

function getConfig(block) {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  return {
    prompt: block.dataset.prompt || '',
    size: block.dataset.size || '1024x1024',
    quality: block.dataset.quality || 'standard',
    apiKey: block.dataset.apikey || meta('openai-api-key'),
    selectedImageUrl: block.dataset.selectedimageurl || '',
  };
}

function isAuthorMode() {
  return window !== window.top
    || document.documentElement.classList.contains('aue-body')
    || !!document.querySelector('[data-aue-resource]');
}

async function fetchOneImage(prompt, size, quality, apiKey) {
  const res = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3', prompt, n: 1, size, quality,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

function renderPublishView(block, url, prompt) {
  block.innerHTML = `
    <figure class="chatgpt-figure">
      <img src="${url}" alt="${prompt}">
    </figure>
  `;
}

function renderAuthorView(block) {
  const { prompt, selectedImageUrl } = getConfig(block);

  block.innerHTML = `
    <div class="chatgpt-author-ui">
      <div class="chatgpt-author-header">
        <span class="chatgpt-label">DALL·E 3</span>
        <p class="chatgpt-prompt-display">${prompt || '<em>Set a prompt in block properties</em>'}</p>
        <button class="chatgpt-generate-btn" type="button">Generate Images</button>
      </div>
      <div class="chatgpt-status" aria-live="polite"></div>
      <div class="chatgpt-content"></div>
      ${selectedImageUrl ? `
        <div class="chatgpt-current">
          <p class="chatgpt-current-label">Current image:</p>
          <img src="${selectedImageUrl}" alt="${prompt}">
        </div>` : ''}
    </div>
  `;

  const btn = block.querySelector('.chatgpt-generate-btn');
  const status = block.querySelector('.chatgpt-status');
  const content = block.querySelector('.chatgpt-content');

  btn.addEventListener('click', async () => {
    const cfg = getConfig(block);

    if (!cfg.prompt) {
      status.innerHTML = '<p class="chatgpt-error">No prompt set — type one in the <strong>Image Prompt</strong> field in the properties panel on the right.</p>';
      return;
    }
    if (!cfg.apiKey) {
      status.innerHTML = '<p class="chatgpt-error">OpenAI API key missing. Set it in block properties or as a &lt;meta name="openai-api-key"&gt; tag.</p>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating…';
    content.innerHTML = '';
    status.innerHTML = '<div class="chatgpt-loading"><span class="chatgpt-spinner"></span> Generating 4 variations…</div>';

    try {
      const generate = () => fetchOneImage(cfg.prompt, cfg.size, cfg.quality, cfg.apiKey);
      const urls = await Promise.all(Array.from({ length: 4 }, generate));

      status.innerHTML = '<p class="chatgpt-pick-label">Select an image to use:</p>';
      content.innerHTML = `
        <div class="chatgpt-grid">
          ${urls.map((url, i) => `
            <button class="chatgpt-option" data-url="${url}" type="button">
              <img src="${url}" alt="${cfg.prompt} — option ${i + 1}" loading="lazy">
              <span class="chatgpt-option-label">Use this</span>
            </button>
          `).join('')}
        </div>
      `;

      content.querySelectorAll('.chatgpt-option').forEach((optBtn) => {
        optBtn.addEventListener('click', () => {
          const { url } = optBtn.dataset;
          status.innerHTML = '';
          content.innerHTML = `
            <div class="chatgpt-selected-wrap">
              <img class="chatgpt-selected-img" src="${url}" alt="${cfg.prompt}">
              <div class="chatgpt-selected-actions">
                <a class="chatgpt-btn-secondary" href="${url}" download="dalle-image.jpg">Download</a>
                <button class="chatgpt-btn-secondary chatgpt-copy-btn" type="button" data-url="${url}">Copy URL</button>
              </div>
              <p class="chatgpt-persist-hint">
                Paste this URL into <strong>Selected Image URL</strong> in block properties to persist on the published page.
              </p>
            </div>
          `;
          content.querySelector('.chatgpt-copy-btn').addEventListener('click', (e) => {
            navigator.clipboard.writeText(e.target.dataset.url);
            e.target.textContent = 'Copied!';
          });

          const current = block.querySelector('.chatgpt-current');
          if (current) {
            current.querySelector('img').src = url;
          } else {
            block.querySelector('.chatgpt-author-ui').insertAdjacentHTML('beforeend', `
              <div class="chatgpt-current">
                <p class="chatgpt-current-label">Current image:</p>
                <img src="${url}" alt="${cfg.prompt}">
              </div>
            `);
          }
        });
      });
    } catch (err) {
      status.innerHTML = `<p class="chatgpt-error">Error: ${err.message}</p>`;
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

  // Re-render when UE updates block data attributes (e.g. after saving properties)
  const observer = new MutationObserver(() => renderAuthorView(block));
  observer.observe(block, { attributes: true, attributeFilter: ['data-prompt', 'data-api-key', 'data-size', 'data-quality', 'data-selected-image-url'] });
}
