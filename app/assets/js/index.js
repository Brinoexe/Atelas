(function(){
  "use strict";
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CX = 200, CY = 200, R = 150;
  const DEG = Math.PI/180;

  /* ---------- build meridians ---------- */
  const meridianCount = 6;
  const meridianEls = [];
  const meridiansGroup = document.getElementById('meridians');
  for(let i=0;i<meridianCount;i++){
    const el = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
    el.setAttribute('class','meridian');
    el.setAttribute('cx', CX);
    el.setAttribute('cy', CY);
    el.setAttribute('ry', R);
    el.setAttribute('stroke-width', '0.7');
    meridiansGroup.appendChild(el);
    meridianEls.push({ el, baseLon: (360/meridianCount)*i*DEG });
  }

  /* ---------- static latitude rings ---------- */
  const latFracs = [0.3, 0.62, 0.9];
  const latGroup = document.getElementById('latRings');
  latFracs.forEach(f=>{
    [1,-1].forEach(sign=>{
      const el = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      const ry = R * f * sign;
      el.setAttribute('cx', CX);
      el.setAttribute('cy', CY + (R - Math.abs(ry)) * -sign * 0); // placeholder, fixed below
      el.setAttribute('class','lat-ring');
      el.setAttribute('stroke-width','0.6');
      el.setAttribute('opacity', 0.38 - f*0.18);
      latGroup.appendChild(el);
      // store for rendering (height offset computed by spherical geometry)
      el.dataset.latFrac = f * sign;
    });
  });

  function renderLatRings(){
    const kids = latGroup.children;
    for(let i=0;i<kids.length;i++){
      const el = kids[i];
      const s = parseFloat(el.dataset.latFrac); // -1..1 roughly, using asin mapping
      const theta = Math.asin(Math.max(-0.98,Math.min(0.98,s)));
      const y = CY - R*Math.sin(theta);
      const rx = R*Math.cos(theta);
      el.setAttribute('cy', y.toFixed(2));
      el.setAttribute('rx', Math.max(rx,2).toFixed(2));
      el.setAttribute('ry', (Math.max(rx,2)*0.14).toFixed(2));
    }
  }
  renderLatRings();

  /* ---------- server nodes ---------- */
  const nodeDefs = [
    { lon: 20,  lat: 28, name: 'São Paulo · SMP'      },
    { lon: 95,  lat: 42, name: 'Tóquio · Skyblock'    },
    { lon: 175, lat: 10, name: 'Sydney · Survival'    },
    { lon: 245, lat: 50, name: 'Londres · Creative'   },
    { lon: 300, lat: -12,name: 'Nova York · Faction'  },
    { lon: 150, lat: -35,name: 'Lisboa · Vanilla+'    },
  ];
  const nodesGroup = document.getElementById('nodes');
  const labelsWrap = document.getElementById('labels');
  const nodeEls = nodeDefs.map((d,i)=>{
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','node');
    g.innerHTML = `<circle class="pulse" r="4"></circle><circle class="core" r="2.6"></circle>`;
    nodesGroup.appendChild(g);

    const label = document.createElement('div');
    label.className = 'node-label';
    label.textContent = d.name;
    labelsWrap.appendChild(label);

    g.addEventListener('mouseenter', ()=> label.classList.add('visible'));
    g.addEventListener('mouseleave', ()=> label.classList.remove('visible'));
    g.style.pointerEvents = 'auto';
    g.style.cursor = 'pointer';

    return { def:d, g, core:g.querySelector('.core'), pulse:g.querySelector('.pulse'), label };
  });

  /* ---------- rotation state ---------- */
  let rotationY = 20; // degrees
  let autoSpeed = reduceMotion ? 0 : 0.10; // deg per frame
  let dragging = false;
  let lastX = 0;
  let velocity = 0;
  let resumeTimeout = null;

  function render(){
    const rot = rotationY * DEG;

    meridianEls.forEach(m=>{
      const lon = m.baseLon + rot;
      const c = Math.cos(lon);
      const rx = Math.abs(R*c);
      m.el.setAttribute('rx', Math.max(rx,0.6).toFixed(2));
      const front = c > 0;
      m.el.setAttribute('opacity', front ? 0.55 : 0.16);
      m.el.setAttribute('stroke-width', front ? 0.85 : 0.5);
    });

    nodeEls.forEach(n=>{
      const lonRad = n.def.lon*DEG + rot;
      const latRad = n.def.lat*DEG;
      const x = CX + R*Math.cos(latRad)*Math.sin(lonRad);
      const y = CY - R*Math.sin(latRad);
      const z = Math.cos(latRad)*Math.cos(lonRad); // -1..1

      n.g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
      const front = z > 0.05;
      const op = front ? Math.min(1, 0.55 + z*0.6) : 0.12;
      n.g.style.opacity = op.toFixed(2);
      n.g.style.pointerEvents = front ? 'auto' : 'none';

      // position html label above the svg point (percentage of stage)
      const px = (x/400)*100;
      const py = (y/400)*100;
      n.label.style.left = px + '%';
      n.label.style.top = py + '%';
    });
  }

  function tick(){
    if(!dragging){
      if(Math.abs(velocity) > 0.02){
        rotationY += velocity;
        velocity *= 0.94;
      } else {
        rotationY += autoSpeed;
      }
    }
    render();
    requestAnimationFrame(tick);
  }
  render();
  if(!reduceMotion){ requestAnimationFrame(tick); }

  /* ---------- drag to spin ---------- */
  const wrap = document.getElementById('globeWrap');

  function pointerDown(x){
    dragging = true;
    lastX = x;
    velocity = 0;
    wrap.classList.add('dragging');
    if(resumeTimeout) clearTimeout(resumeTimeout);
  }
  function pointerMove(x){
    if(!dragging) return;
    const dx = x - lastX;
    lastX = x;
    rotationY += dx * 0.45;
    velocity = dx * 0.45;
    render();
  }
  function pointerUp(){
    if(!dragging) return;
    dragging = false;
    wrap.classList.remove('dragging');
  }

  wrap.addEventListener('mousedown', e=> pointerDown(e.clientX));
  window.addEventListener('mousemove', e=> pointerMove(e.clientX));
  window.addEventListener('mouseup', pointerUp);

  wrap.addEventListener('touchstart', e=> pointerDown(e.touches[0].clientX), {passive:true});
  wrap.addEventListener('touchmove', e=> pointerMove(e.touches[0].clientX), {passive:true});
  wrap.addEventListener('touchend', pointerUp);

  /* ---------- mouse parallax tilt on the whole svg ---------- */
  const svg = document.getElementById('globeSvg');
  const hero = document.querySelector('.hero');
  if(!reduceMotion){
    hero.addEventListener('mousemove', e=>{
      const r = hero.getBoundingClientRect();
      const relX = (e.clientX - r.left)/r.width - 0.5;
      const relY = (e.clientY - r.top)/r.height - 0.5;
      svg.style.transform = `perspective(900px) rotateX(${(-relY*8).toFixed(2)}deg) rotateY(${(relX*8).toFixed(2)}deg)`;
    });
    hero.addEventListener('mouseleave', ()=>{
      svg.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
    });
  }

  /* ---------- ambient particles ---------- */
  const particlesWrap = document.getElementById('particles');
  if(!reduceMotion){
    const n = 14;
    for(let i=0;i<n;i++){
      const s = document.createElement('span');
      const left = Math.random()*100;
      const dur = 9 + Math.random()*10;
      const delay = Math.random()*10;
      const driftX = (Math.random()*60-30) + 'px';
      s.style.left = left + '%';
      s.style.animationDuration = dur + 's';
      s.style.animationDelay = -delay + 's';
      s.style.setProperty('--drift-x', driftX);
      particlesWrap.appendChild(s);
    }
  }
})();

