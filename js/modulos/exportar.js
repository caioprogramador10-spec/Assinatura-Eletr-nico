/* =====================================================================
   EXPORTAR — grava as assinaturas no PDF e faz o download.
   Respeita páginas giradas (/Rotate) e a área visível (CropBox),
   para a assinatura sair exatamente onde foi posicionada na tela.
   ===================================================================== */

const Exportar = (() => {
  const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;
  const CARIMBO_PT = 7;

  /* Converte um ponto da página como ela aparece na tela (origem no
     canto superior esquerdo, já girada) para o espaço do PDF. */
  function mapeador(pagina) {
    const cb = pagina.getCropBox();
    const giro = ((pagina.getRotation().angle % 360) + 360) % 360;
    const deitada = giro === 90 || giro === 270;
    const largura = deitada ? cb.height : cb.width;   // largura vista na tela
    const altura = deitada ? cb.width : cb.height;
    const pw = cb.width, ph = cb.height;

    function ponto(dx, dy) {
      let X, Y;
      if (giro === 90) { X = dy; Y = dx; }
      else if (giro === 180) { X = pw - dx; Y = dy; }
      else if (giro === 270) { X = pw - dy; Y = ph - dx; }
      else { X = dx; Y = ph - dy; }
      return { x: X + cb.x, y: Y + cb.y };
    }

    return { largura, altura, giro, ponto };
  }

  /* A fonte padrão do PDF só conhece o alfabeto latino */
  function textoSeguro(texto) {
    return texto.replace(/[^\x20-\x7E\xA0-\xFF‘’“”–—…•€]/g, "?");
  }

  function nomeDeSaida(nome) {
    const base = (nome || "documento").replace(/\.[^.]+$/, "");
    return base + "-assinado.pdf";
  }

  async function gerar() {
    const est = Documento.estado;
    if (!est.bytes || !est.colocacoes.length) return;

    const botao = $("#btn-baixar");
    const htmlOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0;border-width:2px"></span>Gerando PDF…`;

    try {
      const doc = await PDFDocument.load(est.bytes, { ignoreEncryption: true, updateMetadata: false });
      const paginas = doc.getPages();
      const fonte = await doc.embedFont(StandardFonts.Helvetica);
      const agora = new Date();
      const linhas = Documento.linhasCarimbo(agora).map(textoSeguro);
      const cache = new Map(); // a mesma imagem é embutida uma vez só

      for (const c of est.colocacoes) {
        const pagina = paginas[c.pagina - 1];
        const m = mapeador(pagina);

        if (!cache.has(c.dataUrl)) cache.set(c.dataUrl, await doc.embedPng(dataUrlParaBytes(c.dataUrl)));
        const png = cache.get(c.dataUrl);

        const dx = c.x * m.largura;
        const dy = c.y * m.altura;
        const w = c.w * m.largura;
        const h = c.h * m.altura;
        const ancora = m.ponto(dx, dy + h); // canto inferior esquerdo da assinatura
        pagina.drawImage(png, { x: ancora.x, y: ancora.y, width: w, height: h, rotate: degrees(m.giro) });

        linhas.forEach((linha, i) => {
          const base = m.ponto(dx, dy + h + CARIMBO_PT * (1.15 + i * 1.22));
          pagina.drawText(linha, {
            x: base.x, y: base.y, size: CARIMBO_PT, font: fonte,
            color: rgb(0.38, 0.42, 0.48), rotate: degrees(m.giro),
          });
        });
      }

      const saida = await doc.save();
      const blob = new Blob([saida], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDeSaida(est.nome);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      Historico.registrar({
        nome: est.nome,
        data: agora.toISOString(),
        paginas: est.total,
        assinaturas: est.colocacoes.length,
        paginasAssinadas: new Set(est.colocacoes.map((c) => c.pagina)).size,
        signatario: $("#carimbo-nome").value.trim(),
        tamanho: saida.length,
      });

      $("#faixa-ok-texto").textContent = `"${a.download}" baixado com ${plural(est.colocacoes.length, "assinatura", "assinaturas")}.`;
      $("#faixa-ok").classList.add("show");
      Documento.etapa(4, true);
      UI.aviso("PDF assinado gerado com sucesso.", "sucesso");
    } catch (erro) {
      console.error(erro);
      UI.aviso("Não foi possível gerar o PDF assinado. " + (erro && erro.message ? erro.message : ""), "erro", 6000);
    } finally {
      botao.disabled = false;
      botao.innerHTML = htmlOriginal;
    }
  }

  function iniciar() {
    $("#btn-baixar").addEventListener("click", gerar);
  }

  return { iniciar };
})();
