window.addEventListener('scroll', () => {
    const heroSection = document.querySelector('.portal-hero');
    const stickyStage = document.querySelector('.sticky-stage');
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const heroImage = document.querySelector('.hero-image');
    const portalTitle = document.querySelector('.portal-title');
    const leftHalf = document.querySelector('.left-half');
    const rightHalf = document.querySelector('.right-half');

    const rect = heroSection.getBoundingClientRect();
    const scrollProgress = Math.max(0, -rect.top) / (heroSection.offsetHeight - window.innerHeight);

    // Ensure scroll is within the hero section
    if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
        // Panel movement
        const panelTranslate = scrollProgress * 105; // Move past own width
        leftPanel.style.transform = `translateX(-${panelTranslate}%)`;
        rightPanel.style.transform = `translateX(${panelTranslate}%)`;

        // Image settle
        const imageScale = 1.1 - (scrollProgress * 0.1);
        heroImage.style.transform = `scale(${imageScale})`;

        // Title expansion/zoom
        const titleScale = 1 + (scrollProgress * 0.3); // Scale up by 30%
        const letterSpacing = -0.02 - (scrollProgress * 0.05); // Tighten tracking
        const wordmarkTranslate = scrollProgress * 20; // Move halves apart

        portalTitle.style.transform = `translate(-50%, -50%) scale(${titleScale})`;
        portalTitle.style.letterSpacing = `${letterSpacing}em`;
        leftHalf.style.transform = `translateX(-${wordmarkTranslate}%)`;
        rightHalf.style.transform = `translateX(${wordmarkTranslate}%)`;
    }
});
