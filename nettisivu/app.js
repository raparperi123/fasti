const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const keypad = document.getElementById("keypad");
const angleModeBtn = document.getElementById("angleMode");

let expression = "";
let angleMode = "DEG";
let lastResult = "0";
let justEvaluated = false;

const FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "cbrt",
  "log",
  "ln",
  "abs",
  "exp",
]);

function toDisplay(value) {
  return String(value)
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/(?<=\d|^|[+\-×÷(])-(?=\d)/g, "−")
    .replace(/\bpi\b/g, "π")
    .replace(/sqrt\(/g, "√(")
    .replace(/\./g, ",");
}

function normalizeInput(value) {
  return value.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi");
}

function formatResult(value) {
  if (!Number.isFinite(value)) return "Virhe";

  if (Math.abs(value) !== 0 && (Math.abs(value) >= 1e12 || Math.abs(value) < 1e-6)) {
    return value.toExponential(8).replace(/\.?0+e/, "e").replace(".", ",");
  }

  const rounded = Math.round(value * 1e10) / 1e10;
  const text = Object.is(rounded, -0) ? "0" : String(rounded);
  return text.replace(".", ",");
}

function updateDisplay(error = false) {
  expressionEl.textContent = expression ? toDisplay(expression) : "";
  resultEl.textContent = error ? "Virhe" : lastResult;
  resultEl.classList.toggle("display__result--error", error);
}

function setExpression(value, { error = false, evaluated = false } = {}) {
  expression = value;
  justEvaluated = evaluated;
  updateDisplay(error);
}

function appendToken(token) {
  if (justEvaluated && /^[\d.]/.test(token)) {
    expression = "";
  }
  justEvaluated = false;
  expression += token;
  updateDisplay();
}

function clearAll() {
  expression = "";
  lastResult = "0";
  justEvaluated = false;
  updateDisplay();
}

function backspace() {
  if (justEvaluated) {
    clearAll();
    return;
  }

  expression = expression.slice(0, -1);

  if (expression.endsWith("sqrt") || expression.endsWith("asin") || expression.endsWith("acos") || expression.endsWith("atan")) {
    expression = expression.replace(/(sqrt|asin|acos|atan)$/, "");
  } else if (expression.endsWith("sin") || expression.endsWith("cos") || expression.endsWith("tan") || expression.endsWith("log")) {
    expression = expression.replace(/(sin|cos|tan|log)$/, "");
  } else if (expression.endsWith("ln")) {
    expression = expression.slice(0, -2);
  }

  updateDisplay();
}

function endsWithNumberOrClosing(value) {
  return /[\d.)!e]$/.test(value) || /\bpi$/.test(value);
}

