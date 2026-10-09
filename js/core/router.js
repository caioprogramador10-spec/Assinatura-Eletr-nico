/* =====================================================================
   ROUTER — navegação entre páginas pelo #hash da URL
   ===================================================================== */

const Router = (() => {
  const ROTAS = ["assinar", "assinaturas", "historico", "validade"];
  const PADRAO = "assinar";
  const aoEntrar = {};
  let atual = null;

  function rotaDoHash() {
    const r = location.hash.replace("#", "");
    return ROTAS.includes(r) ? r : PADRAO;
  }

  function mostrar(rota) {
    atual = rota;
    document.body.dataset.rota = rota;
    $$(".pagina").forEach((p) => p.classList.toggle("ativa", p.id === "pagina-" + rota));
    $$(".nav-item[data-rota]").forEach((n) => n.classList.toggle("ativo", n.dataset.rota === rota));
    const pagina = $("#pagina-" + rota);
    $("#mobile-titulo").textContent = pagina.dataset.titulo;
    document.title = pagina.dataset.titulo + " · Assinador";
    UI.fecharMenu();
    window.scrollTo({ top: 0 });
    if (aoEntrar[rota]) aoEntrar[rota]();
  }

  function ir(rota) {
    if (location.hash === "#" + rota) mostrar(rota);
    else location.hash = rota;
  }

  function registrar(rota, fn) {
    aoEntrar[rota] = fn;
  }

  function iniciar() {
    document.addEventListener("click", (e) => {
      const alvo = e.target.closest("[data-rota], [data-ir]");
      if (!alvo || alvo.tagName === "A") return;
      ir(alvo.dataset.rota || alvo.dataset.ir);
    });
    window.addEventListener("hashchange", () => mostrar(rotaDoHash()));
    mostrar(rotaDoHash());
  }

  return { iniciar, ir, registrar, get atual() { return atual; } };
})();
