/* =====================================================================
   DOCUMENTO — abre o arquivo, desenha as páginas, miniaturas, zoom
   e cuida das assinaturas posicionadas (arrastar, redimensionar,
   duplicar em todas as páginas, remover).
   Posições ficam em proporções (0–1) da página, então continuam
   certas em qualquer zoom e no PDF final.
   ===================================================================== */

const Documento = (() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const CARIMBO_PT = 7; // tamanho da fonte do carimbo no PDF, em pontos

  const est = {
    bytes: null,          // bytes do PDF (original ou convertido)
    proxy: null,          // documento do pdf.js
    nome: "",
    tamanho: 0,
    pagina: 1,
    total: 0,
    zoom: 1,              // 1 = ajustado à largura
    cssW: 0,
    cssH: 0,
    k: 1,                 // px na tela por ponto do PDF
    colocacoes: [],       // { id, pagina, x, y, w, h, dataUrl }
    selecionada: null,
    tarefa: null,         // render em andamento (para cancelar)
  };

  const el = {};
  const toque = window.matchMedia("(pointer: coarse)").matches;
  const TEXTO_DZ = toque
    ? { titulo: "Toque para escolher o documento", dica: "Do celular, do Drive ou de outro app de arquivos" }
    : { titulo: "Arraste o documento aqui", dica: "ou clique para selecionar um arquivo do computador" };

  /* ---------------------------------------------------------------
     ETAPAS
     --------------------------------------------------------------- */
  function etapa(n, concluida = false) {
    $$(".step").forEach((s) => {
      const i = Number(s.dataset.step);
      s.classList.toggle("feita", i < n || (i === n && concluida));
      s.classList.toggle("ativa", i === n && !concluida);
    });
  }

  function atualizarEtapa() {
    if (!est.proxy) etapa(1);
    else if (est.colocacoes.length === 0) etapa(2);
    else etapa(3);
  }

  /* ---------------------------------------------------------------
     CARREGAR ARQUIVO
     --------------------------------------------------------------- */
  async function carregar(arquivo) {
    if (est.colocacoes.length && est.proxy) {
      const ok = await UI.confirmar({
        titulo: "Trocar de documento?",
        texto: "As assinaturas posicionadas no documento atual serão descartadas.",
        botao: "Trocar documento",
      });
      if (!ok) return;
    }

    convertendo(true, arquivo.name);
    try {
      const bytes = await Conversor.paraPdf(arquivo);
      const proxy = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      if (est.proxy) est.proxy.destroy();

      Object.assign(est, {
        bytes, proxy,
        nome: arquivo.name,
        tamanho: arquivo.size,
        pagina: 1,
        total: proxy.numPages,
        zoom: 1,
        colocacoes: [],
        selecionada: null,
      });

      el.viewer.classList.add("com-doc");
      document.body.classList.add("com-doc");
      el.dropzone.hidden = true;
      el.dropzone.style.display = "none";
      el.pageStage.style.display = "block";
      el.btnTrocar.hidden = false;
      $("#faixa-ok").classList.remove("show");
      el.docNome.textContent = arquivo.name;
      el.docNome.title = arquivo.name;
      el.docMeta.textContent = `${plural(est.total, "página", "páginas")} · ${formatarBytes(arquivo.size)}`;

      await renderizar();
      montarMiniaturas();
      listar();
      atualizarEtapa();
      UI.aviso("Documento pronto. Agora crie sua assinatura.", "sucesso");
    } catch (erro) {
      console.error(erro);
      UI.aviso(erro.message || "Não foi possível abrir esse arquivo.", "erro", 5000);
    } finally {
      convertendo(false);
      el.fileInput.value = "";
    }
  }

  function convertendo(sim, nome) {
    el.dropzone.classList.toggle("convertendo", sim);
    $("#dz-icone use").setAttribute("href", sim ? "#i-carregando" : "#i-upload");
    el.dzTitulo.textContent = sim ? "Preparando documento…" : TEXTO_DZ.titulo;
    el.dzDica.textContent = sim ? `Convertendo "${nome}" para assinatura` : TEXTO_DZ.dica;
  }

  /* ---------------------------------------------------------------
     DESENHAR A PÁGINA
     --------------------------------------------------------------- */
  function escalaAjustada(larguraBase) {
    const disponivel = Math.max(240, el.stage.clientWidth - 56);
    return Math.min(disponivel, 900) / larguraBase;
  }

  async function renderizar() {
    if (!est.proxy) return;
    const pagina = await est.proxy.getPage(est.pagina);
    const base = pagina.getViewport({ scale: 1 });
    const escala = escalaAjustada(base.width) * est.zoom;
    const vp = pagina.getViewport({ scale: escala });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (est.tarefa) { try { est.tarefa.cancel(); } catch (e) { /* já terminou */ } }

    const canvas = el.canvas;
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = vp.width + "px";
    canvas.style.height = vp.height + "px";
    el.pageStage.style.width = vp.width + "px";
    el.pageStage.style.height = vp.height + "px";

    est.cssW = vp.width;
    est.cssH = vp.height;
    est.k = vp.width / base.width;
    ultimaLargura = el.stage.clientWidth;

    est.tarefa = pagina.render({
      canvasContext: canvas.getContext("2d"),
      viewport: vp,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
    });
    try {
      await est.tarefa.promise;
    } catch (e) {
      if (e && e.name === "RenderingCancelledException") return;
      throw e;
    }

    atualizarControles();
    desenharSobreposicao();
  }

  function atualizarControles() {
    el.pagLabel.textContent = est.proxy ? `${est.pagina} / ${est.total}` : "— / —";
    el.btnAnt.disabled = !est.proxy || est.pagina <= 1;
    el.btnProx.disabled = !est.proxy || est.pagina >= est.total;
    el.zoomLabel.textContent = Math.round(est.zoom * 100) + "%";
    el.btnZoomMenos.disabled = !est.proxy || est.zoom <= ZOOM_MIN;
    el.btnZoomMais.disabled = !est.proxy || est.zoom >= ZOOM_MAX;
    el.btnZoomAjustar.disabled = !est.proxy || est.zoom === 1;
    $$(".thumb", el.thumbs).forEach((t) => t.classList.toggle("ativa", Number(t.dataset.pagina) === est.pagina));
    const ativa = $(".thumb.ativa", el.thumbs);
    if (ativa) ativa.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function irPara(n) {
    if (!est.proxy) return;
    n = Math.max(1, Math.min(est.total, n));
    if (n === est.pagina) return;
    est.pagina = n;
    est.selecionada = null;
    renderizar();
    listar();
  }

  function definirZoom(z) {
    est.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
    renderizar();
  }

  /* ---------------------------------------------------------------
     MINIATURAS
     --------------------------------------------------------------- */
  async function montarMiniaturas() {
    const proxy = est.proxy;
    el.thumbs.innerHTML = "";
    for (let n = 1; n <= est.total; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb";
      b.dataset.pagina = n;
      b.title = "Página " + n;
      b.innerHTML = `<canvas></canvas><span class="thumb-num">${n}</span><span class="thumb-sig">${icone("check")}</span>`;
      b.addEventListener("click", () => irPara(n));
      el.thumbs.appendChild(b);
    }
    marcarMiniaturas();
    atualizarControles();

    // desenha uma por vez para não travar documentos grandes
    for (let n = 1; n <= est.total; n++) {
      if (est.proxy !== proxy) return; // documento trocado no meio
      const pagina = await proxy.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const vp = pagina.getViewport({ scale: 180 / base.width });
      const c = $(`.thumb[data-pagina="${n}"] canvas`, el.thumbs);
      if (!c) return;
      c.width = vp.width;
      c.height = vp.height;
      await pagina.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    }
  }

  function marcarMiniaturas() {
    const comAssinatura = new Set(est.colocacoes.map((c) => c.pagina));
    $$(".thumb", el.thumbs).forEach((t) => t.classList.toggle("tem-assinatura", comAssinatura.has(Number(t.dataset.pagina))));
  }

  /* ---------------------------------------------------------------
     CARIMBO (texto abaixo da assinatura) — mesmo texto na tela e no PDF
     --------------------------------------------------------------- */
  function linhasCarimbo(data = new Date()) {
    const linhas = [];
    const nome = $("#carimbo-nome").value.trim();
    if (nome) linhas.push(nome);
    if ($("#carimbo-data").checked) linhas.push("Assinado eletronicamente em " + formatarDataHora(data));
    return linhas;
  }

  /* ---------------------------------------------------------------
     ASSINATURAS POSICIONADAS
     --------------------------------------------------------------- */
  async function inserir(dataUrl) {
    if (!est.proxy) {
      UI.aviso("Importe um documento primeiro.", "erro");
      el.dropzone.focus();
      return false;
    }
    const proporcao = await proporcaoDaImagem(dataUrl);
    const w = 0.3;
    let h = (w * est.cssW / proporcao) / est.cssH;
    if (h > 0.25) h = 0.25; // assinatura muito alta: limita
    const wFinal = (h * est.cssH * proporcao) / est.cssW;
    const c = {
      id: gerarId("sig"),
      pagina: est.pagina,
      x: 0.5 - wFinal / 2,
      y: Math.min(0.72, 1 - h - 0.06),
      w: wFinal,
      h,
      dataUrl,
    };
    est.colocacoes.push(c);
    est.selecionada = c.id;
    $("#faixa-ok").classList.remove("show");
    desenharSobreposicao();
    listar();
    atualizarEtapa();
    // no celular o painel fica abaixo do documento: volta para a página
    if (window.innerWidth <= 1024) el.viewer.scrollIntoView({ behavior: "smooth", block: "start" });
    UI.aviso("Assinatura inserida. Arraste para posicionar.", "sucesso");
    return true;
  }

  function remover(id) {
    est.colocacoes = est.colocacoes.filter((c) => c.id !== id);
    if (est.selecionada === id) est.selecionada = null;
    desenharSobreposicao();
    listar();
    atualizarEtapa();
  }

  function duplicarEmTodas(origem) {
    let adicionadas = 0;
    for (let p = 1; p <= est.total; p++) {
      if (p === origem.pagina) continue;
      const jaTem = est.colocacoes.some((c) =>
        c.pagina === p && c.dataUrl === origem.dataUrl &&
        Math.abs(c.x - origem.x) < 0.001 && Math.abs(c.y - origem.y) < 0.001);
      if (jaTem) continue;
      est.colocacoes.push({ ...origem, id: gerarId("sig"), pagina: p });
      adicionadas++;
    }
    desenharSobreposicao();
    listar();
    if (adicionadas) UI.aviso(`Assinatura repetida em mais ${plural(adicionadas, "página", "páginas")}.`, "sucesso");
    else UI.aviso(est.total > 1 ? "Todas as páginas já têm essa assinatura nessa posição." : "O documento tem só uma página.");
  }

  function selecionar(id) {
    est.selecionada = id;
    $$(".sigbox", el.overlay).forEach((b) => b.classList.toggle("selecionada", b.dataset.id === id));
  }

  function desenharSobreposicao() {
    el.overlay.innerHTML = "";
    const W = est.cssW, H = est.cssH;
    const linhas = linhasCarimbo();
    const fonte = CARIMBO_PT * est.k;

    est.colocacoes.filter((c) => c.pagina === est.pagina).forEach((c) => {
      const caixa = document.createElement("div");
      caixa.className = "sigbox" + (c.id === est.selecionada ? " selecionada" : "") + (c.y * H < 56 ? " acoes-abaixo" : "");
      caixa.dataset.id = c.id;
      Object.assign(caixa.style, { left: c.x * W + "px", top: c.y * H + "px", width: c.w * W + "px", height: c.h * H + "px" });
      caixa.innerHTML = `
        <img src="${c.dataUrl}" alt="Assinatura" draggable="false" />
        ${linhas.length ? `<div class="sigbox-carimbo" style="font-size:${fonte}px;line-height:${fonte * 1.22}px;margin-top:${fonte * 0.35}px">${linhas.map(escaparHtml).join("<br>")}</div>` : ""}
        <div class="sigbox-acoes">
          ${est.total > 1 ? `<button type="button" data-a="dup" title="Repetir em todas as páginas (Ctrl+D)">${icone("copiar")}</button>` : ""}
          <button type="button" data-a="del" class="perigo" title="Remover (Delete)">${icone("lixeira")}</button>
        </div>
        <div class="sigbox-handle" title="Redimensionar"></div>`;
      el.overlay.appendChild(caixa);
      ligarArrasto(caixa, c);
    });
  }

  function ligarArrasto(caixa, c) {
    const W = est.cssW, H = est.cssH;
    let modo = null, sx = 0, sy = 0, ox = 0, oy = 0, ow = 0;
    const proporcao = (c.w * W) / (c.h * H);

    caixa.addEventListener("pointerdown", (e) => {
      const acao = e.target.closest("[data-a]");
      if (acao) return;
      e.preventDefault();
      selecionar(c.id);
      modo = e.target.closest(".sigbox-handle") ? "redim" : "mover";
      sx = e.clientX; sy = e.clientY;
      ox = caixa.offsetLeft; oy = caixa.offsetTop; ow = caixa.offsetWidth;
      caixa.setPointerCapture(e.pointerId);
    });

    caixa.addEventListener("pointermove", (e) => {
      if (!modo) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (modo === "mover") {
        const nx = Math.max(0, Math.min(ox + dx, W - caixa.offsetWidth));
        const ny = Math.max(0, Math.min(oy + dy, H - caixa.offsetHeight));
        caixa.style.left = nx + "px";
        caixa.style.top = ny + "px";
        c.x = nx / W;
        c.y = ny / H;
      } else {
        // redimensiona mantendo a proporção da assinatura
        let nw = Math.max(36, ow + Math.max(dx, dy * proporcao));
        nw = Math.min(nw, W - caixa.offsetLeft, (H - caixa.offsetTop) * proporcao);
        const nh = nw / proporcao;
        caixa.style.width = nw + "px";
        caixa.style.height = nh + "px";
        c.w = nw / W;
        c.h = nh / H;
      }
    });

    const soltar = () => { if (modo) { modo = null; listar(); } };
    caixa.addEventListener("pointerup", soltar);
    caixa.addEventListener("pointercancel", soltar);

    caixa.querySelector(".sigbox-acoes").addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.a === "del") remover(c.id);
      else duplicarEmTodas(c);
    });
  }

  /* ---------------------------------------------------------------
     LISTA NO PAINEL LATERAL
     --------------------------------------------------------------- */
  function listar() {
    const lista = $("#lista-pos");
    const n = est.colocacoes.length;
    $("#count-posicionadas").textContent = n || "";
    $("#btn-baixar").disabled = n === 0;
    $("#btn-baixar-mobile").disabled = n === 0;
    $("#btn-baixar-mobile").lastChild.textContent = n ? `Baixar PDF (${n})` : "Baixar PDF";
    marcarMiniaturas();

    if (!n) {
      lista.innerHTML = `<div class="vazio-mini">Nenhuma assinatura posicionada ainda.</div>`;
      return;
    }
    const ordenadas = [...est.colocacoes].sort((a, b) => a.pagina - b.pagina);
    lista.innerHTML = ordenadas.map((c) => `
      <div class="item-pos ${c.pagina === est.pagina ? "atual" : ""}" data-id="${c.id}" data-pagina="${c.pagina}" title="Ir para a página ${c.pagina}">
        <span class="item-pos-img"><img src="${c.dataUrl}" alt="" /></span>
        <span class="item-pos-txt"><strong>Página ${c.pagina}</strong><span>${Math.round(c.w * 100)}% da largura</span></span>
        <button class="btn btn-icon" type="button" data-remover="${c.id}" title="Remover" aria-label="Remover assinatura">${icone("lixeira")}</button>
      </div>`).join("");
  }

  /* ---------------------------------------------------------------
     NOVO DOCUMENTO
     --------------------------------------------------------------- */
  function limpar() {
    if (est.proxy) est.proxy.destroy();
    Object.assign(est, { bytes: null, proxy: null, nome: "", tamanho: 0, pagina: 1, total: 0, zoom: 1, colocacoes: [], selecionada: null });
    el.viewer.classList.remove("com-doc");
    document.body.classList.remove("com-doc");
    el.thumbs.innerHTML = "";
    el.overlay.innerHTML = "";
    el.pageStage.style.display = "none";
    el.dropzone.hidden = false;
    el.dropzone.style.display = "";
    el.btnTrocar.hidden = true;
    el.docNome.textContent = "Nenhum documento";
    el.docMeta.textContent = "Importe um arquivo para começar";
    $("#faixa-ok").classList.remove("show");
    atualizarControles();
    listar();
    etapa(1);
  }

  /* ---------------------------------------------------------------
     EVENTOS
     --------------------------------------------------------------- */
  let ultimaLargura = 0;

  function iniciar() {
    Object.assign(el, {
      viewer: $("#viewer"),
      stage: $("#stage"),
      dropzone: $("#dropzone"),
      fileInput: $("#file-input"),
      dzTitulo: $("#dz-titulo"),
      dzDica: $("#dz-dica"),
      pageStage: $("#pageStage"),
      canvas: $("#pdfCanvas"),
      overlay: $("#overlay"),
      thumbs: $("#thumbs"),
      docNome: $("#doc-nome"),
      docMeta: $("#doc-meta"),
      pagLabel: $("#pag-label"),
      btnAnt: $("#btn-pag-ant"),
      btnProx: $("#btn-pag-prox"),
      zoomLabel: $("#zoom-label"),
      btnZoomMenos: $("#btn-zoom-menos"),
      btnZoomMais: $("#btn-zoom-mais"),
      btnZoomAjustar: $("#btn-zoom-ajustar"),
      btnTrocar: $("#btn-trocar"),
    });

    // importar
    el.dropzone.addEventListener("click", () => el.fileInput.click());
    el.dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.fileInput.click(); } });
    el.btnTrocar.addEventListener("click", () => el.fileInput.click());
    el.fileInput.addEventListener("change", (e) => { if (e.target.files[0]) carregar(e.target.files[0]); });

    // arrastar arquivo para qualquer lugar do visualizador
    el.viewer.addEventListener("dragover", (e) => { e.preventDefault(); el.dropzone.classList.add("arrastando"); });
    el.viewer.addEventListener("dragleave", (e) => { if (!el.viewer.contains(e.relatedTarget)) el.dropzone.classList.remove("arrastando"); });
    el.viewer.addEventListener("drop", (e) => {
      e.preventDefault();
      el.dropzone.classList.remove("arrastando");
      if (e.dataTransfer.files[0]) carregar(e.dataTransfer.files[0]);
    });

    // páginas e zoom
    el.btnAnt.addEventListener("click", () => irPara(est.pagina - 1));
    el.btnProx.addEventListener("click", () => irPara(est.pagina + 1));
    el.btnZoomMenos.addEventListener("click", () => definirZoom(est.zoom - 0.25));
    el.btnZoomMais.addEventListener("click", () => definirZoom(est.zoom + 0.25));
    el.btnZoomAjustar.addEventListener("click", () => definirZoom(1));

    // lista lateral
    $("#lista-pos").addEventListener("click", (e) => {
      const rem = e.target.closest("[data-remover]");
      if (rem) { remover(rem.dataset.remover); return; }
      const item = e.target.closest(".item-pos");
      if (!item) return;
      irPara(Number(item.dataset.pagina));
      selecionar(item.dataset.id);
    });

    // clicar fora tira a seleção
    el.stage.addEventListener("pointerdown", (e) => { if (!e.target.closest(".sigbox")) selecionar(null); });

    // carimbo: a prévia acompanha o que for digitado
    $("#carimbo-data").addEventListener("change", desenharSobreposicao);
    $("#carimbo-nome").addEventListener("input", desenharSobreposicao);

    // atalhos de teclado
    document.addEventListener("keydown", (e) => {
      if (Router.atual !== "assinar" || !est.proxy) return;
      if (e.target.matches("input, textarea, select") || document.body.classList.contains("camada-aberta")) return;
      const sel = est.colocacoes.find((c) => c.id === est.selecionada);
      if (e.key === "ArrowLeft") irPara(est.pagina - 1);
      else if (e.key === "ArrowRight") irPara(est.pagina + 1);
      else if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); remover(sel.id); }
      else if (e.key === "Escape") selecionar(null);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && sel) { e.preventDefault(); duplicarEmTodas(sel); }
    });

    // redesenha quando a largura disponível muda
    let espera = null;
    new ResizeObserver(() => {
      if (!est.proxy || Math.abs(el.stage.clientWidth - ultimaLargura) < 4) return;
      clearTimeout(espera);
      espera = setTimeout(renderizar, 160);
    }).observe(el.stage);

    convertendo(false);
    listar();
    atualizarControles();
    etapa(1);
  }

  return {
    iniciar, inserir, limpar, etapa, linhasCarimbo,
    get estado() { return est; },
  };
})();
