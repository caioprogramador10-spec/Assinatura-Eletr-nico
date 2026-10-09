# Assinador · Conexão Rastreadores

Assinatura eletrônica de documentos direto no navegador — importe, assine e baixe, sem impressora e sem scanner.
Visual e arquitetura no mesmo padrão do **Sistema RH Premium v3**.

## Como rodar

É um site estático, sem build. Qualquer servidor serve:

```bash
python -m http.server 5520
```

Depois abra `http://localhost:5520`. Também pode ser publicado no GitHub Pages, Netlify, Vercel etc.

> Precisa de internet para baixar as fontes e as bibliotecas de PDF (pdf.js, pdf-lib, mammoth, html2canvas) do CDN.
> O documento em si **nunca** sai do computador.

## Estrutura

```
assinatura-premium/
├── index.html                 # estrutura das páginas + sprite de ícones SVG
├── assets/
│   ├── css/
│   │   ├── base.css           # tokens do design system (tema claro/escuro) — o mesmo do RH
│   │   ├── layout.css         # menu lateral, barra do celular, cabeçalho de página
│   │   ├── components.css     # botões, painéis, indicadores, formulários, tabelas, modal, toast
│   │   └── assinador.css      # etapas, visualizador, caixas de assinatura, criador, biblioteca
│   └── img/
│       ├── logo.png           # ícone redondo (menu do celular, atalho no iPhone)
│       ├── logo-completa.png  # logo com o nome (texto branco: usar sempre sobre fundo escuro)
│       └── favicon.png        # ícone da aba do navegador
└── js/
    ├── core/
    │   ├── utils.js           # $, formatação, leitura de arquivo, recorte de imagem
    │   ├── ui.js              # toast, modal de confirmação, tema, menu do celular
    │   ├── store.js           # localStorage protegido contra falhas
    │   └── router.js          # navegação por #hash
    ├── modulos/
    │   ├── conversor.js       # PDF / Word / TXT / imagem → PDF
    │   ├── documento.js       # visualizador, miniaturas, zoom, arrastar/redimensionar
    │   ├── criador.js         # desenhar / digitar / enviar imagem
    │   ├── exportar.js        # grava as assinaturas no PDF e baixa
    │   ├── biblioteca.js      # Minhas assinaturas
    │   └── historico.js       # registro dos documentos assinados
    └── app.js                 # ponto de partida
```

## Páginas

| Página | O que faz |
|---|---|
| **Assinar documento** | Fluxo em 4 etapas: importar → assinar → posicionar → baixar |
| **Histórico** | Indicadores + tabela dos documentos assinados (só metadados, nunca o arquivo) |
| **Minhas assinaturas** | Biblioteca de assinaturas salvas para reutilizar em um clique |
| **Validade jurídica** | Quando usar o Gov.br/ICP-Brasil, formatos aceitos e atalhos |

## O que mudou em relação à versão anterior

- Um arquivo de 148 KB virou um projeto organizado em módulos (mesmo padrão do RH).
- Tema claro e escuro com o design system do RH; segue o sistema operacional até o usuário escolher.
- Menu lateral, cabeçalho de página, indicadores, toasts e modais no lugar de `alert()`.
- Miniaturas das páginas (com marca nas que já têm assinatura), zoom e renderização nítida em telas retina.
- Assinatura desenhada com traço suavizado, cor da tinta, espessura e **desfazer**.
- 4 estilos de assinatura digitada (fontes carregadas antes de desenhar, para não sair na fonte errada).
- Imagem de assinatura com **remoção automática do fundo branco**.
- Assinaturas recortadas rente à tinta e redimensionadas **sem distorcer**.
- Carimbo com nome do signatário + data/hora, com prévia fiel na tela.
- **Correção:** páginas giradas (/Rotate) e com CropBox agora recebem a assinatura no lugar certo.
- **Correção:** TXT com caracteres fora do alfabeto latino não quebra mais a conversão.
- Arquivo baixado mantém o nome original (`contrato-assinado.pdf`).
- Atalhos: `←` `→` páginas, `Delete` remove, `Ctrl+D` repete em todas as páginas, `Esc` tira a seleção.

## Aviso legal

A ferramenta gera uma **assinatura eletrônica visual** (imagem sobreposta ao PDF), útil para processos internos.
Ela não é uma assinatura digital certificada ICP-Brasil. Para validade jurídica reforçada, use o
[assinador Gov.br](https://assinador.iti.br/).
