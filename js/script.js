// Extrae variables únicas de la expresión (mayúsculas y minúsculas)
function extraerVariables(expresion) {
    const letras = expresion.match(/[a-zA-Z]/g);
    return [...new Set(letras)].sort();
}

// Genera todas las combinaciones posibles de valores para las variables
function generarCombinaciones(variables) {
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

// Traduce símbolos lógicos a operadores de JS
function traducirExpresion(expr) {
    return expr
        .replace(/¬/g, '!')
        .replace(/∧/g, '&&')
        .replace(/∨/g, '||')
        .replace(/([a-zA-Z()!]+)\s*→\s*([a-zA-Z()!]+)/g, 'implica($1, $2)')
        .replace(/([a-zA-Z()!]+)\s*↔\s*([a-zA-Z()!]+)/g, 'equiv($1, $2)');
}

// Operadores lógicos compuestos
function implica(a, b) {
    return !a || b;
}
function equiv(a, b) {
    return (a && b) || (!a && !b);
}

// Extrae subexpresiones lógicas con paréntesis o nots
function extraerSubexpresiones(expresion) {
    const subexpresiones = new Set();
    const stack = [];

    for (let i = 0; i < expresion.length; i++) {
        if (expresion[i] === '(') {
            stack.push(i);
        } else if (expresion[i] === ')') {
            const inicio = stack.pop();
            const sub = expresion.slice(inicio, i + 1);
            subexpresiones.add(sub);
        }
    }

    const negaciones = expresion.match(/¬[a-zA-Z]/g);
    if (negaciones) {
        negaciones.forEach(n => subexpresiones.add(n));
    }

    return [...subexpresiones];
}

// Evalúa todas las expresiones: subexpresiones + final
function evaluarConSubexpresiones(exprOriginal, variables, combinaciones) {
    const subexprs = extraerSubexpresiones(exprOriginal);
    const todas = [...subexprs, exprOriginal];
    const resultadosPorExpr = {};

    for (let expr of todas) {
        const exprTraducida = traducirExpresion(expr);
        const resultados = [];

        for (let fila of combinaciones) {
            const contexto = variables.map(v => `let ${v} = ${fila[v]};`).join('');
            try {
                const resultado = eval(`${contexto} ${exprTraducida}`);
                resultados.push(Boolean(resultado));
            } catch (e) {
                resultados.push(null);
            }
        }

        resultadosPorExpr[expr] = resultados;
    }

    return resultadosPorExpr;
}

// Muestra la tabla con columnas intermedias
function mostrarTabla(variables, combinaciones, resultadosPorExpr) {
    const container = document.getElementById("tabla-wrapper");
    container.innerHTML = "";

    const table = document.createElement("table");
    table.className = "tabla-verdad";

    const thead = document.createElement("thead");
    const encabezado = document.createElement("tr");

    variables.forEach(v => {
        const th = document.createElement("th");
        th.textContent = v;
        encabezado.appendChild(th);
    });

    const subexprs = Object.keys(resultadosPorExpr);
    subexprs.forEach(expr => {
        const th = document.createElement("th");
        th.textContent = expr;
        encabezado.appendChild(th);
    });

    thead.appendChild(encabezado);
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

// Validaciones
function validarExpresion(expr) {
    const permitidos = /^[a-zA-Z¬∧∨→↔()\s]+$/;
    if (!permitidos.test(expr)) return "La expresión contiene caracteres no permitidos.";
    if (!verificarParentesis(expr)) return "Paréntesis desbalanceados.";
    return null;
}

function verificarParentesis(expr) {
    let balance = 0;
    for (let char of expr) {
        if (char === "(") balance++;
        if (char === ")") balance--;
        if (balance < 0) return false;
    }
    return balance === 0;
}

function mostrarError(mensaje) {
    const errorBox = document.getElementById("error");
    errorBox.textContent = mensaje;
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
            const conjuncion = variables.map(v => (fila[v] ? v : `¬${v}`)).join(' ∧ ');
            fnd.push(`(${conjuncion})`);
        } else {
            const disyuncion = variables.map(v => (fila[v] ? `¬${v}` : v)).join(' ∨ ');
            fnc.push(`(${disyuncion})`);
        }
    }

    return {
        fnc: fnc.length ? fnc.join(' ∧ ') : "Ninguna (tautología)",
        fnd: fnd.length ? fnd.join(' ∨ ') : "Ninguna (contradicción)"
    };
}

// Manejo del formulario
document.getElementById("formulario-expresion").addEventListener("submit", function (event) {
    event.preventDefault();

    const expresion = document.getElementById("expresion").value.trim();
    const clasificacion = document.getElementById("clasificacion");

    if (!expresion) {
        mostrarError("");
        clasificacion.innerHTML = "";
        document.getElementById("formas-normalizadas").innerHTML = "";
        document.getElementById("tabla-container").innerHTML = "";
        return;
    }

    const error = validarExpresion(expresion);
    if (error) {
        mostrarError(error);
        clasificacion.innerHTML = "";
        document.getElementById("formas-normalizadas").innerHTML = "";
        document.getElementById("tabla-container").innerHTML = "";
        return;
    } else {
        mostrarError("");
    }

    const variables = extraerVariables(expresion);
    const combinaciones = generarCombinaciones(variables);
    const resultadosPorExpr = evaluarConSubexpresiones(expresion, variables, combinaciones);

    mostrarTabla(variables, combinaciones, resultadosPorExpr);

    const exprs = Object.values(resultadosPorExpr);
    const resultadosFinales = exprs[exprs.length - 1];
    const tipo = clasificarProposicion(exprs);
    clasificacion.innerHTML = `Tipo de proposición: <strong>${tipo}</strong>`;

    const formas = obtenerFormasNormalizadas(variables, combinaciones, resultadosFinales);
    document.getElementById("formas-normalizadas").innerHTML = `
        <h2>Formas Normalizadas</h2>
        <div class="bloque-forma">
            <b>Forma Normal Conjuntiva (FNC):</b><br>
            ${formas.fnc}
        </div>
        <div class="bloque-forma">
            <b>Forma Normal Disyuntiva (FND):</b><br>
            ${formas.fnd}
        </div>
    `;
});

// Botones de símbolos
document.querySelectorAll('.btn-simbolo').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById('expresion');
        const simbolo = btn.textContent;
        const start = input.selectionStart;
        const end = input.selectionEnd;

        const before = input.value.substring(0, start);
        const after = input.value.substring(end);
        input.value = before + simbolo + after;

        const cursorPos = start + simbolo.length;
        input.focus();
        input.setSelectionRange(cursorPos, cursorPos);
    });
});
