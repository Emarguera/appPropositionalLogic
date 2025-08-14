// =======================
// UI helpers
// =======================
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

function setError(msg){ const e = $("#error"); e.textContent = msg || ""; }
function copyText(text){
  navigator.clipboard?.writeText(text).then(()=>{}).catch(()=>{});
}

// =======================
// Normalización / Tokens
// =======================
function normalizarInput(expr) {
  expr = (expr || "").replace(/\s+/g, " ").trim();

  // ASCII -> símbolos
  expr = expr
    .replace(/<->|<=>/g, "↔")
    .replace(/->/g, "→")
    .replace(/~|!/g, "¬")
    .replace(/\\\/|\|\|/g, "∨") // \/ o ||
    .replace(/\/\\|&&/g, "∧");  // /\ o &&

  return expr;
}

const TOK = {
  VAR: "VAR", NOT: "NOT", AND: "AND", OR: "OR", IMP: "IMP", IFF: "IFF", LP: "LP", RP: "RP"
};

function tokenizar(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " ") { i++; continue; }
    if (c === "(") { tokens.push({t:TOK.LP, v:c}); i++; continue; }
    if (c === ")") { tokens.push({t:TOK.RP, v:c}); i++; continue; }
    if (c === "¬") { tokens.push({t:TOK.NOT, v:c}); i++; continue; }
    if (c === "∧") { tokens.push({t:TOK.AND, v:c}); i++; continue; }
    if (c === "∨") { tokens.push({t:TOK.OR, v:c}); i++; continue; }
    if (c === "→") { tokens.push({t:TOK.IMP, v:c}); i++; continue; }
    if (c === "↔") { tokens.push({t:TOK.IFF, v:c}); i++; continue; }

    if (/[A-Za-z]/.test(c)) {
      let j = i+1;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      tokens.push({t: TOK.VAR, v: expr.slice(i, j)});
      i = j; continue;
    }
    throw new Error(`Carácter no permitido '${c}' en posición ${i}`);
  }
  return tokens;
}

// =======================
// Shunting-yard & Eval
// =======================
function aRPN(tokens) {
  const out = [];
  const ops = [];

  const prec = { [TOK.NOT]:4, [TOK.AND]:3, [TOK.OR]:2, [TOK.IMP]:1, [TOK.IFF]:0 };
  const rightAssoc = new Set([TOK.IMP]); // → es right-assoc; ↔ lo dejamos left

  for (let i=0;i<tokens.length;i++) {
    const tk = tokens[i];
    switch (tk.t) {
      case TOK.VAR:
        out.push(tk); break;
      case TOK.NOT:
      case TOK.AND:
      case TOK.OR:
      case TOK.IMP:
      case TOK.IFF: {
        while (ops.length) {
          const top = ops[ops.length-1];
          if (top.t === TOK.LP) break;
          const pTop = prec[top.t], pTk = prec[tk.t];
          if (pTop > pTk || (pTop === pTk && !rightAssoc.has(tk.t))) {
            out.push(ops.pop());
          } else break;
        }
        ops.push(tk);
        break;
      }
      case TOK.LP:
        ops.push(tk); break;
      case TOK.RP:
        while (ops.length && ops[ops.length-1].t !== TOK.LP) out.push(ops.pop());
        if (!ops.length) throw new Error('Paréntesis desbalanceados (falta "(")');
        ops.pop();
        break;
      default: throw new Error('Token inesperado');
    }
  }
  while (ops.length) {
    const op = ops.pop();
    if (op.t === TOK.LP || op.t === TOK.RP) throw new Error('Paréntesis desbalanceados');
    out.push(op);
  }
  return out;
}

function evaluarRPN(rpn, val) {
  const st = [];
  for (const tk of rpn) {
    switch (tk.t) {
      case TOK.VAR: st.push(Boolean(val[tk.v])); break;
      case TOK.NOT: { const a = st.pop(); st.push(!a); break; }
      case TOK.AND: { const b = st.pop(), a = st.pop(); st.push(a && b); break; }
      case TOK.OR:  { const b = st.pop(), a = st.pop(); st.push(a || b); break; }
      case TOK.IMP: { const b = st.pop(), a = st.pop(); st.push(!a || b); break; }
      case TOK.IFF: { const b = st.pop(), a = st.pop(); st.push(a === b); break; }
      default: throw new Error('RPN inválido');
    }
  }
  if (st.length !== 1) throw new Error('Evaluación inválida');
  return st[0];
}

