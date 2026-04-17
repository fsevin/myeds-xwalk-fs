const FIREFLY_API = 'https://firefly-api.adobe.io/v3/images/generate';

function getConfig(block) {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  return {
    prompt: block.dataset.prompt || '',
    size: block.dataset.size || '1024x1024',
    apiKey: block.dataset.apikey || meta('firefly-api-key'),
    accessToken: block.dataset.accesstoken || meta('firefly-access-token'),
  };
}

function storageKey(prompt) {
  return `firefly-selected:${prompt}`;
}

function renderSelected(container, url, prompt, onRegenerate) {
  container.innerHTML = `
    <figure class="firefly-selected-figure">
      <img src="${url}" alt="${prompt}">
    </figure>
    <div class="firefly-selected-actions">
      <a class="button" href="${url}" download="firefly-image.jpg">Download</a>
      <button class="firefly-regenerate button secondary" type="button">Regenerate</button>
    </div>
  `;
  container.querySelector('.firefly-regenerate').addEventListener('click', onRegenerate);
}

function renderGrid(container, outputs, prompt, onSelect) {
  container.innerHTML = `
    <p class="firefly-pick-label">Select an image to use:</p>
    <div class="firefly-grid">
      ${outputs.map(({ image }, i) => `
        <button class="firefly-option" data-url="${image.url}" type="button" aria-label="Use image ${i + 1}">
          <img src="${image.url}" alt="${prompt} — option ${i + 1}" loading="lazy">
          <span class="firefly-option-label">Use this</span>
        </button>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('.firefly-option').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.url));
  });
}

async function callFirefly(prompt, size, apiKey, accessToken) {
  const [width, height] = size.split('x').map(Number);
  const res = await fetch(FIREFLY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ prompt, size: { width, height }, numVariations: 4 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Firefly API error ${res.status}`);
  }
  return res.json();
}

export default function decorate(block) {
  const { prompt, size, apiKey, accessToken } = getConfig(block);

  block.innerHTML = `
    <div class="firefly-ui">
      <div class="firefly-header">
        <p class="firefly-prompt-display">${prompt || '<em>No prompt set — open block properties to add one.</em>'}</p>
        <button class="firefly-generate-btn button primary" type="button" ${!prompt ? 'disabled' : ''}>
          Generate Images
        </button>
      </div>
      <div class="firefly-status" aria-live="polite"></div>
      <div class="firefly-content"></div>
    </div>
  `;

  const generateBtn = block.querySelector('.firefly-generate-btn');
  const status = block.querySelector('.firefly-status');
  const content = block.querySelector('.firefly-content');

  const savedUrl = prompt ? localStorage.getItem(storageKey(prompt)) : null;
  if (savedUrl) {
    generateBtn.textContent = 'Regenerate';
    renderSelected(content, savedUrl, prompt, () => startGeneration());
  }

  async function startGeneration() {
    if (!apiKey || !accessToken) {
      status.innerHTML = '<p class="firefly-error">API key or access token missing. Set them in block properties or as page &lt;meta&gt; tags.</p>';
      return;
    }

    content.innerHTML = '';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    status.innerHTML = '<div class="firefly-loading"><span class="firefly-spinner"></span> Generating 4 variations…</div>';

    try {
      const data = await callFirefly(prompt, size, apiKey, accessToken);
      const outputs = data.outputs || [];
      if (!outputs.length) throw new Error('No images returned from Firefly.');

      status.innerHTML = '';
      renderGrid(content, outputs, prompt, (url) => {
        localStorage.setItem(storageKey(prompt), url);
        generateBtn.textContent = 'Regenerate';
        renderSelected(content, url, prompt, () => startGeneration());
      });
    } catch (err) {
      status.innerHTML = `<p class="firefly-error">Error: ${err.message}</p>`;
    } finally {
      generateBtn.disabled = false;
      if (generateBtn.textContent === 'Generating…') generateBtn.textContent = 'Generate Images';
    }
  }

  generateBtn.addEventListener('click', () => startGeneration());
}
