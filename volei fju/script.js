/* ===== gerador de .xlsx (OOXML) escrito do zero, sem biblioteca externa ===== */

var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  var c = 0xffffffff;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function utf8Encode(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  return Uint8Array.from(Buffer.from(str, "utf8"));
}

/* --- zip (armazenado, sem compressão) --- */
function buildZip(files) {
  var parts = [], central = [], offset = 0, total = 0;
  var d = new Date();
  var time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  var date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

  files.forEach(function (f) {
    var nameBytes = utf8Encode(f.name), data = utf8Encode(f.content), crc = crc32(data);

    var local = new Uint8Array(30 + nameBytes.length);
    var dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true); dv.setUint16(10, time, true); dv.setUint16(12, date, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    var cd = new Uint8Array(46 + nameBytes.length);
    var cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, time, true);
    cv.setUint16(14, date, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    parts.push(local, data); central.push(cd);
    offset += local.length + data.length; total += local.length + data.length;
  });

  var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
  var end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, total, true);

  var out = new Uint8Array(total + cdSize + 22), pos = 0;
  parts.forEach(function (b) { out.set(b, pos); pos += b.length; });
  central.forEach(function (b) { out.set(b, pos); pos += b.length; });
  out.set(end, pos);
  return out;
}

/* --- XML --- */
function xesc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function cel(ref, style, value) {
  if (value === null || value === undefined || value === "") return '<c r="' + ref + '" s="' + style + '"/>';
  if (typeof value === "number") return '<c r="' + ref + '" s="' + style + '"><v>' + value + "</v></c>";
  if (value.f) return '<c r="' + ref + '" s="' + style + '"><f>' + xesc(value.f) + "</f></c>";
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(value) + "</t></is></c>";
}
function colL(n) {
  var s = "";
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* --- estilos: os índices saem daqui, nada é contado na mão --- */
var ST = {};
function stylesXml() {
  var fillCores = ["B7B7B7", "CFE2F3", "38761D", "CC0000", "FF9900", "FFFFFF", "F3F3F3"];
  var F = { cinza: 2, azul: 3, verde: 4, vermelho: 5, laranja: 6, branco: 7, claro: 8 };

  var s = HEAD + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  s += '<fonts count="11">' +
    '<font><sz val="10"/><name val="Arial"/></font>' +                                // 0
    '<font><b/><sz val="10"/><name val="Arial"/></font>' +                            // 1
    '<font><b/><sz val="12"/><name val="Arial"/></font>' +                            // 2
    '<font><b/><sz val="13"/><name val="Arial"/></font>' +                            // 3
    '<font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +     // 4
    '<font><b/><sz val="8"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +      // 5
    '<font><b/><sz val="14"/><name val="Arial"/></font>' +                            // 6
    '<font><sz val="11"/><name val="Arial"/></font>' +                                // 7
    '<font><b/><sz val="12"/><name val="Arial"/></font>' +                            // 8
    '<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Arial"/></font>' +     // 9
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +     // 10
    "</fonts>";

  s += '<fills count="' + (fillCores.length + 2) + '"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>';
  fillCores.forEach(function (c) {
    s += '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor rgb="FF' + c + '"/></patternFill></fill>';
  });
  s += "</fills>";

  function bd(l, r, t, b) {
    function e(tag, st) { return st ? "<" + tag + ' style="' + st + '"><color rgb="FF000000"/></' + tag + ">" : "<" + tag + "/>"; }
    return "<border>" + e("left", l) + e("right", r) + e("top", t) + e("bottom", b) + "<diagonal/></border>";
  }
  s += '<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    bd("medium", "medium", "medium", "medium") + bd("thin", "thin", "thin", "thin") +
    bd("medium", "medium", "", "medium") + "</borders>";
  var B = { nenhuma: 0, media: 1, fina: 2, semTopo: 3 };

  s += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';

  var xfs = [];
  function xf(nome, font, fill, border, hor, wrap) {
    ST[nome] = xfs.length;
    xfs.push('<xf xfId="0" numFmtId="0" fontId="' + font + '" fillId="' + fill + '" borderId="' + border +
      '" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="' +
      (hor || "center") + '" vertical="center"' + (wrap ? ' wrapText="1"' : "") + "/></xf>");
  }
  xf("base", 0, 0, B.nenhuma, "left");
  xf("titulo", 4, F.verde, B.media);
  xf("secao", 2, F.cinza, B.media);
  xf("infoTexto", 7, F.branco, B.fina, "left");
  xf("cabecalho", 2, F.azul, B.media, "center", 1);
  xf("posicao", 1, F.branco, B.fina, "left");
  xf("nome", 7, F.branco, B.fina, "left");
  xf("nomeB", 1, F.branco, B.fina, "left");
  xf("thCinza", 1, F.cinza, B.fina, "center", 1);
  xf("valor", 8, F.branco, B.fina);
  xf("nomeLinha", 9, F.branco, B.nenhuma, "left");
  xf("totalRot", 2, F.claro, B.media, "left");
  xf("totalVal", 6, F.claro, B.media);
  xf("tdTexto", 7, F.branco, B.fina, "left");
  xf("tdSub", 1, F.claro, B.fina, "left");
  xf("tdNum", 1, F.branco, B.fina);

  var cats = ["pos", "neutro", "neg"];
  var catFill = { pos: F.verde, neutro: F.laranja, neg: F.vermelho };
  ST.th = {}; ST.td = {};
  cats.forEach(function (c) {
    xf("th_" + c, 5, catFill[c], B.media, "center", 1);
    ST.th[c] = ST["th_" + c];
    xf("td_" + c, 10, catFill[c], B.fina);
    ST.td[c] = ST["td_" + c];
  });

  s += '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>";
  s += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  return s;
}

function folha(corpo, cols, merges, paisagem, painel) {
  return HEAD + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0">' +
    (painel ? '<pane ySplit="' + painel + '" topLeftCell="A' + (painel + 1) + '" activePane="bottomLeft" state="frozen"/>' : "") +
    "</sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"15\"/><cols>" + cols + "</cols>" +
    "<sheetData>" + corpo + "</sheetData>" +
    (merges.length ? '<mergeCells count="' + merges.length + '">' +
      merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join("") + "</mergeCells>" : "") +
    '<pageMargins left="0.35" right="0.35" top="0.45" bottom="0.45" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="' + (paisagem ? "landscape" : "portrait") +
    '" fitToWidth="1" fitToHeight="0"/></worksheet>';
}

/* --- aba ESCALAÇÃO --- */
function sheetEscalacao(campo, reservas, info) {
  var rows = [], merges = ["B2:C2"], r = 2;
  rows.push('<row r="2" ht="30" customHeight="1">' + cel("B2", ST.titulo, "ESCALAÇÃO") +
    cel("C2", ST.titulo, null) + "</row>");

  info = info || {};
  r = 3;
  ["Jogo: " + (info.nome || "-"), "Data: " + (info.dataFmt || "-"), "Local: " + (info.local || "-")]
    .forEach(function (txt) {
      merges.push("B" + r + ":C" + r);
      rows.push('<row r="' + r + '" ht="20" customHeight="1">' +
        cel("B" + r, ST.infoTexto, txt) + cel("C" + r, ST.base, null) + "</row>");
      r++;
    });

  r++;
  rows.push('<row r="' + r + '" ht="26" customHeight="1">' + cel("B" + r, ST.cabecalho, "Posição") +
    cel("C" + r, ST.cabecalho, "Jogador") + "</row>");
  campo.forEach(function (p) {
    r++;
    rows.push('<row r="' + r + '" ht="22" customHeight="1">' +
      cel("B" + r, ST.posicao, p.posicao) + cel("C" + r, ST.nome, p.nome || null) + "</row>");
  });

  if (reservas.length) {
    r += 2;
    merges.push("B" + r + ":C" + r);
    rows.push('<row r="' + r + '" ht="24" customHeight="1">' +
      cel("B" + r, ST.secao, "RESERVAS") + cel("C" + r, ST.secao, null) + "</row>");
    reservas.forEach(function (p, i) {
      r++;
      rows.push('<row r="' + r + '" ht="22" customHeight="1">' +
        cel("B" + r, ST.posicao, "Reserva " + (i + 1)) + cel("C" + r, ST.nome, p.nome) + "</row>");
    });
  }

  var cols = '<col min="1" max="1" width="3.13" customWidth="1"/>' +
    '<col min="2" max="2" width="23.38" customWidth="1"/>' +
    '<col min="3" max="3" width="38.75" customWidth="1"/>';
  return folha(rows.join(""), cols, merges, false, 0);
}

/* --- aba REGISTRO DE AÇÕES --- */
function sheetRegistro(blocos, acoes) {
  var rows = [], merges = [];
  var ultima = colL(3 + acoes.length);

  var r2 = '<row r="2" ht="30" customHeight="1">' + cel("B2", ST.titulo, "REGISTRO DE AÇÕES");
  for (var c = 3; c <= 3 + acoes.length; c++) r2 += cel(colL(c) + "2", ST.titulo, null);
  rows.push(r2 + "</row>");
  merges.push("B2:" + ultima + "2");

  var h = '<row r="4" ht="42" customHeight="1">' + cel("B4", ST.thCinza, "JOGADOR") +
    cel("C4", ST.thCinza, "POSIÇÃO");
  acoes.forEach(function (a, i) { h += cel(colL(4 + i) + "4", ST.th[a.cat], a.rot); });
  rows.push(h + "</row>");

  var linhas = [];
  blocos.forEach(function (b, n) {
    var r = 5 + n;
    linhas.push(r);
    var l = '<row r="' + r + '" ht="22" customHeight="1">' + cel("B" + r, ST.nomeB, b.nome || null) +
      cel("C" + r, ST.nome, b.posicao);
    acoes.forEach(function (a, i) { l += cel(colL(4 + i) + r, ST.valor, b.valores[i] || 0); });
    rows.push(l + "</row>");
  });

  var tr = 5 + blocos.length + 1;
  var lt = '<row r="' + tr + '" ht="26" customHeight="1">' + cel("B" + tr, ST.totalRot, "TOTAL DA EQUIPE") +
    cel("C" + tr, ST.totalRot, null);
  acoes.forEach(function (a, i) {
    var col = colL(4 + i);
    lt += cel(col + tr, ST.totalVal, linhas.length
      ? { f: "SUM(" + linhas.map(function (x) { return col + x; }).join(",") + ")" } : 0);
  });
  rows.push(lt + "</row>");
  merges.push("B" + tr + ":C" + tr);

  var cols = '<col min="1" max="1" width="2.88" customWidth="1"/>' +
    '<col min="2" max="2" width="20" customWidth="1"/>' +
    '<col min="3" max="3" width="15" customWidth="1"/>' +
    '<col min="4" max="' + (3 + acoes.length) + '" width="8.5" customWidth="1"/>';

  return folha(rows.join(""), cols, merges, true, 4);
}

/* --- aba LINHA DO TEMPO --- */
function sheetLinha(eventos) {
  var rows = [], merges = ["B2:E2"];
  rows.push('<row r="2" ht="30" customHeight="1">' +
    ["B", "C", "D", "E"].map(function (c) {
      return cel(c + "2", ST.titulo, c === "B" ? "LINHA DO TEMPO" : null);
    }).join("") + "</row>");
  rows.push('<row r="4" ht="24" customHeight="1">' +
    cel("B4", ST.thCinza, "#") + cel("C4", ST.thCinza, "JOGADOR") + cel("D4", ST.thCinza, "POSIÇÃO") +
    cel("E4", ST.thCinza, "AÇÃO") + "</row>");

  eventos.forEach(function (e, i) {
    var r = 5 + i;
    rows.push('<row r="' + r + '" ht="20" customHeight="1">' +
      cel("B" + r, ST.tdNum, e.n) + cel("C" + r, ST.tdTexto, e.nome || null) +
      cel("D" + r, ST.tdTexto, e.posicao) +
      cel("E" + r, e.cat ? ST.td[e.cat] : ST.tdSub, e.rotulo) + "</row>");
  });

  if (!eventos.length) {
    rows.push('<row r="5" ht="20" customHeight="1">' + cel("B5", ST.nomeLinha, "nenhuma ação registrada") + "</row>");
  }

  var cols = '<col min="1" max="1" width="3" customWidth="1"/>' +
    '<col min="2" max="2" width="7" customWidth="1"/>' +
    '<col min="3" max="3" width="26" customWidth="1"/>' +
    '<col min="4" max="4" width="18" customWidth="1"/>' +
    '<col min="5" max="5" width="26" customWidth="1"/>';
  return folha(rows.join(""), cols, merges, false, 4);
}

/* --- monta o arquivo --- */
function buildWorkbook(opts) {
  var estilos = stylesXml(); // preenche ST antes das abas
  var abas = [
    { nome: "ESCALAÇÃO", xml: sheetEscalacao(opts.campo, opts.reservas, opts.info) },
    { nome: "REGISTRO DE AÇÕES", xml: sheetRegistro(opts.blocos, opts.acoes) },
    { nome: "LINHA DO TEMPO", xml: sheetLinha(opts.eventos) }
  ];

  var files = [
    {
      name: "[Content_Types].xml",
      content: HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        abas.map(function (_, i) {
          return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join("") +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
    },
    {
      name: "_rels/.rels",
      content: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    {
      name: "xl/workbook.xml",
      content: HEAD + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        abas.map(function (a, i) {
          return '<sheet name="' + xesc(a.nome) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
        }).join("") +
        '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        abas.map(function (_, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join("") +
        '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    },
    { name: "xl/styles.xml", content: estilos }
  ];
  abas.forEach(function (a, i) { files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", content: a.xml }); });
  return buildZip(files);
}

/* ==================================================================== */
/* ============================ APP PRINCIPAL ========================= */
/* ==================================================================== */
(function () {
/* ================= dados ================= */
/* posições definidas para cada escalação da partida */
var POSICOES = [
  ["Levantador", "LEV"],
  ["Atacante esquerda", "ATA ESQ"],
  ["Atacante direita", "ATA DIR"],
  ["Fundo", "FUNDO"]
];
var PARAMETROS = [
  { k: "saque", nome: "Saque" },
  { k: "passe", nome: "Passe" },
  { k: "ataque", nome: "Ataque" },
  { k: "defesa", nome: "Defesa" },
  { k: "levantamento", nome: "Levantamento" }
];
var RESPOSTAS = [
  { k: "pos", simbolo: "✓", nome: "Positiva", cat: "pos" },
  { k: "neutro", simbolo: "●", nome: "Neutra", cat: "neutro" },
  { k: "neg", simbolo: "−", nome: "Negativa", cat: "neg" }
];
var ACOES = [];
PARAMETROS.forEach(function (parametro) {
  RESPOSTAS.forEach(function (resposta) {
    ACOES.push({
      k: parametro.k + "_" + resposta.k,
      g: parametro.k,
      lbl: parametro.nome + " · " + resposta.nome,
      cat: resposta.cat,
      rot: (parametro.nome + " " + resposta.nome).toUpperCase()
    });
  });
});
var COR = { pos: "var(--pos)", neg: "var(--neg)", neutro: "var(--neutro)" };

function acao(k) {
  for (var i = 0; i < ACOES.length; i++) if (ACOES[i].k === k) return ACOES[i];
  return null;
}

/* ================= estado ================= */
var KEY = "controle-tecnico-volei-v1";

function novoEstado() {
  var st = { players: [], field: [], bench: [], counts: {}, pos: {}, log: [], jogoInfo: { data: "" } };
  for (var i = 0; i < POSICOES.length; i++) st.field.push(null);
  return st;
}
function carregar() {
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (!s || !s.players || !s.field || s.field.length !== POSICOES.length) return null;
    return s;
  } catch (e) { return null; }
}
var state = carregar() || novoEstado();
state.jogoInfo = { data: state.jogoInfo && state.jogoInfo.data ? state.jogoInfo.data : "" };
delete state.seq;
delete state.todosLevantam;
state.log = (state.log || []).filter(function (item) {
  return item.tipo !== "acao" || !!acao(item.act);
});

var jogadoresCarregando = true;
var erroJogadores = "";

function aplicarJogadoresServidor(lista) {
  var recebidos = {}, anteriores = {};
  state.players.forEach(function (p) {
    if (p.server) anteriores[p.id] = true;
    p.server = false;
  });
  lista.forEach(function (item) {
    recebidos[item.id] = true;
    var p = jog(item.id);
    if (!p) {
      p = { id: item.id };
      state.players.push(p);
    }
    p.name = item.nome;
    delete p.position;
    p.photo = item.foto || "";
    p.server = true;
    if (state.field.indexOf(p.id) < 0 && state.bench.indexOf(p.id) < 0) state.bench.push(p.id);
  });

  state.field = state.field.map(function (id) {
    var p = id ? jog(id) : null;
    return p && p.server ? id : null;
  });
  state.bench = state.bench.filter(function (id) {
    var p = jog(id);
    return p && p.server && state.field.indexOf(id) < 0;
  });

  state.players.slice().forEach(function (p) {
    if (!anteriores[p.id] || recebidos[p.id] || totalDe(p.id) > 0) return;
    state.players = state.players.filter(function (x) { return x.id !== p.id; });
    state.bench = state.bench.filter(function (id) { return id !== p.id; });
  });
  salvar();
  montarEscalacao();
  montarRegistro();
}

function carregarJogadoresServidor() {
  jogadoresCarregando = true;
  erroJogadores = "";
  return fetch("/api/jogadores")
    .then(function (res) {
      if (!res.ok) throw new Error("Não foi possível carregar o elenco.");
      return res.json();
    })
    .then(function (lista) { aplicarJogadoresServidor(lista); })
    .catch(function (erro) { erroJogadores = erro.message; })
    .then(function () {
      jogadoresCarregando = false;
      if (!viewJogadores.hidden) montarJogadores();
    });
}

function salvar() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

function infoCompleta() {
  var j = state.jogoInfo || {};
  return !!j.data;
}
function formatarData(iso) {
  if (!iso) return "";
  var partes = iso.split("-");
  if (partes.length !== 3) return iso;
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

/* ================= atalhos de dados ================= */
function jog(id) {
  for (var i = 0; i < state.players.length; i++) if (state.players[i].id === id) return state.players[i];
  return null;
}
function cnt(id) {
  if (!state.counts[id]) {
    var o = {};
    ACOES.forEach(function (a) { o[a.k] = 0; });
    state.counts[id] = o;
  }
  return state.counts[id];
}
function totalDe(id) {
  var c = state.counts[id], t = 0;
  if (c) ACOES.forEach(function (a) { t += c[a.k] || 0; });
  return t;
}
function nomeDe(id) { var p = jog(id); return p ? (p.name || "sem nome") : "?"; }
function inicial(id) {
  var n = (jog(id) || {}).name || "";
  return n.trim() ? n.trim().charAt(0) : "–";
}
function fotoDe(id) { var p = jog(id); return p ? (p.photo || "") : ""; }
function ordenarPorNome(ids) {
  return ids.slice().sort(function (a, b) { return nomeDe(a).localeCompare(nomeDe(b)); });
}
function posDe(id) {
  var i = state.field.indexOf(id);
  if (i >= 0) return POSICOES[i][0];
  return state.pos[id] != null ? POSICOES[state.pos[id]][0] : "Reserva";
}
/* ================= tela: jogo (dados da partida) ================= */
var viewJogo = document.getElementById("viewJogo");
var mesCalendario = null;

function dataLocal(iso) {
  var p = (iso || "").split("-");
  if (p.length !== 3) return new Date();
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function dataIso(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function montarGradeCalendario() {
  var cursor = mesCalendario || dataLocal(state.jogoInfo.data);
  var ano = cursor.getFullYear(), mes = cursor.getMonth();
  var primeiro = new Date(ano, mes, 1);
  var ultimoDia = new Date(ano, mes + 1, 0).getDate();
  var selecionada = state.jogoInfo.data || "";
  var hoje = dataIso(new Date());
  var titulo = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  var html = '<div class="calendar-head">' +
    '<button type="button" data-cal-nav="-1" aria-label="Mês anterior">‹</button>' +
    '<b>' + esc(titulo.charAt(0).toUpperCase() + titulo.slice(1)) + '</b>' +
    '<button type="button" data-cal-nav="1" aria-label="Próximo mês">›</button></div>' +
    '<div class="calendar-week" aria-hidden="true"><span>Dom</span><span>Seg</span><span>Ter</span>' +
    '<span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>' +
    '<div class="calendar-days">';
  for (var vazio = 0; vazio < primeiro.getDay(); vazio++) html += '<span class="calendar-empty"></span>';
  for (var dia = 1; dia <= ultimoDia; dia++) {
    var iso = dataIso(new Date(ano, mes, dia));
    var classes = (iso === selecionada ? " selected" : "") + (iso === hoje ? " today" : "");
    html += '<button type="button" class="calendar-day' + classes + '" data-cal-day="' + iso +
      '" aria-label="' + esc(formatarData(iso)) + '"' + (iso === selecionada ? ' aria-pressed="true"' : '') + '>' + dia + '</button>';
  }
  html += '</div><button type="button" class="calendar-today" data-cal-today>Selecionar hoje</button>';
  return html;
}

function montarJogoInfo() {
  var j = state.jogoInfo;
  var html = '<div class="jogoForm merged-game">' +
    '<span class="jfLabel" id="jfDataLabel">Data do jogo<span class="req">*</span></span>' +
    '<button type="button" class="date-select' + (j.data ? " has-date" : "") + '" id="datePickerButton" ' +
      'aria-labelledby="jfDataLabel datePickerText" aria-expanded="false">' +
      '<span class="date-icon" aria-hidden="true">▦</span>' +
      '<span id="datePickerText">' + (j.data ? esc(formatarData(j.data)) : "Selecionar uma data") + '</span>' +
      '<span class="date-chevron" aria-hidden="true">⌄</span></button>' +
    '<div class="calendar-panel" id="calendarPanel" hidden></div>' +
    "</div>";

  viewJogo.innerHTML = html;
}

viewJogo.addEventListener("click", function (ev) {
  var abrirCalendario = ev.target.closest("#datePickerButton");
  var painel = document.getElementById("calendarPanel");
  if (abrirCalendario) {
    var vaiAbrir = painel.hidden;
    if (vaiAbrir) {
      var base = dataLocal(state.jogoInfo.data);
      mesCalendario = new Date(base.getFullYear(), base.getMonth(), 1);
      painel.innerHTML = montarGradeCalendario();
    }
    painel.hidden = !vaiAbrir;
    abrirCalendario.setAttribute("aria-expanded", vaiAbrir ? "true" : "false");
    return;
  }
  var nav = ev.target.closest("[data-cal-nav]");
  if (nav) {
    mesCalendario = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + Number(nav.dataset.calNav), 1);
    painel.innerHTML = montarGradeCalendario();
    return;
  }
  var dia = ev.target.closest("[data-cal-day]");
  var hoje = ev.target.closest("[data-cal-today]");
  if (!dia && !hoje) return;
  state.jogoInfo.data = dia ? dia.dataset.calDay : dataIso(new Date());
  salvar();
  montarJogoInfo();
  var botao = document.getElementById("datePickerButton");
  if (botao) botao.focus();
});

/* ================= tela: registro de ações ================= */
var viewRegistro = document.getElementById("viewRegistro");
var jogadorAtivoId = null;

function montarRegistro() {
  var idsAll = state.field.filter(function (id) { return id; }), html = "";
  if (!idsAll.length) {
    html = '<p class="vazioMsg">Ninguém em quadra. Monte o time na aba Jogo.</p>';
  } else {
    if (idsAll.indexOf(jogadorAtivoId) < 0) jogadorAtivoId = idsAll[0];
    html += '<section class="team-action"><div class="team-action-head"><b>Time</b>' +
      '<span>Selecione quem realizou a ação</span></div><div class="team-player-line">';
    idsAll.forEach(function (id) {
      var p = jog(id), foto = fotoDe(id);
      var avatar = foto ? '<img src="' + esc(foto) + '" alt="">' : '<span>' + esc(inicial(id)) + '</span>';
      html += '<button type="button" class="team-player' + (id === jogadorAtivoId ? " active" : "") +
        '" data-active-player="' + id + '" aria-pressed="' + (id === jogadorAtivoId ? "true" : "false") + '">' +
        '<span class="team-player-photo">' + avatar + '</span><small>' + esc(p.name) + '</small></button>';
    });
    html += '</div></section>';

    var ativo = jog(jogadorAtivoId), fotoAtivo = fotoDe(jogadorAtivoId);
    var avatarAtivo = fotoAtivo ? '<img src="' + esc(fotoAtivo) + '" alt="">' : '<span>' + esc(inicial(jogadorAtivoId)) + '</span>';
    html += '<div class="active-action-player"><span class="active-action-photo">' + avatarAtivo + '</span>' +
      '<span><small>' + esc(POSICOES[state.field.indexOf(jogadorAtivoId)][0]) + '</small><b>' + esc(ativo.name) + '</b></span>' +
      '<span class="active-total"><b data-total="' + jogadorAtivoId + '">0</b> ações</span></div>';

    html += '<div class="parameter-list">';
    PARAMETROS.forEach(function (parametro) {
      html += '<article class="parameter-row"><h3>' + parametro.nome + '</h3><div class="parameter-answers">';
      RESPOSTAS.forEach(function (resposta) {
        var chave = parametro.k + "_" + resposta.k;
        html += '<button class="act answer-' + resposta.cat + '" style="--c:' + COR[resposta.cat] +
          '" data-id="' + jogadorAtivoId + '" data-act="' + chave + '" aria-label="' + parametro.nome +
          ': resposta ' + resposta.nome + '"><span class="answer-symbol">' + resposta.simbolo +
          '</span><span class="lbl">' + resposta.nome + '</span><span class="cnt">0</span></button>';
      });
      html += '</div></article>';
    });
    html += '</div>';
  }

  html += '<div class="result-summary"><div class="result-summary-head"><span>Total do time</span>' +
    '<b data-timeacoes>0 ações</b></div><div class="result-summary-grid">';
  RESPOSTAS.forEach(function (resposta) {
    html += '<div class="result-cell answer-' + resposta.cat + '"><span>' + resposta.simbolo + '</span>' +
      '<b data-result-total="' + resposta.k + '">0</b><small>' + resposta.nome + '</small></div>';
  });
  html += '</div></div>';
  viewRegistro.innerHTML = html;
  pintarContagens();
}

function pintarContagens() {
  var soma = {}, totalAcoes = 0;
  ACOES.forEach(function (a) { soma[a.k] = 0; });

  viewRegistro.querySelectorAll(".act").forEach(function (b) {
    var n = (state.counts[b.dataset.id] || {})[b.dataset.act] || 0;
    b.querySelector(".cnt").textContent = n;
    b.dataset.zero = n ? "0" : "1";
  });
  viewRegistro.querySelectorAll("[data-total]").forEach(function (el) {
    el.textContent = totalDe(el.dataset.total);
  });
  for (var id in state.counts) {
    for (var k in soma) soma[k] += state.counts[id][k] || 0;
  }
  for (var k2 in soma) {
    var el2 = viewRegistro.querySelector('[data-time="' + k2 + '"]');
    if (el2) el2.textContent = soma[k2];
  }
  for (var k3 in soma) totalAcoes += soma[k3];
  RESPOSTAS.forEach(function (resposta) {
    var totalResposta = 0;
    PARAMETROS.forEach(function (parametro) { totalResposta += soma[parametro.k + "_" + resposta.k] || 0; });
    var resultado = viewRegistro.querySelector('[data-result-total="' + resposta.k + '"]');
    if (resultado) resultado.textContent = totalResposta;
  });
  var tp = viewRegistro.querySelector("[data-timeacoes]");
  if (tp) tp.textContent = totalAcoes + (totalAcoes === 1 ? " ação" : " ações");

  var u = null;
  for (var i = state.log.length - 1; i >= 0; i--) if (state.log[i].tipo === "acao") { u = state.log[i]; break; }
  undoBtn.disabled = !u;
  undoTxt.textContent = u ? (acao(u.act) || {}).lbl + " · " + nomeDe(u.pid) : "nada";
}

viewRegistro.addEventListener("click", function (ev) {
  var jogador = ev.target.closest("[data-active-player]");
  if (jogador) {
    jogadorAtivoId = jogador.dataset.activePlayer;
    montarRegistro();
    return;
  }
  var b = ev.target.closest(".act");
  if (!b) return;
  var id = b.dataset.id, k = b.dataset.act;

  cnt(id)[k]++;
  state.log.push({ tipo: "acao", pid: id, act: k, pos: state.field.indexOf(id) });

  b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
  if (navigator.vibrate) navigator.vibrate(18);
  pintarContagens(); salvar();
});

var undoBtn = document.getElementById("undoBtn"), undoTxt = document.getElementById("undoTxt");
undoBtn.onclick = function () {
  for (var i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i].tipo === "acao") {
      var l = state.log.splice(i, 1)[0];
      if (cnt(l.pid)[l.act] > 0) cnt(l.pid)[l.act]--;
      break;
    }
  }
  pintarContagens(); salvar();
};

/* ================= escalação ================= */
var viewEsc = document.getElementById("viewEsc");

function montarEscalacao() {
  var html = '<div class="sec lineup-title"><span>Escalação</span></div>' +
    '<p class="hint">Jogo de 4: dois na rede, dois no fundo. Escolha apenas jogadores cadastrados ' +
    'na aba Jogadores.</p><div class="sec"><span>Em quadra</span></div>';

  POSICOES.forEach(function (pos, i) {
    var id = state.field[i], p = id ? jog(id) : null, t = id ? totalDe(id) : 0;
    var avatar = p && p.photo
      ? '<img src="' + esc(p.photo) + '" alt="">'
      : '<span aria-hidden="true">' + (p ? esc(inicial(id)) : "+") + '</span>';
    html += '<div class="lineup-row">' +
      '<div class="lr-head"><span class="pos">' + pos[0] + "</span>" +
        (t ? '<button class="zerar" data-zerar="' + id + '">' + t + (t === 1 ? " ação" : " ações") + " · zerar</button>" : "") +
        (id ? '<button class="tirar" data-remover="' + i + '">Tirar</button>' : "") +
      "</div>" +
      '<button class="pick" data-pos="' + i + '">' +
        '<span class="pick-avatar' + (p ? "" : " vazio") + '">' + avatar + '</span>' +
        '<span class="pname' + (p ? "" : " vazio") + '">' + esc(p ? (p.name || "sem nome") : "escolher jogador") + "</span>" +
        '<span class="swap">Trocar</span></button>' +
      "</div>";
  });

  var reservasCadastrados = state.bench.filter(function (id) { var p = jog(id); return p && p.server; });
  html += '<div class="sec"><span>Disponíveis no cadastro</span></div>';
  if (!reservasCadastrados.length) {
    html += '<p class="vazioMsg">Nenhum jogador disponível. Cadastre jogadores na aba Jogadores.</p>';
  } else {
    html += '<div class="bench-list">';
    ordenarPorNome(reservasCadastrados).forEach(function (id) {
      var p = jog(id);
      var avatar = p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : esc(inicial(id));
      html += '<div class="bench-player"><span class="bench-avatar">' + avatar + '</span>' +
        '<span class="bench-info"><b>' + esc(p.name) + '</b><small>Disponível</small></span></div>';
    });
    html += '</div>';
  }

  html += '<div class="sec"><span>Recomeçar</span></div>' +
    '<button class="danger" id="novoJogo">Novo jogo — zera as ações</button>' +
    '<p class="hint">Mantém a lista de jogadores, mas quem estava em quadra volta para a reserva.</p>';
  viewEsc.innerHTML = html;
}

viewEsc.addEventListener("click", function (ev) {
  var pick = ev.target.closest(".pick");
  if (pick) { abrirSeletor(+pick.dataset.pos); return; }

  var z = ev.target.closest("[data-zerar]");
  if (z) {
    var id = z.dataset.zerar;
    if (!confirm("Zerar as ações de " + nomeDe(id) + "?")) return;
    delete state.counts[id];
    state.log = state.log.filter(function (l) { return !(l.tipo === "acao" && l.pid === id); });
    salvar(); montarRegistro(); montarEscalacao();
    return;
  }

  var tirar = ev.target.closest("[data-remover]");
  if (tirar) { tirarDeQuadra(+tirar.dataset.remover); return; }

  if (ev.target.id === "novoJogo") {
    var houveAcoes = state.log.some(function (l) { return l.tipo === "acao"; });
    if (houveAcoes) {
      if (confirm("Você tem ações registradas neste jogo. Baixar a planilha antes de zerar?")) {
        exportBtn.click();
      } else if (!confirm("Zerar sem baixar a planilha? As ações registradas serão perdidas.")) {
        return;
      }
    } else if (!confirm("Zerar ações e linha do tempo?\n\nQuem está em quadra volta para a reserva.")) {
      return;
    }
    state.counts = {};
    state.log = [];
    state.pos = {};
    state.jogoInfo = { data: "" };
    state.field.forEach(function (id) {
      if (id && state.bench.indexOf(id) < 0) state.bench.unshift(id);
    });
    state.field = state.field.map(function () { return null; });
    salvar(); montarRegistro(); montarEscalacao();
    toast("Jogo novo: tudo zerado, time de volta na reserva");
    abrir("jogo");
    return;
  }
});

/* ================= seletor de jogador ================= */
var modal = document.getElementById("modal"), mList = document.getElementById("mList"),
  mSearch = document.getElementById("mSearch"), mTitle = document.getElementById("mTitle");
var posAlvo = null;

function abrirSeletor(pos) {
  var cadastrados = state.players.some(function (p) { return p.server; });
  if (!cadastrados) {
    toast("Cadastre pelo menos um jogador na aba Jogadores.", true);
    return;
  }
  posAlvo = pos;
  var atual = state.field[pos] ? nomeDe(state.field[pos]) : null;
  mTitle.textContent = atual ? "Quem entra no lugar de " + atual + "?" : "Quem joga de " + POSICOES[pos][0].toLowerCase() + "?";
  mSearch.value = "";
  listarOpcoes("");
  modal.hidden = false;
  if (window.matchMedia("(min-width:620px)").matches) mSearch.focus();
}
function fecharSeletor() { modal.hidden = true; posAlvo = null; }

function listarOpcoes(busca) {
  var q = busca.trim().toLowerCase(), html = "";
  function item(id, tag) {
    var t = totalDe(id);
    var foto = fotoDe(id);
    var avatar = foto ? '<img src="' + esc(foto) + '" alt="">' : '<span>' + esc(inicial(id)) + '</span>';
    if (q && nomeDe(id).toLowerCase().indexOf(q) < 0) return "";
    return '<button class="opt" data-escolher="' + id + '">' +
      '<span class="n">' + avatar + "</span>" +
      '<span class="t">' + esc(nomeDe(id)) + "</span>" +
      '<span class="tag">' + (t ? t + " ações" : tag || "") + "</span></button>";
  }
  var banco = ordenarPorNome(state.bench.filter(function (id) { var p = jog(id); return p && p.server; }))
    .map(function (id) { return item(id, "reserva"); }).join("");
  html += '<div class="optsec">Reservas</div>' + (banco || '<div class="optsec">nenhum</div>');

  var emQuadra = ordenarPorNome(state.field.filter(function (id, i) {
    var p = id ? jog(id) : null;
    return p && p.server && i !== posAlvo;
  }));
  var quadra = emQuadra.map(function (id) { return item(id, POSICOES[state.field.indexOf(id)][1]); }).join("");
  if (quadra.replace(/\s/g, "")) html += '<div class="optsec">Em quadra (troca de posição)</div>' + quadra;

  if (state.field[posAlvo]) {
    html += '<div class="optsec">Outras opções</div>' +
      '<button class="opt" data-escolher="__vago"><span class="n">–</span>' +
      '<span class="t">Deixar a vaga vazia</span></button>';
  }
  mList.innerHTML = html;
}

mSearch.oninput = function () { listarOpcoes(mSearch.value); };
document.getElementById("mClose").onclick = fecharSeletor;
modal.addEventListener("click", function (ev) { if (ev.target === modal) fecharSeletor(); });
mList.addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-escolher]");
  if (!b) return;
  substituir(posAlvo, b.dataset.escolher === "__vago" ? null : b.dataset.escolher);
  fecharSeletor();
});

function tirarDeQuadra(pos) {
  var id = state.field[pos];
  if (!id) return;
  if (!confirm("Tirar " + nomeDe(id) + " da quadra?\n\nEle volta para a reserva.")) return;
  state.field[pos] = null;
  delete state.pos[id];
  if (state.bench.indexOf(id) < 0) state.bench.unshift(id);
  salvar(); montarEscalacao(); montarRegistro();
}

function substituir(pos, id) {
  var saiu = state.field[pos];
  if (saiu === id) return;
  var ondeEstava = id ? state.field.indexOf(id) : -1;

  if (ondeEstava >= 0) {                       // troca de posição entre dois que já estão em quadra
    state.field[ondeEstava] = saiu;
    if (saiu) state.pos[saiu] = ondeEstava;
  } else {
    if (id) state.bench = state.bench.filter(function (x) { return x !== id; });
    if (saiu) state.bench.unshift(saiu);
  }
  state.field[pos] = id;
  if (id) state.pos[id] = pos;

  if (id && saiu && ondeEstava < 0) {
    state.log.push({ tipo: "sub", pid: id, saiu: saiu, pos: pos });
    toast(nomeDe(id) + " entrou no lugar de " + nomeDe(saiu));
  }
  salvar(); montarEscalacao(); montarRegistro();
}

/* ================= abas ================= */
var tabJogo = document.getElementById("tabJogo"),
  tabRegistro = document.getElementById("tabRegistro"), tabJogadores = document.getElementById("tabJogadores");
var viewJogadores = document.getElementById("viewJogadores");

function montarJogadores() {
  var html = '<div class="cad-head"><div><h1>Cadastro de jogadores</h1>' +
    '<p class="hint">O elenco fica salvo no servidor e pode ser usado nas escalações.</p></div>' +
    '<span class="cad-count">' + state.players.filter(function (p) { return p.server; }).length + ' cadastrados</span></div>';

  html += '<form class="player-form" id="playerForm">' +
    '<label class="photo-field" for="playerPhoto">' +
      '<span class="photo-preview" id="photoPreview"><span>+</span></span>' +
      '<span><b>Foto do jogador</b><small>JPG, PNG ou WebP · até 3 MB</small></span>' +
      '<input type="file" id="playerPhoto" accept="image/jpeg,image/png,image/webp" required>' +
    '</label>' +
    '<label class="cad-label" for="playerName">Nome</label>' +
    '<input class="cad-input" type="text" id="playerName" maxlength="80" placeholder="Nome do jogador" required>' +
    '<button class="save-player" type="submit">Cadastrar jogador</button>' +
    '<p class="form-status" id="playerFormStatus" role="status"></p>' +
  '</form>';

  html += '<div class="sec roster-title"><span>Elenco</span></div>';
  if (jogadoresCarregando) {
    html += '<p class="vazioMsg">Carregando jogadores…</p>';
  } else if (erroJogadores) {
    html += '<p class="server-error">' + esc(erroJogadores) + ' Inicie o site pelo servidor para cadastrar.</p>';
  } else {
    var cadastrados = state.players.filter(function (p) { return p.server; });
    cadastrados.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!cadastrados.length) html += '<div class="empty-roster"><b>Nenhum jogador cadastrado</b><span>Use o formulário acima para montar seu elenco.</span></div>';
    else {
      html += '<div class="roster-grid">';
      cadastrados.forEach(function (p) {
        var foto = p.photo
          ? '<img src="' + esc(p.photo) + '" alt="Foto de ' + esc(p.name) + '">'
          : '<span aria-hidden="true">' + esc((p.name || "–").trim().charAt(0)) + '</span>';
        html += '<article class="roster-card">' +
          '<div class="roster-photo">' + foto + '</div>' +
          '<strong>' + esc(p.name) + '</strong>' +
          '<button type="button" class="delete-player" data-excluir-jogador="' + esc(p.id) + '" aria-label="Excluir ' + esc(p.name) + '">Excluir</button>' +
        '</article>';
      });
      html += '</div>';
    }
  }
  viewJogadores.innerHTML = html;
}

function lerFoto(arquivo) {
  return new Promise(function (resolve, reject) {
    if (!arquivo) { resolve(""); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) { reject(new Error("Use uma foto JPG, PNG ou WebP.")); return; }
    if (arquivo.size > 3 * 1024 * 1024) { reject(new Error("A foto deve ter no máximo 3 MB.")); return; }
    var leitor = new FileReader();
    leitor.onload = function () { resolve(leitor.result); };
    leitor.onerror = function () { reject(new Error("Não foi possível ler a foto.")); };
    leitor.readAsDataURL(arquivo);
  });
}

viewJogadores.addEventListener("change", function (ev) {
  if (ev.target.id !== "playerPhoto") return;
  var arquivo = ev.target.files[0];
  var preview = document.getElementById("photoPreview");
  lerFoto(arquivo).then(function (foto) {
    preview.innerHTML = foto ? '<img src="' + foto + '" alt="Prévia da foto">' : '<span>+</span>';
  }).catch(function (erro) {
    ev.target.value = "";
    preview.innerHTML = '<span>+</span>';
    toast(erro.message, true);
  });
});

viewJogadores.addEventListener("submit", function (ev) {
  if (ev.target.id !== "playerForm") return;
  ev.preventDefault();
  var form = ev.target;
  var nome = document.getElementById("playerName").value.trim();
  var arquivo = document.getElementById("playerPhoto").files[0];
  var botao = form.querySelector(".save-player");
  var status = document.getElementById("playerFormStatus");
  botao.disabled = true;
  status.textContent = "Salvando…";

  lerFoto(arquivo).then(function (foto) {
    return fetch("/api/jogadores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome, foto: foto })
    });
  }).then(function (res) {
    return res.json().then(function (dados) {
      if (!res.ok) throw new Error(dados.erro || "Não foi possível cadastrar o jogador.");
      return dados;
    });
  }).then(function (item) {
    aplicarJogadoresServidor(state.players.filter(function (p) { return p.server; }).map(function (p) {
      return { id: p.id, nome: p.name, foto: p.photo };
    }).concat([item]));
    jogadoresCarregando = false;
    erroJogadores = "";
    montarJogadores();
    toast(item.nome + " foi cadastrado");
  }).catch(function (erro) {
    status.textContent = erro.message;
    status.classList.add("err");
    botao.disabled = false;
  });
});

viewJogadores.addEventListener("click", function (ev) {
  var botao = ev.target.closest("[data-excluir-jogador]");
  if (!botao) return;
  var id = botao.dataset.excluirJogador;
  var nome = nomeDe(id);
  if (!confirm("Excluir " + nome + " do cadastro?")) return;
  botao.disabled = true;
  fetch("/api/jogadores/" + encodeURIComponent(id), { method: "DELETE" })
    .then(function (res) { if (!res.ok) return res.json().then(function (d) { throw new Error(d.erro || "Não foi possível excluir."); }); })
    .then(function () {
      state.players = state.players.filter(function (p) { return p.id !== id; });
      state.bench = state.bench.filter(function (x) { return x !== id; });
      state.field = state.field.map(function (x) { return x === id ? null : x; });
      delete state.counts[id]; delete state.pos[id];
      state.log = state.log.filter(function (l) { return l.pid !== id && l.saiu !== id; });
      salvar(); montarJogadores(); montarEscalacao(); montarRegistro();
      toast(nome + " foi excluído");
    }).catch(function (erro) { botao.disabled = false; toast(erro.message, true); });
});

function abrir(qual) {
  if (qual === "registro" && !infoCompleta()) {
    toast("Informe a data do jogo antes de registrar ações.", true);
    qual = "jogo";
  }
  tabJogadores.setAttribute("aria-selected", qual === "jogadores" ? "true" : "false");
  tabJogo.setAttribute("aria-selected", qual === "jogo" ? "true" : "false");
  tabRegistro.setAttribute("aria-selected", qual === "registro" ? "true" : "false");
  viewJogadores.hidden = qual !== "jogadores";
  viewJogo.hidden = qual !== "jogo";
  viewEsc.hidden = qual !== "jogo";
  viewRegistro.hidden = qual !== "registro";
  undoBtn.hidden = qual !== "registro";
  if (qual === "jogadores") montarJogadores();
  if (qual === "jogo") { montarJogoInfo(); montarEscalacao(); }
  if (qual === "registro") montarRegistro();
  window.scrollTo(0, 0);
}
tabJogo.onclick = function () { abrir("jogo"); };
tabRegistro.onclick = function () { abrir("registro"); };
tabJogadores.onclick = function () { abrir("jogadores"); };

/* ================= exportar ================= */
var exportBtn = document.getElementById("exportBtn");

function dadosExport() {
  var campo = state.field.map(function (id, i) {
    return { posicao: POSICOES[i][0], nome: id ? nomeDe(id) : "" };
  });
  var reservas = state.bench.filter(function (id) { var p = jog(id); return p && p.server && (p.name || "").trim(); })
    .map(function (id) { return { nome: jog(id).name }; });

  var vistos = {}, ids = [];
  state.field.forEach(function (id) { if (id && !vistos[id]) { vistos[id] = 1; ids.push(id); } });
  state.players.forEach(function (p) {
    if (!vistos[p.id] && (totalDe(p.id) > 0 || state.pos[p.id] != null)) { vistos[p.id] = 1; ids.push(p.id); }
  });
  ids = ordenarPorNome(ids);

  var blocos = ids.map(function (id) {
    var c = state.counts[id] || {};
    return {
      posicao: posDe(id), nome: nomeDe(id),
      valores: ACOES.map(function (a) { return c[a.k] || 0; })
    };
  });

  var eventos = [], n = 0;
  state.log.forEach(function (l) {
    if (l.tipo === "acao") {
      var a = acao(l.act) || {};
      n++;
      eventos.push({ n: n, nome: nomeDe(l.pid),
        posicao: l.pos >= 0 ? POSICOES[l.pos][0] : posDe(l.pid),
        cat: a.cat, rotulo: a.rot || l.act });
      return;
    }
    n++;
    eventos.push({ n: n, nome: nomeDe(l.pid), posicao: POSICOES[l.pos][0], cat: null,
      rotulo: "ENTROU — saiu " + nomeDe(l.saiu) });
  });

  return {
    campo: campo, reservas: reservas, blocos: blocos, eventos: eventos,
    acoes: ACOES.map(function (a) { return { rot: a.rot, cat: a.cat }; }),
    info: {
      nome: "Jogo de vôlei",
      dataFmt: formatarData(state.jogoInfo.data),
      local: ""
    }
  };
}

exportBtn.onclick = function () {
  if (!infoCompleta()) {
    toast("Informe a data do jogo antes de exportar.", true);
    abrir("jogo");
    return;
  }
  exportBtn.disabled = true;
  try {
    var bytes = buildWorkbook(dadosExport());
    var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var d = new Date();
    var nome = "CONTROLE_TECNICO_VOLEI_" + pad(d.getDate()) + "-" + pad(d.getMonth() + 1) +
      "_" + pad(d.getHours()) + pad(d.getMinutes()) + ".xlsx";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast("Planilha gerada: " + nome);
  } catch (e) {
    toast("Não deu para gerar a planilha: " + e.message, true);
  }
  exportBtn.disabled = false;
};
function pad(n) { return n < 10 ? "0" + n : "" + n; }

/* ================= utilidades ================= */
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var toastTimer;
function toast(msg, erro) {
  var old = document.querySelector(".toast");
  if (old) old.remove();
  var t = document.createElement("div");
  t.className = "toast" + (erro ? " err" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.remove(); }, erro ? 6000 : 2600);
}

window.addEventListener("beforeunload", salvar);

montarJogoInfo();
montarRegistro();
if (!infoCompleta()) abrir("jogo");
else if (state.field.filter(function (id) { return id; }).length < 2) abrir("jogo");
else abrir("registro");
carregarJogadoresServidor();
})();
