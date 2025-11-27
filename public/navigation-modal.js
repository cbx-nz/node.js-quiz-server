/**
 * Global Navigation Modal
 * Triggers when user types '.?'
 * Shows all available pages in the app
 */

(function() {
  let keyBuffer = '';
  let keyTimeout = null;
  
  // All available pages
  const pages = [
    { name: 'Home / Player Join', url: '/', description: 'Join a game as a player' },
    { name: 'Host Dashboard', url: '/host.html', description: 'Create and manage games' },
    { name: 'Presenter View', url: '/presenter.html', description: 'Full-screen display for audience' },
    { name: 'Question Creator', url: '/creator.html', description: 'Create custom questions' },
    { name: 'Documentation', url: '/docs.html', description: 'Complete guide and help' }
  ];

  // Create modal HTML
  const modalHTML = `
    <div id="navModal" style="
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    ">
      <div style="
        background: white;
        padding: 40px;
        border-radius: 20px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        ">
          <h2 style="
            margin: 0;
            font-size: 28px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          ">🧭 Navigation</h2>
          <button id="closeNavModal" style="
            background: none;
            border: none;
            font-size: 32px;
            cursor: pointer;
            color: #666;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
          ">&times;</button>
        </div>
        <p style="
          color: #666;
          margin-bottom: 25px;
          font-size: 14px;
        ">Type <strong>.?</strong> anywhere to open this menu</p>
        <div id="navModalPages"></div>
      </div>
    </div>
  `;

  // Add modal to page when DOM is ready
  function init() {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('navModal');
    const closeBtn = document.getElementById('closeNavModal');
    const pagesContainer = document.getElementById('navModalPages');
    
    // Populate pages
    pages.forEach(page => {
      const pageItem = document.createElement('a');
      pageItem.href = page.url;
      pageItem.style.cssText = `
        display: block;
        padding: 20px;
        margin-bottom: 15px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-decoration: none;
        border-radius: 12px;
        transition: transform 0.2s, box-shadow 0.2s;
      `;
      pageItem.innerHTML = `
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 5px;">${page.name}</div>
        <div style="font-size: 14px; opacity: 0.9;">${page.description}</div>
      `;
      pageItem.addEventListener('mouseenter', () => {
        pageItem.style.transform = 'translateY(-2px)';
        pageItem.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
      });
      pageItem.addEventListener('mouseleave', () => {
        pageItem.style.transform = 'translateY(0)';
        pageItem.style.boxShadow = 'none';
      });
      pagesContainer.appendChild(pageItem);
    });
    
    // Close modal handlers
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Keyboard handler
    document.addEventListener('keydown', (e) => {
      // Close on Escape
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
        keyBuffer = '';
        return;
      }
      
      // Don't capture if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Build key buffer
      keyBuffer += e.key;
      
      // Clear timeout
      if (keyTimeout) {
        clearTimeout(keyTimeout);
      }
      
      // Check for .?
      if (keyBuffer.endsWith('.?')) {
        modal.style.display = 'flex';
        keyBuffer = '';
        e.preventDefault();
        return;
      }
      
      // Reset buffer after 1 second
      keyTimeout = setTimeout(() => {
        keyBuffer = '';
      }, 1000);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
