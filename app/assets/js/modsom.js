(function(){
  "use strict";

  /* ---------- estado global do áudio (precisa vir antes de
     qualquer função que o referencie, como reflectVolumeUI) ---------- */
  let audioCtx = null;
  let activeGain = null;
  let activeNodes = [];
  let activeButton = null;
  let stopTimer = null;

  /* =========================================================
     1) Waveform ambiente no topo da página (puramente visual)
  ========================================================= */
  const wavePath = document.getElementById('wavePath');
  const waveStrip = document.getElementById('waveStrip');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let waveAmp = 10;
  let waveTargetAmp = 10;
  let t = 0;

  function buildWavePath(amp){
    const width = 1200, mid = 45, points = 60;
    let d = `M0,${mid}`;
    for(let i=0;i<=points;i++){
      const x = (width/points)*i;
      const phase = (i/points)*Math.PI*4 + t;
      const y = mid
        + Math.sin(phase) * amp
        + Math.sin(phase*2.3 + 1.2) * (amp*0.35);
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  }

  function tickWave(){
    t += 0.045;
    waveAmp += (waveTargetAmp - waveAmp) * 0.06;
    wavePath.setAttribute('d', buildWavePath(waveAmp));
    requestAnimationFrame(tickWave);
  }
  if(wavePath){
    wavePath.setAttribute('d', buildWavePath(waveAmp));
    if(!reduceMotion) requestAnimationFrame(tickWave);
  }

  function boostWave(on){
    waveTargetAmp = on ? 26 : 10;
    waveStrip.classList.toggle('boost', on);
  }

  /* =========================================================
     2) Volume master
  ========================================================= */
  const volumeSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  const volWave1 = document.getElementById('volWave1');
  const volWave2 = document.getElementById('volWave2');

  let masterVolume = parseInt(volumeSlider.value, 10) / 100;
  let mutedBeforeValue = masterVolume;

  function reflectVolumeUI(){
    volumeSlider.style.setProperty('--fill', volumeSlider.value + '%');
    const isMuted = masterVolume <= 0;
    muteBtn.classList.toggle('muted', isMuted);
    volWave1.style.display = isMuted ? 'none' : '';
    volWave2.style.display = isMuted ? 'none' : (masterVolume < 0.6 ? 'none' : '');
    if(activeGain) activeGain.gain.setTargetAtTime(masterVolume * 0.35, audioCtx ? audioCtx.currentTime : 0, 0.03);
  }

  volumeSlider.addEventListener('input', ()=>{
    masterVolume = parseInt(volumeSlider.value,10) / 100;
    reflectVolumeUI();
  });

  muteBtn.addEventListener('click', ()=>{
    if(masterVolume > 0){
      mutedBeforeValue = masterVolume;
      masterVolume = 0;
      volumeSlider.value = 0;
    } else {
      masterVolume = mutedBeforeValue || 0.55;
      volumeSlider.value = Math.round(masterVolume*100);
    }
    reflectVolumeUI();
  });

  reflectVolumeUI();

  /* =========================================================
     3) Prévias de áudio sintetizadas (Web Audio API)
  ========================================================= */
  function getCtx(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function stopActive(){
    if(stopTimer){ clearTimeout(stopTimer); stopTimer = null; }
    if(activeGain){
      const ctx = getCtx();
      const now = ctx.currentTime;
      activeGain.gain.cancelScheduledValues(now);
      activeGain.gain.setTargetAtTime(0, now, 0.05);
    }
    activeNodes.forEach(n=>{
      try{ n.stop && n.stop(getCtx().currentTime + 0.15); }catch(e){}
    });
    activeNodes = [];
    if(activeButton){
      const card = activeButton.closest('.card');
      card.classList.remove('playing');
      activeButton.querySelector('.icon-play').hidden = false;
      activeButton.querySelector('.icon-stop').hidden = true;
      activeButton.querySelector('.preview-label').textContent = 'Prévia';
      activeButton = null;
    }
    boostWave(false);
  }

  function makeNoiseBuffer(ctx, seconds){
    const buffer = ctx.createBuffer(1, ctx.sampleRate*seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for(let i=0;i<data.length;i++){
      const white = Math.random()*2-1;
      last = (last + 0.02*white) / 1.02; // brownish tint
      data[i] = last * 3.2;
    }
    return buffer;
  }

  function playBuzina(ctx, gain){
    const now = ctx.currentTime;
    [0, 0.32].forEach((offset, i)=>{
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i === 0 ? 415 : 349;
      g.gain.value = 0;
      osc.connect(g).connect(gain);
      const start = now + offset;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.9, start + 0.02);
      g.gain.setValueAtTime(0.9, start + 0.22);
      g.gain.linearRampToValueAtTime(0, start + 0.28);
      osc.start(start);
      osc.stop(start + 0.3);
      activeNodes.push(osc);
    });
    return 900; // ms de duração total da prévia
  }

  function playSirene(ctx, gain){
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const g = ctx.createGain();
    g.gain.value = 0.5;
    osc.connect(g).connect(gain);
    const duration = 3.2;
    const cycles = 3;
    for(let i=0;i<cycles;i++){
      const cycleStart = now + (duration/cycles)*i;
      osc.frequency.setValueAtTime(500, cycleStart);
      osc.frequency.linearRampToValueAtTime(950, cycleStart + duration/cycles/2);
      osc.frequency.linearRampToValueAtTime(500, cycleStart + duration/cycles);
    }
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.15);
    g.gain.setValueAtTime(0.5, now + duration - 0.2);
    g.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration);
    activeNodes.push(osc);
    return duration * 1000;
  }

  function playAmbiente(ctx, gain){
    const now = ctx.currentTime;
    const duration = 4;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, duration + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0;
    noise.connect(filter).connect(g).connect(gain);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.6, now + 0.4);
    g.gain.setValueAtTime(0.6, now + duration - 0.5);
    g.gain.linearRampToValueAtTime(0, now + duration);
    noise.start(now);
    noise.stop(now + duration);
    activeNodes.push(noise);
    return duration * 1000;
  }

  const players = { buzina: playBuzina, sirene: playSirene, ambiente: playAmbiente };

  document.querySelectorAll('.preview-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const soundKey = btn.dataset.sound;
      const card = btn.closest('.card');
      const wasActive = activeButton === btn;

      stopActive();
      if(wasActive) return; // funcionou como botão de "parar"

      const ctx = getCtx();
      const gain = ctx.createGain();
      gain.gain.value = masterVolume * 0.35;
      gain.connect(ctx.destination);
      activeGain = gain;
      activeButton = btn;

      card.classList.add('playing');
      btn.querySelector('.icon-play').hidden = true;
      btn.querySelector('.icon-stop').hidden = false;
      btn.querySelector('.preview-label').textContent = 'Tocando';
      boostWave(true);

      const durationMs = players[soundKey](ctx, gain);
      stopTimer = setTimeout(stopActive, durationMs + 120);
    });
  });

  /* =========================================================
     4) Toast ao clicar em "Baixar"
  ========================================================= */
  const toastStack = document.getElementById('toastStack');

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

  document.querySelectorAll('.card-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.preventDefault();
      showToast(btn.dataset.name || 'pack');
    });
  });
})();