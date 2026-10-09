/* =====================================================================
   UTILS — funções pequenas usadas por todos os módulos
   ===================================================================== */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function icone(nome, extra = "") {
  return `<svg class="ico ${extra}"><use href="#i-${nome}"/></svg>`;
}

function gerarId(prefixo = "id") {
  return prefixo + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/* ---------- datas e tamanhos ---------- */
function formatarDataHora(data) {
  const d = data instanceof Date ? data : new Date(data);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarDataCurta(data) {
  const d = data instanceof Date ? data : new Date(data);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function formatarBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
}

function plural(n, um, varios) {
  return n + " " + (n === 1 ? um : varios);
}

/* ---------- arquivos e imagens ---------- */
function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(arquivo);
  });
}

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
    im.src = src;
  });
}

function dataUrlParaBytes(dataUrl) {
  const binario = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/* Recorta as bordas transparentes de um canvas, deixando uma margem.
   Assim a assinatura ocupa a caixa inteira ao ser posicionada. */
function recortarCanvas(canvas, margem = 8) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const dados = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dados[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // canvas vazio
  x0 = Math.max(0, x0 - margem);
  y0 = Math.max(0, y0 - margem);
  x1 = Math.min(w - 1, x1 + margem);
  y1 = Math.min(h - 1, y1 + margem);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/* Torna transparente o fundo claro de uma foto de assinatura em papel. */
function removerFundoClaro(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum > 205) d[i + 3] = 0;
    else if (lum > 150) d[i + 3] = Math.round(d[i + 3] * (205 - lum) / 55);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* Proporção (largura / altura) de uma imagem em data URL */
async function proporcaoDaImagem(dataUrl) {
  const im = await carregarImagem(dataUrl);
  return im.width / Math.max(1, im.height);
}
