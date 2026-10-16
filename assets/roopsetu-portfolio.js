(() => {
  const appUrl = 'https://roopsetu-github-io.vercel.app/';
  let featureCard;
  let installDialog;

  function createFeatureCard() {
    const card = document.createElement('article');
    card.className = 'roopsetu-feature';
    card.setAttribute('aria-labelledby', 'roopsetu-feature-title');
    card.innerHTML = `
      <div class="roopsetu-feature__copy">
        <span class="roopsetu-feature__eyebrow">Featured digital product</span>
        <div class="roopsetu-feature__heading">
          <span class="roopsetu-feature__icon" aria-hidden="true">RS</span>
          <div>
            <h2 class="roopsetu-feature__title" id="roopsetu-feature-title">RoopSetu</h2>
            <p class="roopsetu-feature__subtitle">Salon Booking &amp; Management App</p>
          </div>
        </div>
        <p class="roopsetu-feature__description">
          A polished salon booking and management progressive web app that brings
          discovering a salon, reserving a service and managing the business
          together in one seamless experience.
        </p>
        <div class="roopsetu-feature__features" aria-label="RoopSetu features">
          <span class="roopsetu-feature__chip">Salon discovery</span>
          <span class="roopsetu-feature__chip">Appointment booking</span>
          <span class="roopsetu-feature__chip">Razorpay payments</span>
          <span class="roopsetu-feature__chip">Cash payment management</span>
          <span class="roopsetu-feature__chip">Owner dashboard</span>
          <span class="roopsetu-feature__chip">Customer bookings</span>
        </div>
        <div class="roopsetu-feature__actions">
          <a class="roopsetu-feature__button roopsetu-feature__button--primary"
             href="${appUrl}" target="_blank" rel="noopener noreferrer">
            Open RoopSetu App <span aria-hidden="true">↗</span>
          </a>
          <button class="roopsetu-feature__button roopsetu-feature__button--secondary"
                  type="button" data-roopsetu-install>
            Install RoopSetu <span aria-hidden="true">＋</span>
          </button>
        </div>
        <p class="roopsetu-feature__note">Add the app to your home screen—no app-store download needed.</p>
      </div>
      <div class="roopsetu-feature__visual" aria-label="Preview of the RoopSetu mobile app">
        <div class="roopsetu-feature__halo" aria-hidden="true"></div>
        <div class="roopsetu-phone">
          <div class="roopsetu-phone__screen">
            <div class="roopsetu-phone__top"><span class="roopsetu-phone__speaker"></span></div>
            <div class="roopsetu-phone__content">
              <div class="roopsetu-phone__brand">
                <span class="roopsetu-phone__brand-mark" aria-hidden="true">RS</span>
                <span>RoopSetu</span>
              </div>
              <p class="roopsetu-phone__welcome">Find your next<br />salon moment.</p>
              <p class="roopsetu-phone__location">Discover salons near you</p>
              <div class="roopsetu-phone__search">⌕ &nbsp; Search salons or services</div>
              <p class="roopsetu-phone__section-label">Popular near you</p>
              <div class="roopsetu-phone__salon">
                <div class="roopsetu-phone__salon-art" aria-hidden="true">✦</div>
                <div>
                  <p class="roopsetu-phone__salon-name">The Blush Studio</p>
                  <p class="roopsetu-phone__salon-meta">Beauty · 4.9 ★ · 1.2 km</p>
                  <div class="roopsetu-phone__book">Book an appointment</div>
                </div>
              </div>
              <div class="roopsetu-phone__bottom" aria-hidden="true">
                <span>Discover</span><span>Bookings</span><span>Profile</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    return card;
  }

  function createInstallDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'roopsetu-install-dialog';
    dialog.id = 'roopsetu-install-dialog';
    dialog.setAttribute('aria-labelledby', 'roopsetu-install-title');
    dialog.innerHTML = `
      <div class="roopsetu-install-dialog__content">
        <button class="roopsetu-install-dialog__close" type="button"
                aria-label="Close installation instructions">×</button>
        <p class="roopsetu-install-dialog__eyebrow">Take RoopSetu with you</p>
        <h2 id="roopsetu-install-title">Add RoopSetu to your home screen</h2>
        <p class="roopsetu-install-dialog__intro">
          RoopSetu is a progressive web app. Open it in your mobile browser, then
          follow the steps for your device. No APK or app-store download is needed.
        </p>
        <div class="roopsetu-install-dialog__steps">
          <section>
            <h3>Android · Chrome</h3>
            <ol>
              <li>Open RoopSetu in Chrome.</li>
              <li>Tap the menu <strong>⋮</strong> in the top corner.</li>
              <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              <li>Confirm to add RoopSetu to your home screen.</li>
            </ol>
          </section>
          <section>
            <h3>iPhone · Safari</h3>
            <ol>
              <li>Open RoopSetu in Safari.</li>
              <li>Tap the <strong>Share</strong> button.</li>
              <li>Scroll and choose <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> to finish.</li>
            </ol>
          </section>
        </div>
        <a class="roopsetu-install-dialog__open" href="${appUrl}"
           target="_blank" rel="noopener noreferrer">Open RoopSetu App ↗</a>
      </div>`;

    dialog.querySelector('.roopsetu-install-dialog__close').addEventListener('click', () => {
      dialog.close();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  }

  function initializeRoopSetuFeature() {
    const portfolio = document.querySelector('.section-paper .mx-auto.max-w-7xl.px-5');
    if (!portfolio) return;

    const firstProjectGrid = portfolio.querySelector('.grid');
    if (!firstProjectGrid) {
      console.error('RoopSetu featured project could not find the existing project grid.');
      return;
    }

    if (!featureCard) {
      featureCard = createFeatureCard();
      featureCard.querySelector('[data-roopsetu-install]').addEventListener('click', () => {
        window.open(appUrl, '_blank', 'noopener,noreferrer');
        installDialog.showModal();
      });
    }

    if (!portfolio.contains(featureCard)) {
      portfolio.insertBefore(featureCard, firstProjectGrid);
    }

    if (!installDialog) {
      installDialog = createInstallDialog();
    }

    if (!installDialog.isConnected) {
      document.body.appendChild(installDialog);
    }
  }

  function watchPortfolio() {
    const observer = new MutationObserver(initializeRoopSetuFeature);
    observer.observe(document.body, { childList: true, subtree: true });
    initializeRoopSetuFeature();
  }

  if (document.readyState === 'complete') {
    watchPortfolio();
  } else {
    window.addEventListener('load', watchPortfolio, { once: true });
  }
})();
