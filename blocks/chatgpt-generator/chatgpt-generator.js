const OPENAI_API = 'https://api.openai.com/v1/images/generations';

function getConfig(block) {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  return {
    prompt: block.dataset.prompt || '',
    size: block.dataset.size || '1024x1024',
    quality: block.dataset.quality || 'standard',
    apiKey: block.dataset.apikey || meta('openai-api-key'),
  };
}

function storageKey(prompt) {
  return `chatgpt-selected:${prompt}`;
}

function renderSelected(container, url, prompt, onRegenerate) {
  container.innerHTML = `
    <figure class="chatgpt-selected-figure">
      <img src="${url}" alt="${prompt}">
    </figure>
    <div class="chatgpt-selected-actions">
      <a class="button" href="${url}" download="dalle-image.jpg">Download</a>
      <button class="chatgpt-regenerate button secondary" type="button">Regenerate</button>
    </div>
  `;
  container.querySelector('.chatgpt-regenerate').addEventListener('click', onRegenerate);
}

function renderGrid(container, images, prompt, onSelect) {
  container.innerHTML = `
    <p class="chatgpt-pick-label">Select an image to use:</p>
    <div class="chatgpt-grid">
      ${images.map((url, i) => `
        <button class="chatgpt-option" data-url="${url}" type="button" aria-label="Use image ${i + 1}">
          <img src="${url}" alt="${prompt} — option ${i + 1}" loading="lazy">
          <span class="chatgpt-option-label">Use this</span>
        </button>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('.chatgpt-option').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.url));
  });
}

async function callOpenAI(prompt, size, quality, apiKey) {
  const res = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

export default function decorate(block) {
  const { prompt, size, quality, apiKey } = getConfig(block);

  block.innerHTML = `
    <div class="chatgpt-ui">
      <div class="chatgpt-header">
        <p class="chatgpt-prompt-display">${prompt || '<em>No prompt set — open block properties to add one.</em>'}</p>
        <button class="chatgpt-generate-btn button primary" type="button" ${!prompt ? 'disabled' : ''}>
          Generate Images
        </button>
      </div>
      <div class="chatgpt-status" aria-live="polite"></div>
      <div class="chatgpt-content"></div>
    </div>
  `;

  const generateBtn = block.querySelector('.chatgpt-generate-btn');
  const status = block.querySelector('.chatgpt-status');
  const content = block.querySelector('.chatgpt-content');

  const savedUrl = prompt ? localStorage.getItem(storageKey(prompt)) : null;
  if (savedUrl) {
    generateBtn.textContent = 'Regenerate';
    renderSelected(content, savedUrl, prompt, () => startGeneration());
  }

  async function startGeneration() {
    if (!apiKey) {
      status.innerHTML = '<p class="chatgpt-error">OpenAI API key missing. Set it in block properties or as a &lt;meta name="openai-api-key"&gt; tag.</p>';
      return;
    }

    content.innerHTML = '';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    status.innerHTML = '<div class="chatgpt-loading"><span class="chatgpt-spinner"></span> Generating 4 variations…</div>';

    try {
      // DALL-E 3 supports n=1 only — run 4 requests in parallel
      const urls = await Promise.all(
        Array.from({ length: 4 }, () => callOpenAI(prompt, size, quality, apiKey)),
      );

      status.innerHTML = '';
      renderGrid(content, urls, prompt, (url) => {
        localStorage.setItem(storageKey(prompt), url);
        generateBtn.textContent = 'Regenerate';
        renderSelected(content, url, prompt, () => startGeneration());
      });
    } catch (err) {
      status.innerHTML = `<p class="chatgpt-error">Error: ${err.message}</p>`;
    } finally {
      generateBtn.disabled = false;
      if (generateBtn.textContent === 'Generating…') generateBtn.textContent = 'Generate Images';
    }
  }

  generateBtn.addEventListener('click', () => startGeneration());
}