function evaluarFormula(expr, valuacion) {
  const norm = normalizarInput(expr);
  const tokens = tokenizar(norm);
  const rpn = aRPN(tokens);
  return evaluarRPN(rpn, valuacion);
}

// =======================
// Utilidades de la app
// =======================
function extraerVariables(expresion) {
  const norm = normalizarInput(expresion);
  // Variables 1+ caracteres alfanuméricos/underscore comenzando con letra
  const vars = norm.match(/\b[A-Za-z][A-Za-z0-9_]*\b/g) || [];
  // Filtrar palabras que sean operadores si coincidieran (no deberían)
  const set = new Set();
  for (const v of vars) {
    if (!["¬","∧","∨","→","↔"].includes(v)) set.add(v);
  }
  return Array.from(set).sort((a,b)=> a.localeCompare(b));
}

function generarCombinaciones(variables){
  const total = 2 ** variables.length;
  const combinaciones = [];
  for (let i = 0; i < total; i++) {
    const fila = {};
    variables.forEach((v, j) => {
      fila[v] = !!(i & (1 << (variables.length - j - 1)));
    });
    combinaciones.push(fila);
  }
  return combinaciones;
}

// Subexpresiones sencillas: paréntesis y negaciones atómicas
function extraerSubexpresiones(expresion) {
  const subexpresiones = new Set();
  const stack = [];
  for (let i = 0; i < expresion.length; i++) {
    if (expresion[i] === '(') stack.push(i);
    else if (expresion[i] === ')') {
      const inicio = stack.pop();
      if (inicio != null) subexpresiones.add(expresion.slice(inicio, i + 1));
    }
  }
  const negaciones = expresion.match(/¬[A-Za-z][A-Za-z0-9_]*/g);
  if (negaciones) negaciones.forEach(n => subexpresiones.add(n));
  return [...subexpresiones];
}

function evaluarConSubexpresiones(exprOriginal, variables, combinaciones, incluirSubexpr) {
  const todas = incluirSubexpr ? [...extraerSubexpresiones(exprOriginal), exprOriginal] : [exprOriginal];
  const resultadosPorExpr = {};
  for (let expr of todas) {
    const resultados = [];
    for (let fila of combinaciones) {
      try {
        const r = evaluarFormula(expr, fila);
        resultados.push(Boolean(r));
      } catch {
        resultados.push(null);
      }
    }
    resultadosPorExpr[expr] = resultados;
  }
  return resultadosPorExpr;
}

function clasificarProposicion(resultados) {
  const todosVerdaderos = resultados.every(val => val === true);
  const todosFalsos = resultados.every(val => val === false);
  if (todosVerdaderos) return "Tautología ✅";
  if (todosFalsos) return "Contradicción ❌";
  return "Contingencia ⚠️";
}

function obtenerFormasNormalizadas(variables, combinaciones, resultadosFinales) {
  const fnd = [], fnc = [];
  for (let i = 0; i < resultadosFinales.length; i++) {
    const fila = combinaciones[i];
    const resultado = resultadosFinales[i];
    if (resultado) {
      const conj = variables.map(v => (fila[v] ? v : `¬${v}`)).join(' ∧ ');
      fnd.push(`(${conj})`);
    } else {
      const disy = variables.map(v => (fila[v] ? `¬${v}` : v)).join(' ∨ ');
      fnc.push(`(${disy})`);
    }
  }
  return {
    fnc: fnc.length ? fnc.join(' ∧ ') : "Ninguna (tautología)",
    fnd: fnd.length ? fnd.join(' ∨ ') : "Ninguna (contradicción)"
  };
}

