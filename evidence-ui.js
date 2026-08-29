// v29: show the evidence sentence and source behind each automatically extracted fact.
(function () {
  if (typeof renderResult !== 'function') return;
  const previousRenderResult = renderResult;

  function removeExistingEvidence() {
    document.querySelectorAll('.evidence-box').forEach(node => node.remove());
  }

  function makeEvidenceBox(item, labelText) {
    if (!item || !item.sentence || !item.url) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'evidence-box';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'evidence-toggle';
    button.textContent = 'הצג מקור וראיה';
    button.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('div');
    panel.className = 'evidence-panel hidden';

    const heading = document.createElement('p');
    heading.className = 'evidence-heading';
    heading.textContent = `הראיה עבור ${labelText}`;

    const quote = document.createElement('blockquote');
    quote.className = 'evidence-quote';
    quote.textContent = item.sentence;

    const source = document.createElement('a');
    source.className = 'text-link evidence-source';
    source.href = item.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = item.label || 'פתיחת המקור';

    panel.append(heading, quote, source);
    button.addEventListener('click', () => {
      const isOpen = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden', isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
      button.textContent = isOpen ? 'הצג מקור וראיה' : 'הסתר מקור וראיה';
    });

    wrapper.append(button, panel);
    return wrapper;
  }

  function attachEvidence(targetId, item, labelText) {
    const target = document.getElementById(targetId);
    const card = target?.closest('.facts-grid > div');
    const box = makeEvidenceBox(item, labelText);
    if (card && box) card.appendChild(box);
  }

  function attachFormerNamesEvidence(items) {
    if (!Array.isArray(items) || !items.length) return;
    const target = document.getElementById('formerNames');
    const card = target?.closest('.facts-grid > div');
    if (!card) return;

    const valid = items.filter(item => item?.sentence && item?.url);
    if (!valid.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'evidence-box';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'evidence-toggle';
    button.textContent = 'הצג מקור וראיה';
    button.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('div');
    panel.className = 'evidence-panel hidden';
    const heading = document.createElement('p');
    heading.className = 'evidence-heading';
    heading.textContent = 'הראיות עבור שמות קודמים';
    panel.appendChild(heading);

    valid.forEach(item => {
      const quote = document.createElement('blockquote');
      quote.className = 'evidence-quote';
      quote.textContent = item.value ? `${item.value}: ${item.sentence}` : item.sentence;
      const source = document.createElement('a');
      source.className = 'text-link evidence-source';
      source.href = item.url;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = item.label || 'פתיחת המקור';
      panel.append(quote, source);
    });

    button.addEventListener('click', () => {
      const isOpen = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden', isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
      button.textContent = isOpen ? 'הצג מקור וראיה' : 'הסתר מקור וראיה';
    });
    wrapper.append(button, panel);
    card.appendChild(wrapper);
  }

  renderResult = function (street, city, geo, historical) {
    previousRenderResult(street, city, geo, historical);
    removeExistingEvidence();
    const evidence = historical?.evidence || {};
    attachEvidence('nameOrigin', evidence.origin, 'מקור השם');
    attachEvidence('foundedYear', evidence.foundedYear, 'שנת סלילה / ייסוד');
    attachEvidence('namedYear', evidence.namedYear, 'שנת מתן השם');
    attachFormerNamesEvidence(evidence.formerNames);
  };
})();
