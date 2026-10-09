/* =====================================================================
   HISTÓRICO — registro local dos documentos assinados
   (só metadados: nome, data, páginas — nunca o arquivo)
   ===================================================================== */

const Historico = (() => {
  const LIMITE = 200;
  const todos = () => Store.ler("historico", []);

  function registrar(item) {
    const lista = todos();
    lista.unshift({ id: gerarId("doc"), ...item });
    if (lista.length > LIMITE) lista.length = LIMITE;
    Store.gravar("historico", lista);
    renderizar();
  }

  function stat(num, rotulo, meta, ico, tom = "") {
    return `
      <div class="stat ${tom}">
        <span class="stat-ico">${icone(ico)}</span>
        <div class="num">${num}</div>
        <div class="lbl">${rotulo}</div>
        <div class="meta">${meta}</div>
      </div>`;
  }

  function renderizar() {
    const lista = todos();
    $("#nav-count-historico").textContent = lista.length || "";

    const assinaturas = lista.reduce((s, d) => s + (d.assinaturas || 0), 0);
    const paginas = lista.reduce((s, d) => s + (d.paginas || 0), 0);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const noMes = lista.filter((d) => new Date(d.data) >= inicioMes).length;
    const ultimo = lista[0];

    $("#stats-historico").innerHTML =
      stat(lista.length, "Documentos", "assinados neste navegador", "documento", "warn") +
      stat(noMes, "Neste mês", inicioMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }), "relogio", "ok") +
      stat(assinaturas, "Assinaturas", "aplicadas no total", "caneta") +
      stat(ultimo ? formatarDataCurta(ultimo.data) : "—", "Último", ultimo ? escaparHtml(ultimo.nome) : "nenhum ainda", "historico", "amber");

    $("#btn-limpar-historico").disabled = !lista.length;

    const tbody = $("#tbody-historico");
    if (!lista.length) {
      tbody.innerHTML = `
        <tr><td colspan="5" class="empty">
          <div class="empty-ico">${icone("historico")}</div>
          <strong>Nenhum documento assinado ainda</strong>
          Os documentos que você baixar assinados aparecem aqui.
        </td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map((d) => `
      <tr class="linha-ok">
        <td>
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <span class="formato-ico" style="color:var(--danger-text);background:var(--danger-soft);border-color:var(--danger-border)">PDF</span>
            <div style="min-width:0"><strong>${escaparHtml(d.nome)}</strong><span class="sub-txt">${d.tamanho ? formatarBytes(d.tamanho) : ""}</span></div>
          </div>
        </td>
        <td class="mono">${formatarDataHora(d.data)}</td>
        <td class="num-cel">${d.paginas}</td>
        <td><span class="tag tag-ok">${plural(d.assinaturas, "assinatura", "assinaturas")}</span>
          ${d.paginasAssinadas ? `<span class="sub-txt">em ${plural(d.paginasAssinadas, "página", "páginas")}</span>` : ""}</td>
        <td>${d.signatario ? escaparHtml(d.signatario) : `<span style="color:var(--text-mute)">—</span>`}</td>
      </tr>`).join("");
  }

  async function limpar() {
    const ok = await UI.confirmar({
      titulo: "Limpar histórico?",
      texto: "O registro de todos os documentos assinados neste navegador será apagado. Os PDFs que você baixou não são afetados.",
      botao: "Limpar histórico",
      tom: "perigo",
    });
    if (!ok) return;
    Store.gravar("historico", []);
    renderizar();
    UI.aviso("Histórico limpo.");
  }

  function iniciar() {
    $("#btn-limpar-historico").addEventListener("click", limpar);
    Router.registrar("historico", renderizar);
    renderizar();
  }

  return { iniciar, registrar };
})();
