export {};

/**
 * PaintBBS NEO launcher for the Niconico Encyclopedia Oekakiko editor.
 *
 * This file is bundled as an IIFE.  It deliberately uses the official NEO
 * distribution at a pinned release instead of copying the editor into the
 * bookmark URL: doing so keeps the bookmarklet well below browser URL limits.
 */

declare global {
  interface Window {
    Neo?: NeoApi;
    __nicoNeo?: { close(): void };
  }

  interface Document {
    paintBBSCallback?: (message: string) => boolean | string | void;
  }
}

interface NeoApi {
  params: Record<string, Record<string, string>>;
  init(): boolean;
  start(): void;
  painter: { getImage(): HTMLCanvasElement };
}

const NEO_VERSION = "1.7.26";
// The upstream project does not create a Git tag for every displayed version.
// Pin the verified commit so a future master update cannot silently change this
// bookmarklet's editor implementation.
const NEO_REVISION = "96dbb2a8e25ad48c2b23490c4d9c06c33e046cea";
const NEO_BASE = `https://cdn.jsdelivr.net/gh/funige/neo@${NEO_REVISION}/dist`;
const ROOT_ID = "nico-neo-bookmarklet";

function fail(message: string): never {
  window.alert(`NicoNEO: ${message}`);
  throw new Error(message);
}

function loadStylesheet(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`CSS を読み込めません: ${url}`));
    document.head.append(link);
  });
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`NEO を読み込めません: ${url}`));
    document.head.append(script);
  });
}

function visibleCanvas(candidate: HTMLCanvasElement): boolean {
  const style = getComputedStyle(candidate);
  const rect = candidate.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

/** The native editor's drawable canvas is normally its largest visible canvas. */
function findOekakikoCanvas(): HTMLCanvasElement | null {
  return [...document.querySelectorAll("canvas")]
    .filter((canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement)
    .filter((canvas) => !canvas.closest(`#${ROOT_ID}`))
    .filter(visibleCanvas)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

function findNativeSubmit(canvas: HTMLCanvasElement): HTMLElement | null {
  const scope = canvas.closest("form, section, main, div") ?? document.body;
  const controls = [...scope.querySelectorAll<HTMLElement>("button, input[type=submit], input[type=button]" )];
  return controls.find((control) => /投稿|送信|完了|upload|submit/i.test(
    control instanceof HTMLInputElement ? control.value : control.textContent ?? "",
  )) ?? null;
}

function emitNativeEvents(canvas: HTMLCanvasElement): void {
  canvas.dispatchEvent(new Event("input", { bubbles: true }));
  canvas.dispatchEvent(new Event("change", { bubbles: true }));
}

function install(): void {
  window.__nicoNeo?.close();

  const target = findOekakikoCanvas();
  if (!target) {
    fail("お絵カキコの編集画面で実行してください（投稿用キャンバスが見つかりません）。");
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "NEO";
  root.innerHTML = `
    <div class="nico-neo-shade" role="dialog" aria-modal="true" aria-label="PaintBBS NEO">
      <div class="nico-neo-panel">
        <div class="nico-neo-bar">
          <strong>PaintBBS NEO</strong>
          <span>「投稿」でお絵カキコのキャンバスへ反映します</span>
          <button type="button" class="nico-neo-close" aria-label="閉じる">×</button>
        </div>
        <div class="neo-applet-paintbbs" data-width="720" data-height="640"></div>
      </div>
    </div>`;
  document.body.append(root);

  const style = document.createElement("style");
  style.textContent = `
    #${ROOT_ID} .nico-neo-shade{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#0009}
    #${ROOT_ID} .nico-neo-panel{max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;background:#fff;box-shadow:0 8px 30px #000}
    #${ROOT_ID} .nico-neo-bar{display:flex;gap:12px;align-items:center;padding:8px 12px;color:#222;font:14px sans-serif}
    #${ROOT_ID} .nico-neo-bar span{flex:1}.nico-neo-close{font-size:22px;line-height:1}
  `;
  document.head.append(style);

  const close = () => {
    document.paintBBSCallback = undefined;
    root.remove();
    style.remove();
    delete window.__nicoNeo;
  };
  root.querySelector<HTMLButtonElement>(".nico-neo-close")?.addEventListener("click", close);
  window.__nicoNeo = { close };

  const width = Math.max(1, target.width || Math.round(target.getBoundingClientRect().width));
  const height = Math.max(1, target.height || Math.round(target.getBoundingClientRect().height));

  // NEO calls this when its built-in 投稿 button is pressed. Returning false
  // prevents NEO's PaintBBS-protocol upload; the host editor remains responsible
  // for its normal authenticated submission.
  document.paintBBSCallback = (message) => {
    if (message !== "check") return undefined;
    const image = window.Neo?.painter.getImage();
    const context = target.getContext("2d");
    if (!image || !context) return false;
    context.save();
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(image, 0, 0, target.width, target.height);
    context.restore();
    emitNativeEvents(target);
    close();
    findNativeSubmit(target)?.focus();
    window.alert("NEO の絵をお絵カキコに反映しました。元の「投稿」ボタンで送信してください。");
    return false;
  };

  const start = async () => {
    try {
      await loadStylesheet(`${NEO_BASE}/paintbbs-${NEO_VERSION}.css`);
      await loadScript(`${NEO_BASE}/paintbbs-${NEO_VERSION}.js`);
      const neo = window.Neo;
      if (!neo) fail("NEO の初期化に失敗しました。");
      neo.params = {
        paintbbs: {
          image_width: String(width),
          image_height: String(height),
          neo_show_right_button: "true",
          neo_disable_grid_touch_move: "true",
          neo_confirm_unload: "false",
        },
      };
      if (!neo.init()) fail("NEO の描画領域を初期化できませんでした。");
      neo.start();
    } catch (error) {
      close();
      fail(error instanceof Error ? error.message : "予期しないエラーです。");
    }
  };
  void start();
}

install();