function renderTabla(variables, combinaciones, resultadosPorExpr) {
  const container = $("#tabla-wrapper");
  container.innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  variables.forEach(v => {
    const th = document.createElement("th");
    th.textContent = v;
    trh.appendChild(th);
  });

  const subexprs = Object.keys(resultadosPorExpr);
  subexprs.forEach(expr => {
    const th = document.createElement("th");
    th.textContent = expr;
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < combinaciones.length; i++) {
    const tr = document.createElement("tr");

    variables.forEach(v => {
      const td = document.createElement("td");
      const valor = combinaciones[i][v];
      td.textContent = valor ? "V" : "F";
      td.className = valor ? "true" : "false";
      tr.appendChild(td);
    });

    subexprs.forEach(expr => {
      const td = document.createElement("td");
      const valor = resultadosPorExpr[expr][i];
      td.textContent = valor ? "V" : "F";
      td.className = valor ? "true" : "false";
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// =======================
// Form / Eventos
// =======================
$("#ejemplos").addEventListener("change", (e)=>{
  if (e.target.value) $("#expresion").value = e.target.value;
});

$$(".btn-simbolo").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const input = $("#expresion");
    const simbolo = btn.textContent;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value.substring(0, start);
    const after = input.value.substring(end);
    input.value = before + simbolo + after;
    const pos = start + simbolo.length;
    input.focus();
    input.setSelectionRange(pos, pos);
  });
});

function verificarParentesis(expr) {
  let balance = 0;
  for (let i=0; i<expr.length; i++) {
    const c = expr[i];
    if (c === "(") balance++;
    if (c === ")") balance--;
    if (balance < 0) return false;
  }
  return balance === 0;
}

function validarExpresion(expr) {
  expr = normalizarInput(expr);
  const permitidos = /^[A-Za-z0-9_¬∧∨→↔()\s]+$/;
  if (!permitidos.test(expr)) return "La expresión contiene caracteres no permitidos.";
  if (!verificarParentesis(expr)) return "Paréntesis desbalanceados.";
  return null;
}

$("#formulario-expresion").addEventListener("submit", (ev)=>{
  ev.preventDefault();

  const incluirSubexpr = $("#toggle-subexpr").checked;
  const input = $("#expresion").value.trim();

  if (!input) {
    setError("");
    $("#clasificacion").innerHTML = "";
    $("#formas-normalizadas").innerHTML = "";
    $("#tabla-wrapper").innerHTML = "";
    return;
  }

  const norm = normalizarInput(input);
  const error = validarExpresion(norm);
  if (error) {
    setError(error);
    $("#clasificacion").innerHTML = "";
    $("#formas-normalizadas").innerHTML = "";
    $("#tabla-wrapper").innerHTML = "";
    return;
  } else {
    setError("");
  }

  const variables = extraerVariables(norm);
  if (variables.length > 16) {
    setError(`Demasiadas variables (${variables.length}). Limita a 16 para evitar 2^n filas.`);
    return;
  }

  const combinaciones = generarCombinaciones(variables);
  const resultadosPorExpr = evaluarConSubexpresiones(norm, variables, combinaciones, incluirSubexpr);

  // Render tabla
  renderTabla(variables, combinaciones, resultadosPorExpr);

  // Clasificación (usar la última columna = expresión original)
  const exprsArrays = Object.values(resultadosPorExpr);
  const resultadosFinales = exprsArrays[exprsArrays.length - 1];
  const tipo = clasificarProposicion(resultadosFinales);
  $("#clasificacion").innerHTML = `Tipo: <strong>${tipo}</strong>`;

  // FNC / FND
  const formas = obtenerFormasNormalizadas(variables, combinaciones, resultadosFinales);
  const fncHtml = `
    <div class="fn">
      <div class="title">FNC</div>
      <div class="expr">${formas.fnc}</div>
      <div class="row-actions"><button class="copy" data-copy="fnc">Copiar</button></div>
    </div>`;
  const fndHtml = `
    <div class="fn">
      <div class="title">FND</div>
      <div class="expr">${formas.fnd}</div>
      <div class="row-actions"><button class="copy" data-copy="fnd">Copiar</button></div>
    </div>`;
  $("#formas-normalizadas").innerHTML = fncHtml + fndHtml;

  // Copiar
  $$("#formas-normalizadas .copy").forEach(btn=>{
    btn.onclick = ()=>{
      const kind = btn.dataset.copy;
      const text = kind === "fnc" ? formas.fnc : formas.fnd;
      copyText(text);
      btn.textContent = "Copiado ✓";
      setTimeout(()=> btn.textContent = "Copiar", 1200);
    };
  });

  $("#btn-clear").addEventListener("click", () => {
  $("#expresion").value = "";
  setError("");
  $("#clasificacion").innerHTML = "";
  $("#formas-normalizadas").innerHTML = "";
  $("#tabla-wrapper").innerHTML = "";
  $("#ejemplos").value = "";
});

});
