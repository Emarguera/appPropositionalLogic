function extraerVariables(expresion) {
    const letras = expresion.match(/[a-zA-Z]/g);
    return [...new Set(letras)].sort((a, b) => a.localeCompare(b));
}

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

function equiv(a, b) {
    return (a && b) || (!a && !b);
}

function traducirExpresion(expr) {
    return expr
        .replace(/¬/g, '!')
        .replace(/∧/g, '&&')
        .replace(/∨/g, '||')
        .replace(/→/g, '||')   // Implementación básica de implicación
        .replace(/↔/g, '<=>');
}

function evaluarExpresion(exprTraducida, variables, combinaciones) {
    const resultados = [];

    for (let i = 0; i < combinaciones.length; i++) {
        const fila = combinaciones[i];
        let contexto = '';
        let expr = exprTraducida;

        // Declarar variables con 'let nombre = valor'
        variables.forEach(v => {
            contexto += `let ${v} = ${fila[v]}; `;
        });

        // Reemplazar bicondicional
        expr = expr.replace(/(.+?)\s*<=>\s*(.+)/, 'equiv($1, $2)');

        try {
            const resultado = eval(`${contexto} ${expr}`);
            resultados.push(Boolean(resultado));
        } catch (e) {
            mostrarError("Error de sintaxis al evaluar la expresión. Revisa la estructura.");
            return null;
        }
    }

    return resultados;
}

function mostrarTabla(variables, combinaciones, resultados = []) {
    const container = document.getElementById("tabla-wrapper");
    container.innerHTML = "";

    const table = document.createElement("table");
    const header = document.createElement("tr");

    variables.forEach(v => {
        const th = document.createElement("th");
        th.textContent = v;
        header.appendChild(th);
    });

    if (resultados.length) {
        const th = document.createElement("th");
        th.textContent = "Resultado";
        header.appendChild(th);
    }

    table.appendChild(header);

    combinaciones.forEach((fila, i) => {
        const tr = document.createElement("tr");
        variables.forEach(v => {
            const td = document.createElement("td");
            td.textContent = fila[v] ? "V" : "F";
            td.className = fila[v] ? "true" : "false";
            tr.appendChild(td);
        });

        if (resultados.length) {
            const td = document.createElement("td");
            const val = resultados[i];
            td.textContent = val === true ? "V" : val === false ? "F" : "Error";
            td.className = val === true ? "true" : "false";
            tr.appendChild(td);
        }

        table.appendChild(tr);
    });

    container.appendChild(table);
}

function validarExpresion(expr) {
    const permitidos = /^[a-zA-Z¬∧∨→↔()\s]+$/;
    if (!permitidos.test(expr)) {
        return "La expresión contiene caracteres no permitidos.";
    }

    if (!verificarParentesis(expr)) {
        return "Los paréntesis no están balanceados.";
    }

    if (/([∧∨→↔]{2,})/.test(expr)) {
        return "Hay operadores lógicos duplicados.";
    }

    if (/([a-zA-Z])\s*\(/.test(expr) || /\)\s*([a-zA-Z])/.test(expr)) {
        return "Falta un operador entre una variable y un paréntesis.";
    }

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

function clasificarProposicion(resultados) {
    const todosVerdaderos = resultados.every(r => r === true);
    const todosFalsos = resultados.every(r => r === false);

    if (todosVerdaderos) return "Tautología ✅";
    if (todosFalsos) return "Contradicción ❌";
    return "Contingencia ⚠️";
}

function obtenerFormasNormalizadas(variables, combinaciones, resultados) {
    const fnd = [];
    const fnc = [];

    for (let i = 0; i < resultados.length; i++) {
        const fila = combinaciones[i];
        const resultado = resultados[i];

        if (resultado) {
            const conjuncion = variables.map(v => (fila[v] ? v : `¬${v}`)).join(' ∧ ');
            fnd.push(`(${conjuncion})`);
        }

        if (!resultado) {
            const disyuncion = variables.map(v => (fila[v] ? `¬${v}` : v)).join(' ∨ ');
            fnc.push(`(${disyuncion})`);
        }
    }

    return {
        fnc: fnc.length ? fnc.join(' ∧ ') : "Ninguna (tautología)",
        fnd: fnd.length ? fnd.join(' ∨ ') : "Ninguna (contradicción)"
    };
}

function mostrarError(mensaje) {
    const errorBox = document.getElementById("error");
    errorBox.textContent = mensaje;
}

document.getElementById("formulario-expresion").addEventListener("submit", function (event) {
    event.preventDefault();

    const expresion = document.getElementById("expresion").value.trim();
    const clasificacion = document.getElementById("clasificacion");

    if (!expresion) {
        clasificacion.innerHTML = "";
        document.getElementById("formas-normalizadas").innerHTML = "";
        document.getElementById("tabla-wrapper").innerHTML = "";
        mostrarError("");
        return;
    }

    const error = validarExpresion(expresion);
    if (error) {
        mostrarError(error);
        clasificacion.innerHTML = "";
        document.getElementById("formas-normalizadas").innerHTML = "";
        document.getElementById("tabla-wrapper").innerHTML = "";
        return;
    } else {
        mostrarError("");
    }

    const variables = extraerVariables(expresion);
    const combinaciones = generarCombinaciones(variables);
    const traducida = traducirExpresion(expresion);
    const resultados = evaluarExpresion(traducida, variables, combinaciones);

    if (!resultados) {
        clasificacion.innerHTML = "";
        document.getElementById("formas-normalizadas").innerHTML = "";
        document.getElementById("tabla-wrapper").innerHTML = "";
        return;
    }

    mostrarTabla(variables, combinaciones, resultados);

    const tipo = clasificarProposicion(resultados);
    clasificacion.innerHTML = `Tipo de proposición: <strong>${tipo}</strong>`;

    const formas = obtenerFormasNormalizadas(variables, combinaciones, resultados);
    document.getElementById("formas-normalizadas").innerHTML = `
        <h2>Formas Normalizadas</h2>
        <p><strong>Forma Normal Conjuntiva (FNC):</strong><br>${formas.fnc}</p>
        <p><strong>Forma Normal Disyuntiva (FND):</strong><br>${formas.fnd}</p>
    `;
});

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
