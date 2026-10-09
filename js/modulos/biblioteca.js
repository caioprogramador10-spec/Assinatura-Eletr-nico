/* =====================================================================
   BIBLIOTECA — assinaturas salvas para reutilizar em um clique
   ===================================================================== */

const Biblioteca = (() => {
  const LIMITE = 12;
  const NOMES = { desenho: "Desenhada", digitada: "Digitada", imagem: "Imagem" };

  const todas = () => Store.ler("salvas", []);

  function adicionar(dataUrl, origem = "desenho") {
    const lista = todas();
    if (lista.some((s) => s.dataUrl === dataUrl)) return;
    lista.unshift({ id: gerarId("ass"), dataUrl, origem, criadaEm: new Date().toISOString() });
    if (lista.length > LIMITE) lista.length = LIMITE;
    if (Store.gravar("salvas", lista)) {
      UI.aviso("Assinatura salva em Minhas assinaturas.", "sucesso");
      renderizar();
    }
  }

  async function remover(id) {
    const ok = await UI.confirmar({
      titulo: "Excluir assinatura?",
      texto: "Ela sai da sua biblioteca. Documentos já assinados não mudam.",
      botao: "Excluir",
      tom: "perigo",
    });
    if (!ok) return;
    Store.gravar("salvas", todas().filter((s) => s.id !== id));
    renderizar();
    UI.aviso("Assinatura excluída.");
  }

  async function usar(id) {
    const s = todas().find((x) => x.id === id);
    if (!s) return;
    if (Router.atual !== "assinar") Router.ir("assinar");
    await Documento.inserir(s.dataUrl);
  }

  function renderizar() {
    const lista = todas();
    $("#nav-count-salvas").textContent = lista.length || "";

    // mini-galeria no painel de assinatura
    $("#bloco-salvas").hidden = lista.length === 0;
    $("#salvas-mini").innerHTML = lista.slice(0, 6).map((s) => `
      <button type="button" class="salva-mini" data-usar="${s.id}" title="Inserir no documento">
        <img src="${s.dataUrl}" alt="Assinatura salva" />
      </button>`).join("");

    // página da biblioteca
    const grade = $("#grade-salvas");
    if (!lista.length) {
      grade.innerHTML = `
        <div class="panel vazio" style="grid-column:1/-1">
          <div class="empty-ico">${icone("biblioteca")}</div>
          <strong>Nenhuma assinatura salva</strong>
          Ao criar uma assinatura, ligue <em>Salvar em Minhas assinaturas</em> para reutilizá-la depois.
          <div><button class="btn btn-accent" type="button" data-ir="assinar">${icone("mais")}Criar assinatura</button></div>
        </div>`;
      return;
    }
    grade.innerHTML = lista.map((s) => `
      <div class="panel sig-card">
        <div class="sig-card-papel"><img src="${s.dataUrl}" alt="Assinatura salva" /></div>
        <div class="sig-card-info">
          <div><strong>${NOMES[s.origem] || "Assinatura"}</strong><span>Salva em ${formatarDataHora(s.criadaEm)}</span></div>
        </div>
        <div class="sig-card-acoes">
          <button class="btn btn-accent btn-sm" type="button" data-usar="${s.id}">${icone("caneta")}Usar no documento</button>
          <button class="btn btn-icon btn-danger" type="button" data-excluir="${s.id}" title="Excluir" aria-label="Excluir assinatura">${icone("lixeira")}</button>
        </div>
      </div>`).join("");
  }

  function iniciar() {
    document.addEventListener("click", (e) => {
      const u = e.target.closest("[data-usar]");
      if (u) { usar(u.dataset.usar); return; }
      const x = e.target.closest("[data-excluir]");
      if (x) remover(x.dataset.excluir);
    });
    Router.registrar("assinaturas", renderizar);
    renderizar();
  }

  return { iniciar, adicionar, renderizar };
})();
