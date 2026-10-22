(function () {
  if (document.documentElement.dataset.techfluxLoaded === 'true') return;
  document.documentElement.dataset.techfluxLoaded = 'true';

  const isHomePage = window.location.pathname === '/' || window.location.pathname === '/index.html';

  function addEyeOrbitLogo() {
    const header = document.querySelector('header');
    if (!header || header.querySelector('.techflux-eye-orbit')) return;
    const brandLink = header.querySelector('a[href="/"]');
    if (!brandLink) return;
    const orb = document.createElement('span');
    orb.className = 'techflux-eye-orbit';
    orb.setAttribute('aria-hidden', 'true');
    const label = brandLink.querySelector('span, div, img');
    brandLink.insertBefore(orb, label || brandLink.firstChild);
  }

  function addRevealObserver() {
    const items = document.querySelectorAll('section, article, footer, .service-card, .work-card, .feature-card');
    items.forEach((el) => {
      if (el.classList.contains('techflux-reveal')) return;
      el.classList.add('techflux-reveal');
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.techflux-reveal').forEach((el) => observer.observe(el));
  }

  function injectHomeExperience() {
    if (!isHomePage) return;
    const main = document.querySelector('main');
    if (!main || main.querySelector('.techflux-chat-demo')) return;

    const heroVisual = document.createElement('div');
    heroVisual.className = 'techflux-hero-visual';
    heroVisual.innerHTML = '<div class="techflux-eye-scene"><div class="techflux-eye-glow"></div><canvas id="techflux-eye-canvas" aria-label="Animated eye graphic"></canvas></div>';
    main.appendChild(heroVisual);

    const featureRail = document.createElement('div');
    featureRail.className = 'techflux-feature-rail techflux-panel techflux-reveal';
    featureRail.innerHTML = [
      'Strategy systems',
      'Brand direction',
      'AI automation',
      'Conversion design',
      'Launch support'
    ].map((label) => '<span class="techflux-feature-pill">' + label + '</span>').join('');

    const firstSection = main.querySelector('section');
    if (firstSection) {
      firstSection.appendChild(featureRail);
    }

    const chatPanel = document.createElement('aside');
    chatPanel.className = 'techflux-panel techflux-chat-demo techflux-reveal';
    chatPanel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:.9rem;">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <span style="display:grid;place-items:center;width:2.2rem;height:2.2rem;border-radius:50%;background:linear-gradient(135deg,#7dd3fc,#8b5cf6);color:#061219;font-weight:800;">AI</span>
          <div>
            <div style="font-weight:700; color:#fff;">Studio assistant</div>
            <div style="font-size:.72rem; color:rgba(223,231,247,0.72);">Answers in real time</div>
          </div>
        </div>
        <span style="border-radius:999px;padding:.3rem .6rem;background:rgba(34,197,94,0.14);color:#9ff0ba;font-size:.7rem;">Online</span>
      </div>
      <div class="bubble incoming">
        <span class="avatar">AI</span>
        <div class="message">We can design a premium landing page, a lead funnel, and an automated workflow this sprint.</div>
      </div>
      <div class="bubble outgoing">
        <div class="message">Great. We need a refined look for a B2B SaaS launch and a smaller conversion-focused site.</div>
      </div>
      <div class="prompt-row">
        <input aria-label="Ask the AI assistant" value="Plan the launch stack" />
        <button type="button">Send</button>
      </div>
    `;
    main.appendChild(chatPanel);

    const estimator = document.createElement('div');
    estimator.className = 'techflux-panel techflux-estimator techflux-reveal';
    estimator.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
        <div>
          <div style="font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:#8ed5ff;">Project estimator</div>
          <h3 style="margin:.45rem 0 0;color:white;font-size:1.15rem;">Launch investment</h3>
        </div>
        <span style="font-size:1.75rem;">✦</span>
      </div>
      <div class="field-group">
        <label>
          <span style="display:block;margin-bottom:.35rem;font-size:.8rem;color:rgba(223,231,247,0.8);">Scope</span>
          <select id="techflux-scope">
            <option value="8500">Brand & landing page</option>
            <option value="13000">Small product site</option>
            <option value="18500">Growth website + automation</option>
            <option value="24000">Custom creative system</option>
          </select>
        </label>
        <label>
          <span style="display:block;margin-bottom:.35rem;font-size:.8rem;color:rgba(223,231,247,0.8);">Priority</span>
          <select id="techflux-priority">
            <option value="1">Standard delivery</option>
            <option value="1.25">Priority launch</option>
            <option value="1.5">Rapid sprint</option>
          </select>
        </label>
      </div>
      <div class="estimate-result" aria-live="polite">
        Estimated starting investment: <strong id="techflux-estimate">$8,500</strong>
      </div>
      <button type="button" style="margin-top:1rem; width:100%;">Book strategy call</button>
    `;
    main.appendChild(estimator);

    const updateEstimate = () => {
      const scope = Number(document.getElementById('techflux-scope').value || 8500);
      const priority = Number(document.getElementById('techflux-priority').value || 1);
      const estimate = Math.round(scope * priority);
      const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      document.getElementById('techflux-estimate').textContent = formatter.format(estimate);
    };
    document.getElementById('techflux-scope')?.addEventListener('change', updateEstimate);
    document.getElementById('techflux-priority')?.addEventListener('change', updateEstimate);
    updateEstimate();

    const timeline = document.createElement('section');
    timeline.className = 'techflux-panel techflux-timeline techflux-reveal';
    timeline.innerHTML = `
      <div class="techflux-timeline-step" data-step="1"><h3>Discover</h3><p>Clarify positioning, audience, offer, and launch goals.</p></div>
      <div class="techflux-timeline-step" data-step="2"><h3>Design</h3><p>Build visual direction, pages, and user flow in a premium system.</p></div>
      <div class="techflux-timeline-step" data-step="3"><h3>Build</h3><p>Develop fast, responsive interfaces with clean handoff and QA.</p></div>
      <div class="techflux-timeline-step" data-step="4"><h3>Automate</h3><p>Connect AI workflows, lead routing, chat, and internal ops.</p></div>
      <div class="techflux-timeline-step" data-step="5"><h3>Launch</h3><p>Ship with support, analytics, and iteration plans for growth.</p></div>
    `;
    main.appendChild(timeline);
  }

  function initThreeEye() {
    const canvas = document.getElementById('techflux-eye-canvas');
    if (!canvas || !window.THREE) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 320, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.z = 4.4;

    const ambient = new THREE.AmbientLight(0xdbeafe, 1.3);
    const point = new THREE.PointLight(0xa78bfa, 2.2, 100);
    point.position.set(2.2, 1.6, 4.5);
    scene.add(ambient, point);

    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 40, 40),
      new THREE.MeshPhysicalMaterial({
        color: 0x0b1220,
        metalness: 0.6,
        roughness: 0.18,
        transmission: 0.35,
        thickness: 0.8,
        transparent: true,
        opacity: 0.9,
        envMapIntensity: 1.2
      })
    );
    group.add(shell);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0x8b5cf6,
        emissive: 0x6d28d9,
        emissiveIntensity: 0.8,
        metalness: 0.2,
        roughness: 0.45
      })
    );
    iris.position.z = 0.28;
    group.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 22, 22),
      new THREE.MeshStandardMaterial({
        color: 0x030912,
        metalness: 0.1,
        roughness: 0.7
      })
    );
    group.add(pupil);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.08, 16, 128),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x8b5cf6,
        emissiveIntensity: 0.7,
        metalness: 0.7,
        roughness: 0.18
      })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    scene.add(group);

    function render() {
      const t = performance.now() * 0.001;
      group.rotation.y = t * 0.7;
      group.rotation.x = Math.sin(t * 1.4) * 0.45;
      iris.rotation.x = t * 0.8;
      ring.rotation.z = t * 1.2;
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    render();
  }

  addEyeOrbitLogo();
  addRevealObserver();
  injectHomeExperience();

  if (window.THREE) {
    setTimeout(initThreeEye, 150);
  }

  if (window.framerMotion && typeof window.framerMotion.animate === 'function') {
    const targets = document.querySelectorAll('.techflux-feature-pill, .techflux-chat-demo, .techflux-estimator, .techflux-timeline-step');
    targets.forEach((node, index) => {
      window.framerMotion.animate(
        node,
        { opacity: [0, 1], y: [10, 0] },
        { duration: 0.55, delay: index * 0.04, ease: 'easeOut' }
      );
    });
  }
})();
