(function(){
  "use strict";

  const modList = document.getElementById('modList');
  const rows = Array.from(modList.querySelectorAll('.mod-row'));
  const searchInput = document.getElementById('modSearch');
  const clearBtn = document.getElementById('clearSearch');
  const chips = Array.from(document.querySelectorAll('.chip'));
  const sortSelect = document.getElementById('sortSelect');
  const resultCount = document.getElementById('resultCount');
  const emptyState = document.getElementById('emptyState');
  const toastStack = document.getElementById('toastStack');

  let activeCategory = 'all';

  /* ---------- staggered entrance ---------- */
  rows.forEach((row, i)=>{
    row.style.animationDelay = (i * 0.06) + 's';
  });

  /* ---------- filtering ---------- */
  function applyFilters(){
    const query = searchInput.value.trim().toLowerCase();
    clearBtn.hidden = query.length === 0;

    let visible = 0;
    rows.forEach(row=>{
      const title = row.querySelector('h3').textContent.toLowerCase();
      const desc = row.querySelector('.mod-desc').textContent.toLowerCase();
      const matchesQuery = !query || title.includes(query) || desc.includes(query);
      const matchesCategory = activeCategory === 'all' || row.dataset.category === activeCategory;
      const show = matchesQuery && matchesCategory;

      if(show){
        row.classList.remove('filtering-out');
        row.classList.remove('hidden-row');
        visible++;
      } else {
        row.classList.add('filtering-out');
        // wait for the fade-out transition before actually hiding it
        setTimeout(()=>{
          if(row.classList.contains('filtering-out')) row.classList.add('hidden-row');
        }, 220);
      }
    });

    updateCount(visible);
    emptyState.classList.toggle('visible', visible === 0);
  }

  function updateCount(n){
    const word = n === 1 ? 'pack encontrado' : 'packs encontrados';
    resultCount.innerHTML = `<strong>${n}</strong> ${word}`;
    resultCount.classList.remove('pulse');
    // restart the pulse animation
    void resultCount.offsetWidth;
    resultCount.classList.add('pulse');
  }

  searchInput.addEventListener('input', applyFilters);
  clearBtn.addEventListener('click', ()=>{
    searchInput.value = '';
    searchInput.focus();
    applyFilters();
  });

  chips.forEach(chip=>{
    chip.addEventListener('click', ()=>{
      chips.forEach(c=> c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.category;
      applyFilters();
    });
  });

  /* ---------- sorting with FLIP animation ---------- */
  function currentOrderedRows(){
    return Array.from(modList.querySelectorAll('.mod-row'));
  }

  function sortRows(){
    const by = sortSelect.value; // 'downloads' | 'likes' | 'updated'
    const list = currentOrderedRows();

    // 1. record first positions
    const first = new Map();
    list.forEach(r=> first.set(r, r.getBoundingClientRect()));

    // 2. sort in memory
    list.sort((a, b)=>{
      if(by === 'updated'){
        return parseInt(a.dataset.updated,10) - parseInt(b.dataset.updated,10); // fewer days = more recent
      }
      return parseInt(b.dataset[by],10) - parseInt(a.dataset[by],10); // higher first
    });

    // 3. reinsert in new order
    list.forEach(r=> modList.appendChild(r));

    // 4. play FLIP: measure last positions, invert, then animate to 0
    list.forEach(r=>{
      const f = first.get(r);
      const l = r.getBoundingClientRect();
      const dx = f.left - l.left;
      const dy = f.top - l.top;
      if(dx || dy){
        r.style.transition = 'none';
        r.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(()=>{
          r.style.transition = 'transform .45s cubic-bezier(.22,.9,.3,1)';
          r.style.transform = '';
        });
      }
    });
  }

  sortSelect.addEventListener('change', sortRows);

  /* ---------- toast on "download" click ---------- */
  function showToast(name){
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M6 11l6 6 6-6"/><path d="M5 21h14"/></svg>
      <span>Download iniciado: <strong>${name}</strong></span>
    `;
    toastStack.appendChild(toast);
    setTimeout(()=>{
      toast.classList.add('leaving');
      toast.addEventListener('animationend', ()=> toast.remove(), { once:true });
    }, 2600);
  }

  rows.forEach(row=>{
    row.addEventListener('click', e=>{
      e.preventDefault();
      const name = row.querySelector('h3').textContent;
      showToast(name);
    });
  });

  /* ---------- initial state ---------- */
  applyFilters();
})();