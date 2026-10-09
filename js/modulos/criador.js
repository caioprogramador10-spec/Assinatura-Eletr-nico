/* =====================================================================
   CRIADOR — cria a assinatura de três formas: desenhando, digitando
   ou enviando uma imagem. Toda assinatura sai como PNG transparente,
   recortado rente à tinta.
   ===================================================================== */

const Criador = (() => {
  const FONTES = [
    { id: "caneta", nome: "Caneta", familia: "'Caveat', cursive", estilo: "600" },
    { id: "cursiva", nome: "Cursiva", familia: "'Dancing Script', cursive", estilo: "600" },
    { id: "elegante", nome: "Elegante", familia: "'Great Vibes', cursive", estilo: "400" },
    { id: "formal", nome: "Formal", familia: "'Fraunces', serif", estilo: "italic 500" },
  ];

  const pad = {
    canvas: null,
    ctx: null,
    tracos: [],      // cada traço: { cor, largura, pontos: [{x, y}] }
    atual: null,
    cor: "#12203a",
    largura: 2.6,
  };

  let fonteAtual = FONTES[0];
  let imagemEnviada = null;

  /* ---------------------------------------------------------------
     ABAS
     --------------------------------------------------------------- */
  function trocarAba(aba) {
    $$(".side .seg-opt").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.aba === aba)));
    $$(".aba").forEach((p) => p.classList.toggle("ativa", p.dataset.abaPainel === aba));
    if (aba === "desenhar") requestAnimationFrame(ajustarPad);
  }

  /* ---------------------------------------------------------------
     DESENHAR
     --------------------------------------------------------------- */
  function ajustarPad() {
    const r = pad.canvas.getBoundingClientRect();
    if (!r.width) return; // aba escondida
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pad.canvas.width = Math.round(r.width * dpr);
    pad.canvas.height = Math.round(r.height * dpr);
    pad.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redesenharPad();
  }

  function desenharTraco(ctx, t) {
    const p = t.pontos;
    ctx.strokeStyle = t.cor;
    ctx.fillStyle = t.cor;
    ctx.lineWidth = t.largura;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (p.length === 1) {
      ctx.beginPath();
      ctx.arc(p[0].x, p[0].y, t.largura / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // curva suave passando pelos pontos médios
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i].x + p[i + 1].x) / 2;
      const my = (p[i].y + p[i + 1].y) / 2;
      ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    const ult = p[p.length - 1];
    ctx.lineTo(ult.x, ult.y);
    ctx.stroke();
  }

  function redesenharPad() {
    const { ctx, canvas } = pad;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pad.tracos.forEach((t) => desenharTraco(ctx, t));
    if (pad.atual) desenharTraco(ctx, pad.atual);
    $("#papel-pad").classList.toggle("desenhado", pad.tracos.length > 0 || !!pad.atual);
  }

  function posicao(e) {
    const r = pad.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function ligarPad() {
    const c = pad.canvas;
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      pad.atual = { cor: pad.cor, largura: pad.largura, pontos: [posicao(e)] };
      redesenharPad();
    });
    c.addEventListener("pointermove", (e) => {
      if (!pad.atual) return;
      const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      eventos.forEach((ev) => pad.atual.pontos.push(posicao(ev)));
      redesenharPad();
    });
    const fim = () => {
      if (!pad.atual) return;
      pad.tracos.push(pad.atual);
      pad.atual = null;
      redesenharPad();
    };
    c.addEventListener("pointerup", fim);
    c.addEventListener("pointercancel", fim);
  }

  /* desenha os traços de novo em alta resolução e recorta */
  function assinaturaDesenhada() {
    if (!pad.tracos.length) return null;
    const r = pad.canvas.getBoundingClientRect();
    const escala = 3;
    const c = document.createElement("canvas");
    c.width = Math.round(r.width * escala);
    c.height = Math.round(r.height * escala);
    const ctx = c.getContext("2d");
    ctx.scale(escala, escala);
    pad.tracos.forEach((t) => desenharTraco(ctx, t));
    const recortado = recortarCanvas(c, 12);
    return recortado ? recortado.toDataURL("image/png") : null;
  }

  /* ---------------------------------------------------------------
     DIGITAR
     --------------------------------------------------------------- */
  function montarFontes() {
    $("#fontes").innerHTML = FONTES.map((f) => `
      <button type="button" class="fonte-opt" data-fonte="${f.id}" aria-pressed="${f.id === fonteAtual.id}">
        <span class="amostra" style="font-family:${f.familia};font-style:${f.estilo.includes("italic") ? "italic" : "normal"}">Assinatura</span>
        <small>${f.nome}</small>
      </button>`).join("");
  }

  function atualizarPrevia() {
    const previa = $("#previa-digitada");
    previa.textContent = $("#nome-digitado").value.trim() || "Seu Nome";
    previa.style.fontFamily = fonteAtual.familia;
    previa.style.fontStyle = fonteAtual.estilo.includes("italic") ? "italic" : "normal";
    $$(".fonte-opt").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fonte === fonteAtual.id)));
  }

  async function assinaturaDigitada() {
    const nome = $("#nome-digitado").value.trim();
    if (!nome) return null;
    const tamanho = 120;
    const fonteCss = `${fonteAtual.estilo} ${tamanho}px ${fonteAtual.familia}`;
    try { await document.fonts.load(fonteCss, nome); } catch (e) { /* usa a fonte reserva */ }

    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    ctx.font = fonteCss;
    const largura = Math.ceil(ctx.measureText(nome).width);
    c.width = largura + 120;
    c.height = Math.round(tamanho * 2);
    ctx.font = fonteCss; // redimensionar o canvas zera o contexto
    ctx.fillStyle = "#12203a";
    ctx.textBaseline = "middle";
    ctx.fillText(nome, 60, c.height / 2);
    const recortado = recortarCanvas(c, 10);
    return recortado ? recortado.toDataURL("image/png") : null;
  }

  /* ---------------------------------------------------------------
     IMAGEM
     --------------------------------------------------------------- */
  async function receberImagem(arquivo) {
    if (!arquivo || !arquivo.type.startsWith("image/")) {
      UI.aviso("Envie um arquivo de imagem (PNG ou JPG).", "erro");
      return;
    }
    imagemEnviada = await lerComoDataUrl(arquivo);
    const caixa = $("#img-drop");
    caixa.classList.add("com-imagem");
    caixa.innerHTML = `<img src="${imagemEnviada}" alt="Prévia da assinatura" />`;
    $("#btn-usar-imagem").disabled = false;
  }

  async function assinaturaDaImagem() {
    if (!imagemEnviada) return null;
    const im = await carregarImagem(imagemEnviada);
    const escala = Math.min(1, 1400 / Math.max(im.width, im.height));
    const c = document.createElement("canvas");
    c.width = Math.round(im.width * escala);
    c.height = Math.round(im.height * escala);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    if ($("#remover-fundo").checked) removerFundoClaro(c);
    const recortado = recortarCanvas(c, 6) || c;
    return recortado.toDataURL("image/png");
  }

  /* ---------------------------------------------------------------
     USAR (inserir no documento e, se pedido, salvar)
     --------------------------------------------------------------- */
  async function usar(dataUrl, origem) {
    if (!dataUrl) return;
    if ($("#salvar-biblioteca").checked) Biblioteca.adicionar(dataUrl, origem);
    await Documento.inserir(dataUrl);
  }

  function iniciar() {
    pad.canvas = $("#padCanvas");
    pad.ctx = pad.canvas.getContext("2d");
    ligarPad();
    new ResizeObserver(ajustarPad).observe(pad.canvas);

    $$(".side .seg-opt").forEach((b) => b.addEventListener("click", () => trocarAba(b.dataset.aba)));

    $$(".tinta").forEach((b) => b.addEventListener("click", () => {
      pad.cor = b.dataset.tinta;
      $$(".tinta").forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
    }));
    $("#espessura").addEventListener("input", (e) => { pad.largura = Number(e.target.value); });

    $("#btn-desfazer").addEventListener("click", () => { pad.tracos.pop(); redesenharPad(); });
    $("#btn-limpar").addEventListener("click", () => { pad.tracos = []; redesenharPad(); });
    $("#btn-usar-desenho").addEventListener("click", () => {
      const d = assinaturaDesenhada();
      if (!d) { UI.aviso("Desenhe sua assinatura primeiro.", "erro"); return; }
      usar(d, "desenho");
    });

    montarFontes();
    atualizarPrevia();
    $("#nome-digitado").addEventListener("input", atualizarPrevia);
    $("#fontes").addEventListener("click", (e) => {
      const b = e.target.closest(".fonte-opt");
      if (!b) return;
      fonteAtual = FONTES.find((f) => f.id === b.dataset.fonte);
      atualizarPrevia();
    });
    $("#btn-usar-digitada").addEventListener("click", async () => {
      const d = await assinaturaDigitada();
      if (!d) { UI.aviso("Digite seu nome.", "erro"); $("#nome-digitado").focus(); return; }
      usar(d, "digitada");
    });

    const drop = $("#img-drop");
    const input = $("#img-input");
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    drop.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
    drop.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); receberImagem(e.dataTransfer.files[0]); });
    input.addEventListener("change", () => { receberImagem(input.files[0]); input.value = ""; });
    $("#btn-usar-imagem").addEventListener("click", async () => usar(await assinaturaDaImagem(), "imagem"));
  }

  return { iniciar, trocarAba, ajustarPad };
})();
