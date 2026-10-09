/* =====================================================================
   STORE — armazenamento local (localStorage) com proteção a falhas.
   Guarda só assinaturas salvas e o registro do histórico —
   nunca o documento em si.
   ===================================================================== */

const Store = (() => {
  const CHAVES = {
    salvas: "assin_salvas",
    historico: "assin_historico",
    preferencias: "assin_preferencias",
  };

  function ler(chave, padrao) {
    try {
      const bruto = localStorage.getItem(CHAVES[chave]);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (e) {
      return padrao;
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(CHAVES[chave], JSON.stringify(valor));
      return true;
    } catch (e) {
      UI.aviso("Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado).", "erro");
      return false;
    }
  }

  return { ler, gravar };
})();