/* =========================================================
   Botão de atualização (só funciona dentro do app Electron —
   fora dele, window.atelasUpdater não existe e o botão some)
========================================================= */
(function(){
  "use strict";
  const btn = document.getElementById('updateBtn');
  if(!btn) return;

  if(!window.atelasUpdater){
    btn.style.display = 'none'; // aberto num navegador comum, não faz sentido mostrar
    return;
  }

  const label = btn.querySelector('.update-label');
  const STATES = ['checking','available','downloading','downloaded','latest','error'];

  function setState(state, message){
    STATES.forEach(s => btn.classList.remove(s));
    if(state) btn.classList.add(state);
    if(message) label.textContent = message;
  }

  btn.addEventListener('click', ()=>{
    if(btn.classList.contains('downloaded')){
      window.atelasUpdater.restart();
      return;
    }
    if(btn.classList.contains('checking') || btn.classList.contains('downloading')) return;
    setState('checking', 'Verificando...');
    window.atelasUpdater.check();
  });

  window.atelasUpdater.onStatus((data)=>{
    switch(data.state){
      case 'dev':
        setState('latest', 'Só funciona no app instalado');
        setTimeout(()=> setState(null, 'Verificar atualizações'), 3200);
        break;
      case 'checking':
        setState('checking', 'Verificando...');
        break;
      case 'available':
        setState('downloading', data.message);
        break;
      case 'downloading':
        setState('downloading', `Baixando... ${Math.round(data.percent || 0)}%`);
        break;
      case 'downloaded':
        setState('downloaded', 'Reiniciar para atualizar');
        break;
      case 'latest':
        setState('latest', 'Tudo atualizado');
        setTimeout(()=> setState(null, 'Verificar atualizações'), 2600);
        break;
      case 'error':
        setState('error', 'Erro ao verificar');
        setTimeout(()=> setState(null, 'Verificar atualizações'), 3200);
        break;
    }
  });
})();