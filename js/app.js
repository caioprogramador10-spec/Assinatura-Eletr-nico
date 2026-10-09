/* =====================================================================
   APP — ponto de partida
   ===================================================================== */

(function iniciarApp() {
  if (typeof pdfjsLib === "undefined" || typeof PDFLib === "undefined") {
    document.body.insertAdjacentHTML("afterbegin",
      `<div style="position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:200;padding:11px 18px;border-radius:999px;background:var(--surface-solid);border:1px solid var(--danger-border);color:var(--danger-text);font-size:13px;box-shadow:var(--shadow-lg)">
        Não foi possível carregar as bibliotecas de PDF. Verifique sua conexão com a internet e recarregue a página.
      </div>`);
    return;
  }

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  $("#data-hoje").textContent = hoje;

  UI.iniciar();
  Documento.iniciar();
  Criador.iniciar();
  Exportar.iniciar();
  Biblioteca.iniciar();
  Historico.iniciar();

  $("#btn-novo-doc").addEventListener("click", () => {
    Documento.limpar();
    UI.aviso("Pronto para o próximo documento.");
  });

  // barra de ações do celular
  $("#btn-ir-assinatura").addEventListener("click", () => $("#painel-assinatura").scrollIntoView({ behavior: "smooth", block: "start" }));
  $("#btn-baixar-mobile").addEventListener("click", () => $("#btn-baixar").click());

  Router.registrar("assinar", () => requestAnimationFrame(Criador.ajustarPad));
  Router.iniciar();
})();
