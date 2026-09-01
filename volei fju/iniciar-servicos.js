"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const argumentoOriginal = process.argv[2] || process.env.SERVIDOR_ORIGINAL;

if (!argumentoOriginal) {
  console.error(
    "Informe o caminho do server.js original como argumento ou na variável SERVIDOR_ORIGINAL."
  );
  console.error(
    'Exemplo: npm run start:integrados -- "C:\\caminho\\projeto-original\\server.js"'
  );
  process.exit(1);
}

const servidorOriginal = path.resolve(argumentoOriginal);
const servidorVolei = path.join(__dirname, "server.js");

function iniciar(nome, arquivo, ambiente) {
  const processo = spawn(process.execPath, [arquivo], {
    cwd: path.dirname(arquivo),
    env: ambiente,
    stdio: "inherit"
  });

  processo.on("error", erro => {
    console.error(`[${nome}] Não foi possível iniciar: ${erro.message}`);
  });

  return processo;
}

const original = iniciar("Projeto original", servidorOriginal, {
  ...process.env,
  PORT: process.env.PORT || "3000"
});

const volei = iniciar("Projeto de vôlei", servidorVolei, {
  ...process.env,
  VOLEI_PORT: process.env.VOLEI_PORT || "3001"
});

let encerrando = false;

function encerrar(codigo = 0) {
  if (encerrando) return;
  encerrando = true;

  if (!original.killed) original.kill();
  if (!volei.killed) volei.kill();

  process.exitCode = codigo;
}

original.on("exit", codigo => {
  if (!encerrando) {
    console.error(`[Projeto original] Encerrado com código ${codigo ?? 1}.`);
    encerrar(codigo ?? 1);
  }
});

volei.on("exit", codigo => {
  if (!encerrando) {
    console.error(`[Projeto de vôlei] Encerrado com código ${codigo ?? 1}.`);
    encerrar(codigo ?? 1);
  }
});

process.on("SIGINT", () => encerrar(0));
process.on("SIGTERM", () => encerrar(0));
