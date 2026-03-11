/*
  这个脚本做一件事：
  - 监听 .layer-btn 按钮点击
  - 把按钮上的 data-* 内容填进弹窗
  - 打开 / 关闭弹窗
*/
(function () {
    const popup = document.getElementById('layerPopup');
    if (!popup) return; // 不是首页时直接退出，避免报错

    const titleEl = document.getElementById('popupTitle');
    const textEl = document.getElementById('popupText');
    const learnEl = document.getElementById('popupLearn');
    const visitEl = document.getElementById('popupVisit');
    const closeEl = document.getElementById('popupClose');

    const layerButtons = document.querySelectorAll('.layer-btn');

    layerButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            titleEl.textContent = btn.dataset.title || 'Layer';
            textEl.textContent = btn.dataset.text || 'No description yet.';
            learnEl.href = btn.dataset.learn || 'more-guide.html';
            visitEl.href = btn.dataset.visit || 'visitor-experiences.html';

            popup.classList.add('show');
            popup.setAttribute('aria-hidden', 'false');
        });
    });

    closeEl.addEventListener('click', () => {
        popup.classList.remove('show');
        popup.setAttribute('aria-hidden', 'true');
    });

    // 点击遮罩层（黑色背景）也关闭弹窗，交互更自然
    popup.addEventListener('click', (event) => {
        if (event.target === popup) {
            popup.classList.remove('show');
            popup.setAttribute('aria-hidden', 'true');
        }
    });
})();
