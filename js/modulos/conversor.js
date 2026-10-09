/* =====================================================================
   CONVERSOR — transforma qualquer arquivo aceito em bytes de PDF.
   PDF passa direto; Word e imagem viram páginas de imagem;
   TXT é diagramado em A4 com texto selecionável.
   ===================================================================== */

const Conversor = (() => {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const A4 = { w: 595.28, h: 841.89 };

  function tipoDoArquivo(arquivo) {
    const nome = arquivo.name.toLowerCase();
    const tipo = arquivo.type;
    if (tipo === "application/pdf" || nome.endsWith(".pdf")) return "pdf";
    if (nome.endsWith(".docx") || tipo === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
    if (nome.endsWith(".txt") || tipo === "text/plain") return "txt";
    if (nome.endsWith(".doc")) return "doc";
    if (tipo.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(nome)) return "imagem";
    return null;
  }

  async function paraPdf(arquivo) {
    switch (tipoDoArquivo(arquivo)) {
      case "pdf": return new Uint8Array(await arquivo.arrayBuffer());
      case "docx": return await docxParaPdf(arquivo);
      case "txt": return await txtParaPdf(arquivo);
      case "imagem": return await imagemParaPdf(arquivo);
      case "doc": throw new Error("Arquivos .doc (Word antigo) não são suportados. Salve como .docx ou PDF e tente novamente.");
      default: throw new Error("Formato não suportado. Use PDF, Word (.docx), TXT ou uma imagem (JPG/PNG).");
    }
  }

  async function imagemParaPdf(arquivo) {
    const dataUrl = await lerComoDataUrl(arquivo);
    const im = await carregarImagem(dataUrl);
    const maxDim = 1700;
    const escala = Math.min(1, maxDim / Math.max(im.width, im.height));
    const w = Math.round(im.width * escala);
    const h = Math.round(im.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(im, 0, 0, w, h);

    const doc = await PDFDocument.create();
    const jpg = await doc.embedJpg(dataUrlParaBytes(canvas.toDataURL("image/jpeg", 0.92)));
    const pagina = doc.addPage([w, h]);
    pagina.drawImage(jpg, { x: 0, y: 0, width: w, height: h });
    return await doc.save();
  }

  async function docxParaPdf(arquivo) {
    if (typeof mammoth === "undefined" || typeof html2canvas === "undefined") {
      throw new Error("Não foi possível carregar o conversor de Word. Verifique sua conexão e tente novamente.");
    }
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await arquivo.arrayBuffer() });

    const larguraPx = 794; // ~A4 a 96 dpi
    const caixa = document.createElement("div");
    caixa.style.cssText = `position:fixed; left:-9999px; top:0; width:${larguraPx}px; padding:60px 54px; background:#fff; color:#1a1a1a; font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:1.6;`;
    caixa.innerHTML = html;
    document.body.appendChild(caixa);
    await new Promise((r) => setTimeout(r, 80));

    let completo;
    try {
      completo = await html2canvas(caixa, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    } finally {
      caixa.remove();
    }

    const doc = await PDFDocument.create();
    const alturaFatia = Math.round(completo.width * (A4.h / A4.w));
    for (let y = 0; y < completo.height; y += alturaFatia) {
      const h = Math.min(alturaFatia, completo.height - y);
      const fatia = document.createElement("canvas");
      fatia.width = completo.width;
      fatia.height = h;
      fatia.getContext("2d").drawImage(completo, 0, y, completo.width, h, 0, 0, completo.width, h);
      const jpg = await doc.embedJpg(dataUrlParaBytes(fatia.toDataURL("image/jpeg", 0.9)));
      const alturaPagina = A4.w * (h / completo.width);
      const pagina = doc.addPage([A4.w, alturaPagina]);
      pagina.drawImage(jpg, { x: 0, y: 0, width: A4.w, height: alturaPagina });
    }
    return await doc.save();
  }

  async function txtParaPdf(arquivo) {
    const texto = await arquivo.text();
    const doc = await PDFDocument.create();
    const fonte = await doc.embedFont(StandardFonts.Helvetica);
    const tamanho = 11;
    const margem = 54;
    const larguraMax = A4.w - margem * 2;
    const entrelinha = tamanho * 1.45;

    // a fonte padrão do PDF só conhece o alfabeto latino (WinAnsi)
    const seguro = (s) => s.replace(/\t/g, "    ").replace(/[^\x20-\x7E\xA0-\xFF‘’“”–—…•€]/g, "?");
    const linhas = [];
    texto.split(/\r?\n/).forEach((paragrafo) => {
      paragrafo = seguro(paragrafo);
      if (paragrafo.trim() === "") { linhas.push(""); return; }
      let atual = "";
      paragrafo.split(" ").forEach((palavra) => {
        const teste = atual ? atual + " " + palavra : palavra;
        if (fonte.widthOfTextAtSize(teste, tamanho) > larguraMax && atual) {
          linhas.push(atual);
          atual = palavra;
        } else {
          atual = teste;
        }
      });
      linhas.push(atual);
    });

    let pagina = doc.addPage([A4.w, A4.h]);
    let y = A4.h - margem;
    for (const linha of linhas) {
      if (y < margem) {
        pagina = doc.addPage([A4.w, A4.h]);
        y = A4.h - margem;
      }
      pagina.drawText(linha, { x: margem, y, size: tamanho, font: fonte, color: rgb(0.07, 0.1, 0.16) });
      y -= entrelinha;
    }
    return await doc.save();
  }

  return { paraPdf, tipoDoArquivo };
})();
