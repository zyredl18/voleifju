"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "jogadores.json");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 5 * 1024 * 1024;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n", "utf8");

function responder(res, status, corpo, tipo) {
  res.writeHead(status, {
    "Content-Type": tipo || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(typeof corpo === "string" || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo));
}

function lerJogadores() {
  try {
    const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.error("Não foi possível ler jogadores.json:", erro.message);
    return [];
  }
}

function salvarJogadores(jogadores) {
  const temporario = DATA_FILE + ".tmp";
  fs.writeFileSync(temporario, JSON.stringify(jogadores, null, 2) + "\n", "utf8");
  fs.renameSync(temporario, DATA_FILE);
}

function migrarCadastroSemPosicao() {
  const jogadores = lerJogadores();
  let alterou = false;
  jogadores.forEach(jogador => {
    if (Object.prototype.hasOwnProperty.call(jogador, "posicao")) {
      delete jogador.posicao;
      alterou = true;
    }
  });
  if (alterou) salvarJogadores(jogadores);
}

migrarCadastroSemPosicao();

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on("data", parte => {
      tamanho += parte.length;
      if (tamanho > MAX_BODY) {
        reject(Object.assign(new Error("A foto deve ter no máximo 3 MB."), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString("utf8") || "{}"));
      } catch (_) {
        reject(Object.assign(new Error("Dados inválidos."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function salvarFoto(dataUrl, id) {
  if (!dataUrl) return "";
  const resultado = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!resultado) throw Object.assign(new Error("Use uma foto JPG, PNG ou WebP."), { status: 400 });
  const extensao = resultado[1] === "jpeg" ? "jpg" : resultado[1];
  const dados = Buffer.from(resultado[2], "base64");
  if (!dados.length || dados.length > 3 * 1024 * 1024) {
    throw Object.assign(new Error("A foto deve ter no máximo 3 MB."), { status: 413 });
  }
  const nome = id + "." + extensao;
  fs.writeFileSync(path.join(UPLOADS_DIR, nome), dados);
  return "/uploads/" + nome;
}

function removerFoto(caminho) {
  if (!caminho || !caminho.startsWith("/uploads/")) return;
  const arquivo = path.join(UPLOADS_DIR, path.basename(caminho));
  if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
}

function servirArquivo(reqPath, res) {
  const publicos = { "/": "v.html", "/v.html": "v.html", "/style.css": "style.css", "/script.js": "script.js" };
  let arquivo;
  if (publicos[reqPath]) {
    arquivo = path.join(ROOT, publicos[reqPath]);
  } else if (reqPath.startsWith("/uploads/")) {
    const nome = decodeURIComponent(reqPath.slice("/uploads/".length));
    if (!/^[0-9a-f-]+\.(jpg|jpeg|png|webp)$/i.test(nome)) {
      responder(res, 404, "Arquivo não encontrado.", "text/plain; charset=utf-8");
      return;
    }
    arquivo = path.join(UPLOADS_DIR, nome);
  } else {
    responder(res, 404, "Arquivo não encontrado.", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      responder(res, 404, "Arquivo não encontrado.", "text/plain; charset=utf-8");
      return;
    }
    const tipos = {
      ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"
    };
    responder(res, 200, conteudo, tipos[path.extname(arquivo).toLowerCase()] || "application/octet-stream");
  });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/jogadores" && req.method === "GET") {
      responder(res, 200, lerJogadores());
      return;
    }

    if (url.pathname === "/api/jogadores" && req.method === "POST") {
      const corpo = await lerCorpo(req);
      const nome = String(corpo.nome || "").trim();
      if (nome.length < 2 || nome.length > 80) throw Object.assign(new Error("Informe um nome entre 2 e 80 caracteres."), { status: 400 });
      if (!corpo.foto) throw Object.assign(new Error("Selecione a foto do jogador."), { status: 400 });

      const jogadores = lerJogadores();
      if (jogadores.some(j => j.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
        throw Object.assign(new Error("Já existe um jogador com esse nome."), { status: 409 });
      }
      const id = crypto.randomUUID();
      const jogador = { id, nome, foto: salvarFoto(corpo.foto, id), criadoEm: new Date().toISOString() };
      jogadores.push(jogador);
      salvarJogadores(jogadores);
      responder(res, 201, jogador);
      return;
    }

    const excluir = /^\/api\/jogadores\/([0-9a-f-]+)$/.exec(url.pathname);
    if (excluir && req.method === "DELETE") {
      const jogadores = lerJogadores();
      const indice = jogadores.findIndex(j => j.id === excluir[1]);
      if (indice < 0) throw Object.assign(new Error("Jogador não encontrado."), { status: 404 });
      const removido = jogadores.splice(indice, 1)[0];
      removerFoto(removido.foto);
      salvarJogadores(jogadores);
      responder(res, 200, { ok: true });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      responder(res, 405, { erro: "Método não permitido." });
      return;
    }
    servirArquivo(url.pathname, res);
  } catch (erro) {
    responder(res, erro.status || 500, { erro: erro.status ? erro.message : "Erro interno do servidor." });
  }
});

servidor.listen(PORT, () => {
  console.log("Controle Técnico · Vôlei disponível em http://localhost:" + PORT);
});
