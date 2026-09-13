export {};

import packageJson from "../package.json";

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

const DEFAULT_NEO_BASE = "https://oekakibbs.moe/apps/neo/";
const APP_VERSION = packageJson.version;
const NEO_GITHUB_REPOSITORY = "funige/neo";
const NEO_GITHUB_BRANCH = "master";
const NEO_LATEST_COMMIT_URL = `https://api.github.com/repos/${NEO_GITHUB_REPOSITORY}/commits/${NEO_GITHUB_BRANCH}`;
const NEO_JSDELIVR_BASE = `https://cdn.jsdelivr.net/gh/${NEO_GITHUB_REPOSITORY}`;
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
  if (window.Neo) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`NEO を読み込めません: ${url}`));
    document.head.append(script);
  });
}

function withCacheBust(url: string): string {
  const next = new URL(url);
  next.searchParams.set("nicoNeo", Date.now().toString(36));
  return next.href;
}

/** Resolve master once, then use an immutable jsDelivr URL for this launch. */
async function latestNeoBase(): Promise<string> {
  try {
    const response = await fetch(NEO_LATEST_COMMIT_URL, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/vnd.github+json" },
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
    const data: unknown = await response.json();
    const sha = typeof data === "object" && data !== null && "sha" in data
      ? (data as { sha?: unknown }).sha
      : undefined;
    if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
      throw new Error("GitHub API から NEO のコミット SHA を取得できませんでした。");
    }
    return `${NEO_JSDELIVR_BASE}@${sha}/dist/`;
  } catch (error) {
    console.warn("NicoNEO: 最新の NEO を取得できないため代替配信 URL を使用します。", error);
    return DEFAULT_NEO_BASE;
  }
}

async function loadNeo(): Promise<void> {
  const latestBase = await latestNeoBase();
  const loadFrom = async (base: string, cacheBust: boolean) => {
    const css = new URL("neo.css", base).href;
    const js = new URL("neo.js", base).href;
    await loadStylesheet(cacheBust ? withCacheBust(css) : css);
    await loadScript(cacheBust ? withCacheBust(js) : js);
    if (!window.Neo) throw new Error(`NEO が定義されませんでした: ${js}`);
  };

  try {
    await loadFrom(latestBase, latestBase === DEFAULT_NEO_BASE);
  } catch (error) {
    if (latestBase === DEFAULT_NEO_BASE) throw error;
    console.warn("NicoNEO: jsDelivr から NEO を読み込めないため代替配信 URL を使用します。", error);
    await loadFrom(DEFAULT_NEO_BASE, true);
  }
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

  const width = Math.max(1, target.width || Math.round(target.getBoundingClientRect().width));
  const height = Math.max(1, target.height || Math.round(target.getBoundingClientRect().height));
  // Reserve room for the overlay padding, title bar, and borders.  NEO's
  // applet dimensions include its controls, so only the canvas itself will
  // scroll when an unusually large canvas cannot fit in the viewport.
  const appletWidth = Math.min(
    Math.max(width + 100, 400),
    Math.max(300, window.innerWidth - 48),
  );
  const appletHeight = Math.min(
    Math.max(height + 160, 460),
    Math.max(360, window.innerHeight - 72),
  );

  const root = document.createElement("div");
  root.id = ROOT_ID;
  // NEO itself creates one `.NEO` element and hides subsequent matches as a
  // duplicate-instance safeguard. The wrapper must not share that class.
  root.innerHTML = `
    <div class="nico-neo-shade" role="dialog" aria-modal="true" aria-label="PaintBBS NEO">
      <div class="nico-neo-panel">
        <div class="nico-neo-bar">
          <strong>NicoNEO v${APP_VERSION} / PaintBBS NEO</strong>
          <span>「投稿」でお絵カキコのキャンバスへ反映します</span>
          <button type="button" class="nico-neo-close" aria-label="閉じる">×</button>
        </div>
        <div class="neo-applet-paintbbs" data-width="${appletWidth}" data-height="${appletHeight}"></div>
      </div>
    </div>`;
  document.body.append(root);

  const style = document.createElement("style");
  style.textContent = `
    #${ROOT_ID} .nico-neo-shade{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;box-sizing:border-box;padding:20px 24px;background:#0009;overflow:hidden}
    #${ROOT_ID} .nico-neo-panel{max-width:100%;max-height:100%;overflow:hidden;background:#fff;box-shadow:0 8px 30px #000}
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
      await loadNeo();
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