function endsWithOperator(value) {
  return /[+\-*/^(\s]$/.test(value) || /(?:sin|cos|tan|log|ln|sqrt|asin|acos|atan)\($/.test(value);
}

function toggleSign() {
  if (!expression) {
    expression = "-";
    updateDisplay();
    return;
  }

  const match = expression.match(/(-?\d+(?:\.\d+)?|\([^()]+\))$/);
  if (!match) return;

  const token = match[0];
  const start = expression.length - token.length;
  if (token.startsWith("-")) {
    expression = expression.slice(0, start) + token.slice(1);
  } else {
    expression = `${expression.slice(0, start)}(-${token})`;
  }
  updateDisplay();
}

function applySquare() {
  if (!expression) return;
  if (endsWithNumberOrClosing(expression)) {
    expression += "^2";
  } else {
    expression += "0^2";
  }
  justEvaluated = false;
  updateDisplay();
}

function applyReciprocal() {
  if (!expression) {
    expression = "1/";
    updateDisplay();
    return;
  }

  if (endsWithNumberOrClosing(expression)) {
    expression = `1/(${expression})`;
  } else {
    expression = "1/(";
  }
  justEvaluated = false;
  updateDisplay();
}

function applyFactorial() {
  if (!expression || !endsWithNumberOrClosing(expression)) return;
  expression += "!";
  justEvaluated = false;
  updateDisplay();
}

function insertValue(value) {
  const normalized = normalizeInput(value);

  if (normalized === ".") {
    if (justEvaluated) expression = "0";
    justEvaluated = false;

    const trailingNumber = expression.match(/(\d+(?:\.\d*)?)$/);
    if (trailingNumber && trailingNumber[0].includes(".")) return;
    if (!trailingNumber) expression += "0";
    expression += ".";
    updateDisplay();
    return;
  }

  if (/^[\d]$/.test(normalized)) {
    if (justEvaluated) expression = "";
    justEvaluated = false;
    expression += normalized;
    updateDisplay();
    return;
  }

  if (normalized === "pi" || normalized === "e") {
    if (endsWithNumberOrClosing(expression)) expression += "*";
    if (justEvaluated) expression = "";
    justEvaluated = false;
    expression += normalized;
    updateDisplay();
    return;
  }

  if (["+", "-", "*", "/", "^"].includes(normalized)) {
    if (!expression && normalized === "-") {
      expression = "-";
      justEvaluated = false;
      updateDisplay();
      return;
    }
    if (!expression || endsWithOperator(expression)) return;
    justEvaluated = false;
    expression += normalized;
    updateDisplay();
    return;
  }

  if (normalized === "(") {
    if (justEvaluated) expression = "";
    if (endsWithNumberOrClosing(expression)) expression += "*";
    justEvaluated = false;
    expression += "(";
    updateDisplay();
    return;
  }

  if (normalized === ")") {
    justEvaluated = false;
    expression += ")";
    updateDisplay();
    return;
  }

  if (FUNCTIONS.has(normalized.replace("(", ""))) {
    if (justEvaluated) expression = "";
    if (endsWithNumberOrClosing(expression)) expression += "*";
    justEvaluated = false;
    expression += normalized;
    updateDisplay();
  }
}

function balanceParentheses(value) {
  let open = 0;
  for (const char of value) {
    if (char === "(") open += 1;
    if (char === ")") open = Math.max(0, open - 1);
  }
  return value + ")".repeat(open);
}

function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const rest = input.slice(i);

    if (/^\s+/.test(rest)) {
      i += rest.match(/^\s+/)[0].length;
      continue;
    }

    if (/^\d+\.?\d*|\.\d+/.test(rest)) {
      const match = rest.match(/^\d+\.?\d*|\.\d+/)[0];
      tokens.push({ type: "number", value: Number(match) });
      i += match.length;
      continue;
    }

    const identifier = rest.match(/^[a-z]+/i);
    if (identifier) {
      const name = identifier[0].toLowerCase();
      if (name === "pi") {
        tokens.push({ type: "number", value: Math.PI });
      } else if (name === "e") {
        tokens.push({ type: "number", value: Math.E });
      } else if (FUNCTIONS.has(name)) {
        tokens.push({ type: "function", value: name });
      } else {
        throw new Error("Tuntematon funktio");
      }
      i += name.length;
      continue;
    }

    if (rest[0] === "(") {
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }

    if (rest[0] === ")") {
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    if ("+-*/^".includes(rest[0])) {
      tokens.push({ type: "operator", value: rest[0] });
      i += 1;
      continue;
    }

    if (rest[0] === "!") {
      tokens.push({ type: "factorial" });
      i += 1;
      continue;
    }

    throw new Error("Virheellinen merkki");
  }

  return tokens;
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error("Virheellinen kertoma");
  if (n > 170) throw new Error("Liian suuri kertoma");
  let result = 1;
  for (let k = 2; k <= n; k += 1) result *= k;
  return result;
}

function applyFunction(name, value) {
  switch (name) {
    case "sin":
      return Math.sin(angleMode === "DEG" ? (value * Math.PI) / 180 : value);
    case "cos":
      return Math.cos(angleMode === "DEG" ? (value * Math.PI) / 180 : value);
    case "tan":
      return Math.tan(angleMode === "DEG" ? (value * Math.PI) / 180 : value);
    case "asin":
      return angleMode === "DEG" ? (Math.asin(value) * 180) / Math.PI : Math.asin(value);
    case "acos":
      return angleMode === "DEG" ? (Math.acos(value) * 180) / Math.PI : Math.acos(value);
    case "atan":
      return angleMode === "DEG" ? (Math.atan(value) * 180) / Math.PI : Math.atan(value);
    case "sqrt":
      if (value < 0) throw new Error("Negatiivinen juuri");
      return Math.sqrt(value);
    case "cbrt":
      return Math.cbrt(value);
    case "log":
      if (value <= 0) throw new Error("Virheellinen logaritmi");
      return Math.log10(value);
    case "ln":
      if (value <= 0) throw new Error("Virheellinen logaritmi");
      return Math.log(value);
    case "abs":
      return Math.abs(value);
    case "exp":
      return Math.exp(value);
    default:
      throw new Error("Tuntematon funktio");
  }
}

function evaluateExpression(rawExpression) {
  const normalized = normalizeInput(rawExpression);
  if (!normalized.trim()) return 0;

  const tokens = tokenize(balanceParentheses(normalized));
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume() {
    return tokens[index++];
  }

  function parseExpression() {
    let value = parseTerm();

    while (peek()?.type === "operator" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }

    return value;
  }

  function parseTerm() {
    let value = parsePower();

    while (peek()?.type === "operator" && (peek().value === "*" || peek().value === "/")) {
      const op = consume().value;
      const right = parsePower();
      if (op === "/" && right === 0) throw new Error("Nollalla jako");
      value = op === "*" ? value * right : value / right;
    }

    return value;
  }

  function parsePower() {
    let value = parseUnary();

    while (peek()?.type === "operator" && peek().value === "^") {
      consume();
      const right = parseUnary();
      value = Math.pow(value, right);
    }

    return value;
  }

  function parseUnary() {
    if (peek()?.type === "operator" && peek().value === "-") {
      consume();
      return -parseUnary();
    }
    if (peek()?.type === "operator" && peek().value === "+") {
      consume();
      return parseUnary();
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let value = parsePrimary();

    while (peek()?.type === "factorial") {
      consume();
      value = factorial(value);
    }

    return value;
  }

  function parsePrimary() {
    const token = peek();

    if (!token) throw new Error("Keskeneräinen lauseke");

    if (token.type === "number") {
      consume();
      return token.value;
    }

    if (token.type === "function") {
      const name = consume().value;
      if (peek()?.type !== "lparen") throw new Error("Funktiolle tarvitaan sulku");
      consume();
      const arg = parseExpression();
      if (peek()?.type !== "rparen") throw new Error("Sulku puuttuu");
      consume();
      return applyFunction(name, arg);
    }

    if (token.type === "lparen") {
      consume();
      const value = parseExpression();
      if (peek()?.type !== "rparen") throw new Error("Sulku puuttuu");
      consume();
      return value;
    }

    throw new Error("Virheellinen lauseke");
  }

  const result = parseExpression();
  if (index < tokens.length) throw new Error("Virheellinen lauseke");
  if (!Number.isFinite(result)) throw new Error("Virheellinen tulos");
  return result;
}

function calculate() {
  if (!expression.trim()) return;

  try {
    const result = evaluateExpression(expression);
    const rounded = Math.round(result * 1e10) / 1e10;
    lastResult = formatResult(rounded);
    expression = String(rounded);
    justEvaluated = true;
    updateDisplay();
  } catch {
    lastResult = "Virhe";
    updateDisplay(true);
  }
}

function flashKey(button) {
  button.classList.add("is-pressed");
  window.setTimeout(() => button.classList.remove("is-pressed"), 120);
}

function handleButton(button) {
  flashKey(button);

  const action = button.dataset.action;
  const insert = button.dataset.insert;

  if (action === "clear") {
    clearAll();
    return;
  }

  if (action === "backspace") {
    backspace();
    return;
  }

  if (action === "toggle-sign") {
    toggleSign();
    return;
  }

  if (action === "square") {
    applySquare();
    return;
  }

  if (action === "reciprocal") {
    applyReciprocal();
    return;
  }

  if (action === "factorial") {
    applyFactorial();
    return;
  }

  if (action === "equals") {
    calculate();
    return;
  }

  if (insert) {
    insertValue(insert);
  }
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  handleButton(button);
});

angleModeBtn.addEventListener("click", () => {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleModeBtn.textContent = angleMode;
  angleModeBtn.classList.toggle("mode-toggle--rad", angleMode === "RAD");
});

document.addEventListener("keydown", (event) => {
  const { key } = event;

  if (/^\d$/.test(key)) {
    event.preventDefault();
    insertValue(key);
    return;
  }

  if (key === "." || key === ",") {
    event.preventDefault();
    insertValue(".");
    return;
  }

  if (["+", "-", "*", "/"].includes(key)) {
    event.preventDefault();
    insertValue(key);
    return;
  }

  if (key === "^") {
    event.preventDefault();
    insertValue("^");
    return;
  }

  if (key === "(" || key === ")") {
    event.preventDefault();
    insertValue(key);
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    calculate();
    return;
  }

  if (key === "Escape") {
    event.preventDefault();
    clearAll();
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    backspace();
  }
});

updateDisplay();
