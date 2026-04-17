const FIREFLY_API = 'https://firefly-api.adobe.io/v3/images/generate';

function readConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [key, val] = row.children;
    if (key && val) config[key.textContent.trim().toLowerCase().replace(/\s+/g, '-')] = val.textContent.trim();
  });
  // fall back to page <meta> tags
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  config['api-key'] = config['api-key'] || meta('firefly-api-key');
  config['access-token'] = config['access-token'] || meta('firefly-access-token');
  return config;
}

function buildUI(config) {
  const ui = document.createElement('div');
  ui.className = 'firefly-generator-ui';
  ui.innerHTML = `
    <div class="firefly-form">
      <textarea class="firefly-prompt" placeholder="${config.placeholder || 'Describe the image you want to generate…'}" rows="3"></textarea>
      <div class="firefly-controls">
        <select class="firefly-size" aria-label="Image size">
          <option value="1024x1024">Square (1024 × 1024)</option>
          <option value="1792x1024">Landscape (1792 × 1024)</option>
          <option value="1024x1792">Portrait (1024 × 1792)</option>
        </select>
        <button class="firefly-btn button primary" type="button">Generate</button>
      </div>
    </div>
    <div class="firefly-results" aria-live="polite"></div>
  `;
  return ui;
}

async function generate(prompt, size, apiKey, accessToken) {
  const [width, height] = size.split('x').map(Number);
  const res = await fetch(FIREFLY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ prompt, size: { width, height }, numVariations: 1 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Firefly API error ${res.status}`);
  }
  return res.json();
}

export default function decorate(block) {
  const config = readConfig(block);
  const ui = buildUI(config);
  block.replaceChildren(ui);

  const promptEl = ui.querySelector('.firefly-prompt');
  const sizeEl = ui.querySelector('.firefly-size');
  const btn = ui.querySelector('.firefly-btn');
  const results = ui.querySelector('.firefly-results');

  btn.addEventListener('click', async () => {
    const prompt = promptEl.value.trim();
    if (!prompt) {
      promptEl.focus();
      return;
    }

    const apiKey = config['api-key'];
    const accessToken = config['access-token'];
    if (!apiKey || !accessToken) {
      results.innerHTML = '<p class="firefly-error">Missing API key or access token. Add them as block fields or as &lt;meta name="firefly-api-key"&gt; / &lt;meta name="firefly-access-token"&gt; in the page.</p>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating…';
    results.innerHTML = '<div class="firefly-loading"><span class="firefly-spinner"></span> Generating your image…</div>';

    try {
      const data = await generate(prompt, sizeEl.value, apiKey, accessToken);
      const outputs = data.outputs || [];
      if (!outputs.length) throw new Error('No images returned.');

      results.innerHTML = outputs.map(({ image }) => `
        <div class="firefly-result-item">
          <img src="${image.url}" alt="${prompt}" loading="lazy">
          <a class="button" href="${image.url}" download="firefly-image.jpg">Download</a>
        </div>
      `).join('');
    } catch (err) {
      results.innerHTML = `<p class="firefly-error">Error: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate';
    }
  });
}
