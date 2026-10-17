// ==UserScript==
// @name         マクロミル 回答ボタン最適化
// @namespace    https://github.com/mae39kuma-gif/makuromiru-saitekika
// @version      1.2.0
// @description  マクロミルのアンケート回答画面で、選択肢と「次へ」ボタンを押しやすくする（PC・スマホ対応）
// @match        *://*.macromill.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/mae39kuma-gif/empty/main/macromill-optimizer.user.js
// @downloadURL  https://raw.githubusercontent.com/mae39kuma-gif/empty/main/macromill-optimizer.user.js
// ==/UserScript==

(function () {
  'use strict';

  // 二重実行防止（ブックマークレットを何度押しても大丈夫なように）
  if (window.__mmoptLoaded) return;
  window.__mmoptLoaded = true;

  // 「次へ」系ボタンとして扱う文言
  const NEXT_WORDS = /(次へ|次のページ|次に進む|進む|回答する|回答を送信|送信|確定|完了|NEXT)/i;
  // 「戻る」系はフローティングボタンにしない
  const BACK_WORDS = /(戻る|前へ|前のページ|BACK)/i;

  const isTouch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

  // ---------- スタイル ----------
  const css = `
    /* タップの遅延・ダブルタップズームを防ぐ */
    html, body { touch-action: manipulation; }

    /* ラジオ・チェックボックス本体を大きく */
    input[type="radio"].mmopt-input,
    input[type="checkbox"].mmopt-input {
      width: 22px !important;
      height: 22px !important;
      min-width: 22px !important;
      margin: 4px 8px 4px 4px !important;
      vertical-align: middle !important;
      cursor: pointer !important;
      accent-color: #e8590c;
    }

    /* 選択肢を囲むセル・ラベル全体を押せる領域に */
    .mmopt-cell {
      cursor: pointer !important;
      -webkit-tap-highlight-color: rgba(232, 89, 12, 0.15);
      transition: background-color .12s ease;
      user-select: none;
      -webkit-user-select: none;
    }
    label.mmopt-cell { display: inline-block; padding: 6px 4px; }
    td.mmopt-cell:not(.mmopt-dense), th.mmopt-cell:not(.mmopt-dense),
    tr.mmopt-cell > td, tr.mmopt-cell > th { padding-top: 6px !important; padding-bottom: 6px !important; }

    /* 列が多い表（マトリクス）は丸を大きくすると崩れるので、マス全体を押せるようにするだけ */
    input[type="radio"].mmopt-input.mmopt-input-dense,
    input[type="checkbox"].mmopt-input.mmopt-input-dense {
      width: auto !important; height: auto !important; min-width: 0 !important; margin: 0 !important;
    }
    .mmopt-dense:active { background-color: rgba(232, 89, 12, 0.25) !important; }

    /* 表で選んだときに「行 → 列」を一瞬表示する */
    #mmopt-toast {
      position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top, 0px));
      transform: translateX(-50%);
      z-index: 2147483647;
      max-width: calc(100vw - 32px);
      padding: 10px 16px; border-radius: 12px;
      background: rgba(30, 30, 30, .9); color: #fff;
      font-size: 16px; font-weight: bold; line-height: 1.4;
      pointer-events: none; opacity: 0; transition: opacity .2s ease;
    }
    #mmopt-toast.mmopt-show { opacity: 1; }

    /* 選択肢が多い単一回答をプルダウンにしたもの */
    .mmopt-select-wrap { display: block; padding: 10px 12px; list-style: none; }
    .mmopt-select {
      display: block; width: 100%; max-width: 560px;
      min-height: 52px; padding: 10px 40px 10px 14px;
      font-size: 18px !important; color: #222; background: #fff;
      border: 2px solid #b8b8b8; border-radius: 10px;
      -webkit-appearance: none; appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, #e8590c 50%), linear-gradient(135deg, #e8590c 50%, transparent 50%);
      background-position: calc(100% - 22px) 50%, calc(100% - 15px) 50%;
      background-size: 7px 7px; background-repeat: no-repeat;
    }
    .mmopt-select.mmopt-chosen { border-color: #e8590c; background-color: #fff4ee; font-weight: bold; }
    .mmopt-select-back {
      display: inline-block; margin-top: 6px; padding: 4px 2px;
      font-size: 13px; color: #666; text-decoration: underline; background: none; border: none; cursor: pointer;
    }
    .mmopt-hidden { display: none !important; }
    .mmopt-cell:hover { background-color: rgba(232, 89, 12, 0.08) !important; }
    .mmopt-cell.mmopt-checked { background-color: rgba(232, 89, 12, 0.18) !important; }

    /* 「次へ」系ボタンを大きく */
    .mmopt-next {
      min-height: 52px !important;
      min-width: 160px !important;
      font-size: 18px !important;
      font-weight: bold !important;
      padding: 10px 24px !important;
      border-radius: 10px !important;
      cursor: pointer !important;
    }

    /* スマホ用：画面下に固定する「次へ」ボタン */
    #mmopt-float {
      position: fixed;
      left: 12px; right: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483647;
      height: 56px;
      border: none;
      border-radius: 14px;
      background: #e8590c;
      color: #fff;
      font-size: 19px;
      font-weight: bold;
      box-shadow: 0 4px 14px rgba(0,0,0,.25);
      cursor: pointer;
    }
    #mmopt-float:active { transform: scale(.98); background: #c94d0a; }
    body.mmopt-has-float { padding-bottom: 90px !important; }

    @media (pointer: coarse), (max-width: 767px) {
      input[type="radio"].mmopt-input,
      input[type="checkbox"].mmopt-input {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
      }
      td.mmopt-cell:not(.mmopt-dense), th.mmopt-cell:not(.mmopt-dense),
      tr.mmopt-cell > td, tr.mmopt-cell > th { padding-top: 12px !important; padding-bottom: 12px !important; }
      div.mmopt-cell, li.mmopt-cell { min-height: 44px; }
      label.mmopt-cell:not(.mmopt-dense) { display: block; padding: 10px 6px; }
      .mmopt-next { width: 100% !important; max-width: 480px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'mmopt-style';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  // ---------- 選択肢の押せる範囲を広げる ----------

  // 入力欄を1つだけ含む、一番近い「セル」を探す
  function findCell(input) {
    const label = input.closest('label');
    if (label) return label;
    // 表の1行に選択肢が1つだけなら、文字の部分も含めて行全体を押せるように
    const row = input.closest('tr');
    if (row && row.querySelectorAll('input[type="radio"], input[type="checkbox"]').length === 1) return row;
    let el = input.parentElement;
    for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
      if (el === document.body) break;
      const count = el.querySelectorAll('input[type="radio"], input[type="checkbox"]').length;
      if (count > 1) break; // 他の選択肢まで含んでしまう範囲は広げすぎ
      if (/^(TD|TH|LI|LABEL|DD|DT)$/.test(el.tagName)) return el;
      if (el.tagName === 'DIV' && el.textContent.trim().length < 200) return el;
    }
    return null;
  }

  // 同じ行に選択肢がたくさんある＝マトリクス形式の表
  function isDense(input) {
    const row = input.closest('tr');
    return !!row && row.querySelectorAll('input[type="radio"], input[type="checkbox"]').length >= 5;
  }

  // ---------- 選択肢が多い単一回答をプルダウンにする ----------
  const SELECT_MIN = 6; // この数以上の選択肢があればプルダウンにする

  function optionText(input, item) {
    const lab = (input.labels && input.labels[0]) || item;
    return (lab.textContent || '').replace(/\s+/g, ' ').trim() || input.value;
  }

  // 入力欄から上にたどり、同じ質問の他の選択肢を含まない一番外側の要素（＝1つの選択肢の行）
  function optionItem(input, sameName) {
    let el = input;
    while (el.parentElement && el.parentElement !== document.body &&
           sameName.filter((r) => el.parentElement.contains(r)).length === 1) {
      el = el.parentElement;
    }
    return el;
  }

  function convertToSelects() {
    const groups = new Map();
    document.querySelectorAll('input[type="radio"]').forEach((r) => {
      if (!r.name || r.__mmoptSel) return;
      const key = (r.form ? 'f' : '') + r.name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    groups.forEach((radios) => {
      if (radios.length < SELECT_MIN) return;
      if (radios.some((r) => isDense(r))) return; // マトリクス表はそのまま
      const items = radios.map((r) => optionItem(r, radios));
      // 「その他（　　）」のような記入欄がある質問はそのまま
      if (items.some((it) => it.querySelector('input[type="text"], textarea'))) return;
      if (items.some((it) => it === document.documentElement)) return;

      radios.forEach((r) => { r.__mmoptSel = true; });

      const select = document.createElement('select');
      select.className = 'mmopt-select';
      select.setAttribute('aria-label', '選択肢');
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '▼ タップして選ぶ';
      select.appendChild(ph);
      radios.forEach((r, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = optionText(r, items[i]);
        select.appendChild(o);
      });

      const sync = () => {
        const i = radios.findIndex((r) => r.checked);
        select.value = i < 0 ? '' : String(i);
        select.classList.toggle('mmopt-chosen', i >= 0);
      };
      select.addEventListener('change', () => {
        const r = radios[Number(select.value)];
        if (select.value !== '' && r && !r.checked) r.click(); // 本物の選択肢を押したことにする
        sync();
      });
      radios.forEach((r) => r.addEventListener('change', sync));

      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'mmopt-select-back';
      back.textContent = '一覧で選ぶ';
      back.addEventListener('click', () => {
        items.forEach((it) => it.classList.remove('mmopt-hidden'));
        wrap.remove();
      });

      // 置き場所：選択肢の行と同じ種類の要素で包む（表の中なら行、リストの中なら項目）
      const first = items[0];
      let wrap, inner;
      if (first.tagName === 'TR') {
        wrap = document.createElement('tr');
        inner = document.createElement('td');
        inner.colSpan = 99;
        wrap.appendChild(inner);
      } else {
        wrap = document.createElement(first.tagName === 'LI' ? 'li' : 'div');
        inner = wrap;
      }
      wrap.classList.add('mmopt-select-wrap');
      inner.appendChild(select);
      inner.appendChild(back);
      first.parentNode.insertBefore(wrap, first);
      items.forEach((it) => it.classList.add('mmopt-hidden'));
      sync();
    });
  }

  function syncChecked() {
    document.querySelectorAll('.mmopt-cell').forEach((cell) => {
      const input = cell.__mmoptInput;
      if (input) cell.classList.toggle('mmopt-checked', input.checked);
    });
  }

  function enhanceInputs(root) {
    root.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((input) => {
      if (input.__mmopt) return;
      input.__mmopt = true;
      input.classList.add('mmopt-input');
      const dense = isDense(input);
      if (dense) input.classList.add('mmopt-input-dense');
      const cell = findCell(input);
      if (!cell || cell.__mmoptInput) return;
      cell.__mmoptInput = input;
      cell.classList.add('mmopt-cell');
      if (dense) cell.classList.add('mmopt-dense');
    });
    syncChecked();
  }

  // セルの余白をクリックしたら、中の選択肢をクリックしたことにする
  document.addEventListener('click', (e) => {
    const cell = e.target.closest && e.target.closest('.mmopt-cell');
    if (!cell) return;
    const input = cell.__mmoptInput;
    if (!input || input.disabled) return;
    // 入力欄やラベル、リンク、テキスト入力を直接押した場合は本来の動作に任せる
    if (e.target === input || e.target.closest('label, a, select, textarea, input[type="text"], input[type="number"], button')) return;
    input.click(); // 本物のクリックとして処理されるので、サイト側のチェックもそのまま動く
  });

  // ---------- 表で選んだ列名を表示 ----------

  const clean = (t) => (t || '').replace(/[→⇒]/g, '').replace(/\s+/g, ' ').trim();

  // マスの真上にある、選択肢を含まない細い見出しセルのうち一番近いものを列名とみなす
  function columnLabel(cell) {
    const r = cell.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    let best = null, bestDist = Infinity;
    document.querySelectorAll('th, td').forEach((c) => {
      if (c.querySelector('input, textarea, select')) return;
      const cr = c.getBoundingClientRect();
      if (cr.bottom > r.top + 1 || cr.left > cx || cr.right < cx) return;
      if (cr.width > r.width * 2.5) return; // 横長の区切り行は除外
      const t = clean(c.textContent);
      if (!t) return;
      const d = r.top - cr.bottom;
      if (d < bestDist) { bestDist = d; best = t; }
    });
    return best || '';
  }

  function rowLabel(cell) {
    const row = cell.closest('tr');
    if (!row) return '';
    for (const c of row.cells) {
      if (c.querySelector('input')) continue;
      const t = clean(c.textContent);
      if (t) return t;
    }
    return '';
  }

  let toast = null, toastTimer = null;
  function showToast(text) {
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mmopt-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('mmopt-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('mmopt-show'), 1400);
  }

  const cut = (t, n) => (t.length > n ? t.slice(0, n) + '…' : t);

  document.addEventListener('change', (e) => {
    const input = e.target;
    if (!input || (input.type !== 'radio' && input.type !== 'checkbox')) return;
    syncChecked();
    if (!input.checked || !input.classList.contains('mmopt-input-dense')) return;
    const cell = input.closest('.mmopt-cell') || input.parentElement;
    const col = columnLabel(cell);
    if (!col) return;
    const row = rowLabel(cell);
    showToast((row ? cut(row, 14) + ' → ' : '') + cut(col, 16));
  });

  // ---------- 「次へ」ボタン ----------

  function buttonText(el) {
    return (el.value || el.textContent || el.getAttribute('aria-label') || el.getAttribute('alt') || '').trim();
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  function findNextButtons() {
    const candidates = document.querySelectorAll(
      'input[type="submit"], input[type="button"], input[type="image"], button, a[role="button"], a.btn, a[class*="button"], a[class*="next"]'
    );
    return Array.from(candidates).filter((el) => {
      if (el.id === 'mmopt-float' || !isVisible(el)) return false;
      const t = buttonText(el);
      return NEXT_WORDS.test(t) && !BACK_WORDS.test(t);
    });
  }

  let floatBtn = null;

  function enhanceButtons() {
    const nexts = findNextButtons();
    nexts.forEach((b) => b.classList.add('mmopt-next'));

    if (!isTouch) return;
    const target = nexts[nexts.length - 1]; // ページ下部のボタンを優先
    if (!target) {
      if (floatBtn) { floatBtn.remove(); floatBtn = null; document.body.classList.remove('mmopt-has-float'); }
      return;
    }
    if (!floatBtn) {
      floatBtn = document.createElement('button');
      floatBtn.id = 'mmopt-float';
      floatBtn.type = 'button';
      document.body.appendChild(floatBtn);
      document.body.classList.add('mmopt-has-float');
      floatBtn.addEventListener('click', () => {
        const t = findNextButtons().pop();
        if (t) t.click();
      });
    }
    const label = buttonText(target).replace(/\s+/g, ' ').slice(0, 12) || '次へ';
    const text = label + ' ▶';
    if (floatBtn.textContent !== text) floatBtn.textContent = text; // 同じなら触らない（監視の無限ループ防止）
  }

  // ---------- 実行 & ページ内容の変化に追従 ----------
  function run() {
    convertToSelects();
    enhanceInputs(document);
    enhanceButtons();
  }
  run();

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 150);
  }).observe(document.body, { childList: true, subtree: true });
})();
