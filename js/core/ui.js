/* =====================================================================
   UI — aviso (toast), confirmação, tema e menu do celular
   ===================================================================== */

const UI = (() => {
  /* ---------- aviso ---------- */
  function aviso(mensagem, tipo = "info", duracao = 3400) {
    const caixa = $("#toast-container");
    const t = document.createElement("div");
    t.className = "toast toast-" + tipo;
    t.innerHTML = `<span class="dot"></span><span>${escaparHtml(mensagem)}</span>`;
    caixa.appendChild(t);
    requestAnimationFrame(() => t.classList.add("visivel"));
    setTimeout(() => {
      t.classList.remove("visivel");
      setTimeout(() => t.remove(), 260);
    }, duracao);
  }

  /* ---------- confirmação (substitui o confirm() do navegador) ---------- */
  function confirmar({ titulo = "Confirmar", texto = "", botao = "Confirmar", tom = "alerta" } = {}) {
    const overlay = $("#modal-confirmar");
    const sim = $("#confirmar-sim");
    const nao = $("#confirmar-nao");
    $("#confirmar-titulo").textContent = titulo;
    $("#confirmar-texto").textContent = texto;
    $("#confirmar-ico").dataset.tom = tom;
    sim.textContent = botao;
    sim.className = tom === "perigo" ? "btn btn-danger-solid" : "btn btn-accent";
    overlay.classList.add("show");
    document.body.classList.add("camada-aberta");
    setTimeout(() => sim.focus(), 30);

    return new Promise((resolve) => {
      const fechar = (resposta) => {
        overlay.classList.remove("show");
        document.body.classList.remove("camada-aberta");
        sim.onclick = nao.onclick = overlay.onclick = null;
        document.removeEventListener("keydown", tecla);
        resolve(resposta);
      };
      const tecla = (e) => { if (e.key === "Escape") fechar(false); };
      sim.onclick = () => fechar(true);
      nao.onclick = () => fechar(false);
      overlay.onclick = (e) => { if (e.target === overlay) fechar(false); };
      document.addEventListener("keydown", tecla);
    });
  }

  /* ---------- tema ---------- */
  function temaAtual() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function alternarTema() {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    try { localStorage.setItem("assin_tema", novo); } catch (e) { /* armazenamento indisponível */ }
  }

  /* ---------- menu do celular ---------- */
  function abrirMenu() {
    $("#sidebar").classList.add("aberta");
    $("#sb-backdrop").classList.add("show");
  }

  function fecharMenu() {
    $("#sidebar").classList.remove("aberta");
    $("#sb-backdrop").classList.remove("show");
  }

  function iniciar() {
    document.addEventListener("click", (e) => {
      const alvo = e.target.closest("[data-acao]");
      if (!alvo) return;
      const acao = alvo.dataset.acao;
      if (acao === "tema") alternarTema();
      else if (acao === "abrir-menu") abrirMenu();
      else if (acao === "fechar-menu") fecharMenu();
    });
  }

  return { aviso, confirmar, alternarTema, abrirMenu, fecharMenu, iniciar };
})();
