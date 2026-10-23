(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const ta = $("#code"), hl = $("#hl"), gutter = $("#gutter");
  const out = $("#out"), stdin = $("#stdin"), runBtn = $("#run"), stateEl = $("#state");
  const langSel = $("#lang"), engineSel = $("#engine"), endpoint = $("#endpoint");
  const extra = $("#extra"), nameEl = $("#name");
  let preview = $("#preview");

  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  const set = (s) => new Set(s.split(" "));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const mk = (c, t) => '<span class="' + c + '">' + esc(t) + "</span>";

  function scan(code, re, fn) {
    let out = "", last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      out += fn(m);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  const PY_KW = set("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None");
  const PY_BI = set("abs all any bin bool bytes callable chr dict dir divmod enumerate eval exec filter float format frozenset getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip Exception ValueError TypeError KeyError IndexError RuntimeError StopIteration");
  const PY_RE = /(#[^\n]*)|((?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$)))|(@[A-Za-z_][\w.]*)|(\b0[xX][\da-fA-F_]+\b|\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?j?\b|\.\d[\d_]*\b)|([A-Za-z_]\w*)|(\*\*=?|\/\/=?|<<=?|>>=?|:=|->|[-+*\/%&|^~<>=!]=?)/g;

  function hlPy(code) {
    let prev = "";
    return scan(code, PY_RE, (m) => {
      const t = m[0], was = prev;
      prev = "";
      if (m[1]) return mk("c", t);
      if (m[2]) {
        if (/^[rRbBuU]*[fF]/.test(t)) {
          return '<span class="s">' + esc(t).replace(/(\{\{|\}\})|(\{[^{}\n]*\})/g, (x, a, b) => a || '<span class="i">' + b + "</span>") + "</span>";
        }
        return mk("s", t);
      }
      if (m[3]) return mk("d", t);
      if (m[4]) return mk("n", t);
      if (m[5]) {
        if (PY_KW.has(t)) { if (t === "def" || t === "class") prev = t; return mk("k", t); }
        if (was) return mk("f", t);
        if (PY_BI.has(t)) return mk("b", t);
        if (t === "self" || t === "cls") return mk("d", t);
        return esc(t);
      }
      return mk("o", t);
    });
  }

  const JS_KW = set("break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await true false null undefined NaN Infinity");
  const JS_BI = set("console document window Math JSON Object Array String Number Boolean Promise Date Map Set WeakMap RegExp Error parseInt parseFloat setTimeout setInterval clearTimeout clearInterval fetch require module process readLine input");
  const JS_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$)|`(?:\\[\s\S]|[^`\\])*(?:`|$))|(\b0[xX][\da-fA-F_]+n?\b|\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?n?\b)|([A-Za-z_$][\w$]*)|(=>|\.\.\.|[-+*\/%&|^~<>=!?]+)/g;

  function hlJs(code) {
    let prev = "";
    return scan(code, JS_RE, (m) => {
      const t = m[0], was = prev;
      prev = "";
      if (m[1]) return mk("c", t);
      if (m[2]) return mk("s", t);
      if (m[3]) return mk("n", t);
      if (m[4]) {
        if (JS_KW.has(t)) { if (t === "function" || t === "class") prev = t; return mk("k", t); }
        if (was) return mk("f", t);
        if (JS_BI.has(t)) return mk("b", t);
        return esc(t);
      }
      return mk("o", t);
    });
  }

  const CPP_KW = set("alignas alignof and asm auto bitand bitor break case catch class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do dynamic_cast else enum explicit export extern false final for friend goto if inline mutable namespace new noexcept not nullptr operator or override private protected public register reinterpret_cast requires return sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union using virtual volatile while xor");
  const CPP_TY = set("int long short char float double bool void unsigned signed wchar_t size_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t std string vector map set unordered_map unordered_set pair tuple array deque list queue stack priority_queue optional variant function shared_ptr unique_ptr cout cin cerr endl getline sort min max swap move make_pair make_shared make_unique printf scanf puts main");
  const CPP_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(^[ \t]*#[ \t]*\w+[^\n]*)|((?:u8|[uUL])?"(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$))|(\b0[xX][\da-fA-F']+[uUlL]*\b|\b\d[\d']*\.?\d*(?:[eE][+-]?\d+)?[fFuUlL]*\b)|([A-Za-z_]\w*)|(::|->|<<=?|>>=?|&&|\|\||[-+*\/%&|^~<>=!]=?)/gm;

  function hlCpp(code) {
    let prev = "";
    return scan(code, CPP_RE, (m) => {
      const t = m[0], was = prev;
      prev = "";
      if (m[1]) return mk("c", t);
      if (m[2]) return mk("d", t);
      if (m[3]) return mk("s", t);
      if (m[4]) return mk("n", t);
      if (m[5]) {
        if (CPP_KW.has(t)) { if (t === "class" || t === "struct" || t === "enum" || t === "namespace") prev = t; return mk("k", t); }
        if (was) return mk("f", t);
        if (CPP_TY.has(t)) return mk("b", t);
        return esc(t);
      }
      return mk("o", t);
    });
  }

  const CSS_RE = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$))|(@[\w-]+)|(#[\da-fA-F]{3,8}\b)|(-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|ch|ms|s|deg|fr|pt|cm|mm)?)|(-?[A-Za-z_][\w-]*)|([{}();:,])/g;
  const CSS_PROP = /\s*:(?!:)[^;{}]*[;}]/y;

  function hlCss(code) {
    let depth = 0;
    return scan(code, CSS_RE, (m) => {
      const t = m[0];
      if (m[1]) return mk("c", t);
      if (m[2]) return mk("s", t);
      if (m[3]) return mk("k", t);
      if (m[4]) return depth > 0 ? mk("n", t) : mk("b", t);
      if (m[5]) return mk("n", t);
      if (m[6]) {
        if (depth === 0) return mk("b", t);
        CSS_PROP.lastIndex = CSS_RE.lastIndex;
        return CSS_PROP.test(code) ? mk("k", t) : esc(t);
      }
      if (t === "{") depth++;
      else if (t === "}") depth = Math.max(0, depth - 1);
      return mk("o", t);
    });
  }

  function hlTag(t) {
    const m = /^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>?)$/.exec(t);
    if (!m) return esc(t);
    const attrs = esc(m[3]).replace(/("[^"]*"|'[^']*')|([^\s="'\/&<>]+)/g, (x, v, n) => v ? '<span class="s">' + v + "</span>" : '<span class="b">' + n + "</span>");
    return mk("o", m[1]) + mk("k", m[2]) + attrs + mk("o", m[4]);
  }

  const HTML_RE = /(<!--[\s\S]*?(?:-->|$))|(<![A-Za-z][^>]*>?)|(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>|$)|(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>|$)|(<\/?[A-Za-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>?)|(&#?\w+;)/g;

  function hlHtml(code) {
    return scan(code, HTML_RE, (m) => {
      if (m[1]) return mk("c", m[0]);
      if (m[2]) return mk("d", m[0]);
      if (m[3]) return hlTag(m[3]) + hlJs(m[4]) + (m[5] ? hlTag(m[5]) : "");
      if (m[6]) return hlTag(m[6]) + hlCss(m[7]) + (m[8] ? hlTag(m[8]) : "");
      if (m[9]) return hlTag(m[9]);
      return mk("d", m[10]);
    });
  }

  const SAMPLES = {
    python: 'def fib():\n    a, b = 0, 1\n    while True:\n        yield a\n        a, b = b, a + b\n\nfor i, n in zip(range(12), fib()):\n    print(f"{i:>2}: {n}")\n',
    javascript: 'const fib = function* () {\n  let [a, b] = [0, 1];\n  while (true) { yield a; [a, b] = [b, a + b]; }\n};\n\nlet i = 0;\nfor (const n of fib()) {\n  if (i >= 12) break;\n  console.log(String(i++).padStart(2), n);\n}\n',
    html: '<!DOCTYPE html>\n<html>\n<head>\n<style>\n  body { font-family: monospace; margin: 24px; }\n  button { padding: 8px 16px; border: 1px solid #000; background: #000; color: #fff; cursor: pointer; }\n</style>\n</head>\n<body>\n  <h1>hello</h1>\n  <button id="b">clicks: 0</button>\n  <script>\n    let n = 0;\n    b.onclick = () => {\n      b.textContent = "clicks: " + ++n;\n      console.log("click", n);\n    };\n  </script>\n</body>\n</html>\n',
    cpp: '#include <iostream>\n#include <numeric>\n#include <vector>\n\nint main() {\n    std::vector<int> v(10);\n    std::iota(v.begin(), v.end(), 1);\n    int sum = std::accumulate(v.begin(), v.end(), 0);\n    std::cout << "sum: " << sum << "\\n";\n    return 0;\n}\n'
  };

  const LANGS = {
    python: { ext: ".py", hl: hlPy, engines: ["pyodide", "piston"], piston: "python" },
    javascript: { ext: ".js", hl: hlJs, engines: ["browser"] },
    html: { ext: ".html", hl: hlHtml, engines: ["browser"] },
    cpp: { ext: ".cpp", hl: hlCpp, engines: ["godbolt", "piston"], piston: "c++" }
  };
  const ENGINE_INFO = {
    pyodide: "pyodide 0.26.4 / wasm",
    piston: "piston / remote",
    godbolt: "compiler explorer / remote",
    browser: () => (lang === "html" ? "sandboxed iframe" : "web worker")
  };

  let lang = "python";
  const engine = () => engineSel.value;

  let lineCount = 0, raf = 0, saveTimer = 0;

  function draw() {
    raf = 0;
    const v = ta.value;
    hl.innerHTML = LANGS[lang].hl(v) + "\n";
    let n = 1;
    for (let i = v.indexOf("\n"); i !== -1; i = v.indexOf("\n", i + 1)) n++;
    if (n !== lineCount) {
      lineCount = n;
      let s = "";
      for (let i = 1; i <= n; i++) s += i + "\n";
      gutter.innerHTML = "<span>" + s + "</span>";
    }
    scroll();
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(draw);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set("pyrun.code." + lang, ta.value), 600);
  }
  function scroll() {
    hl.style.transform = "translate(" + -ta.scrollLeft + "px," + -ta.scrollTop + "px)";
    if (gutter.firstChild) gutter.firstChild.style.transform = "translateY(" + -ta.scrollTop + "px)";
  }
  function pos() {
    const p = ta.selectionStart, b = ta.value.slice(0, p);
    let l = 1;
    for (let i = b.indexOf("\n"); i !== -1; i = b.indexOf("\n", i + 1)) l++;
    $("#pos").textContent = l + ":" + (p - b.lastIndexOf("\n"));
  }

  function insert(text) {
    ta.focus();
    if (!document.execCommand("insertText", false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
      schedule();
    }
  }

  function shiftLines(dedent) {
    const v = ta.value;
    const s = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    let e = v.indexOf("\n", ta.selectionEnd);
    if (e === -1) e = v.length;
    const next = v.slice(s, e).split("\n").map((l) => dedent ? l.replace(/^( {1,4}|\t)/, "") : "    " + l).join("\n");
    ta.setSelectionRange(s, e);
    insert(next);
    ta.setSelectionRange(s, s + next.length);
  }

  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); toggle(); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes("\n");
      if (e.shiftKey || multi) shiftLines(e.shiftKey); else insert("    ");
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const v = ta.value, p = ta.selectionStart;
      const line = v.slice(v.lastIndexOf("\n", p - 1) + 1, p);
      let ind = line.match(/^[ \t]*/)[0];
      const opener = lang === "python" ? /:\s*(#.*)?$/ : /[{(\[]\s*$/;
      if (line.trim() && opener.test(line.trimEnd())) ind += "    ";
      insert("\n" + ind);
    }
  });
  ta.addEventListener("input", schedule);
  ta.addEventListener("scroll", scroll, { passive: true });
  ["keyup", "click"].forEach((ev) => ta.addEventListener(ev, pos));

  function log(text, cls) {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    out.appendChild(s);
    out.scrollTop = out.scrollHeight;
  }
  function trace(text) {
    String(text).split("\n").forEach((l) => {
      if (l) log(l + "\n", /(Error|Exception|error|fatal)\b/.test(l) ? "e" : "t");
    });
  }
  $("#clear").addEventListener("click", () => { out.textContent = ""; $("#time").textContent = ""; });

  const KNOWN_EXT = /\.(py|js|html|cpp|cc|c|h)$/i;
  function fixName() {
    let n = (nameEl.value.trim() || "main").replace(/[\\/:*?"<>|]/g, "_");
    const ext = LANGS[lang].ext;
    if (!n.toLowerCase().endsWith(ext)) n = n.replace(KNOWN_EXT, "") + ext;
    nameEl.value = n;
    store.set("pyrun.name", n);
    return n;
  }
  function save() {
    const n = fixName();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/plain" }));
    a.download = n;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("#save").addEventListener("click", save);
  nameEl.addEventListener("change", fixName);
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  });

  const pyWorkerSrc = `
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
    let py = null, lines = [];
    (async () => {
      try {
        py = await loadPyodide();
        py.setStdout({ batched: (s) => postMessage({ t: "o", s }) });
        py.setStderr({ batched: (s) => postMessage({ t: "e", s }) });
        py.setStdin({ stdin: () => (lines.length ? lines.shift() : undefined) });
        postMessage({ t: "ready", v: py.runPython("import sys; sys.version.split()[0]") });
      } catch (e) { postMessage({ t: "fatal", s: String((e && e.message) || e) }); }
    })();
    onmessage = async (ev) => {
      const m = ev.data;
      if (!py || m.t !== "run") return;
      lines = m.stdin ? m.stdin.split("\\n") : [];
      const ns = py.globals.get("dict")();
      try {
        if (/^\\s*(import|from)\\s/m.test(m.code)) await py.loadPackagesFromImports(m.code);
        await py.runPythonAsync(m.code, { globals: ns });
        postMessage({ t: "done", ok: true });
      } catch (e) {
        let msg = String((e && e.message) || e);
        const at = msg.indexOf('File "<exec>"');
        if (at > -1) msg = "Traceback (most recent call last):\\n  " + msg.slice(at);
        postMessage({ t: "tb", s: msg });
        postMessage({ t: "done", ok: false });
      } finally { ns.destroy(); }
    };
  `;

  const TOKEN = Math.random().toString(36).slice(2);
  let pyWorker = null, jsWorker = null, ready = false, running = false, t0 = 0, version = "", ctrl = null;

  function idleLabel() {
    const e = engine();
    if (e === "pyodide") return ready ? "python " + version : "loading python";
    if (e === "browser") return "ready";
    return "remote";
  }
  function engineInfo() {
    const i = ENGINE_INFO[engine()];
    $("#eng").textContent = typeof i === "function" ? i() : i;
  }
  function refresh() {
    const e = engine();
    endpoint.hidden = e !== "piston";
    extra.hidden = e !== "godbolt";
    runBtn.disabled = running ? false : (e === "pyodide" ? !ready : false);
    if (!running) stateEl.textContent = idleLabel();
    langSel.disabled = running;
    engineSel.disabled = running || engineSel.options.length < 2;
    engineInfo();
  }
  function setRunning(b) {
    running = b;
    runBtn.textContent = b ? "stop" : "compile";
    runBtn.classList.toggle("stop", b);
    refresh();
  }

  function startPy() {
    if (pyWorker) return;
    ready = false;
    pyWorker = new Worker(URL.createObjectURL(new Blob([pyWorkerSrc], { type: "text/javascript" })));
    pyWorker.onmessage = (ev) => {
      const m = ev.data;
      if (m.t === "o") log(m.s + "\n");
      else if (m.t === "e") log(m.s + "\n", "e");
      else if (m.t === "tb") trace(m.s);
      else if (m.t === "ready") { ready = true; version = m.v; refresh(); }
      else if (m.t === "done") done(m.ok);
      else if (m.t === "fatal") { stateEl.textContent = "offline"; log("could not log python: " + m.s + "\n", "e"); }
    };
    refresh();
  }

  function done(ok) {
    if (!running) return;
    const ms = Math.round(performance.now() - t0);
    setRunning(false);
    log("\n" + (ok ? "done" : "failed") + " " + ms + "ms\n", "m");
    $("#time").textContent = ms + "ms";
  }

  function newPreview(doc) {
    const f = document.createElement("iframe");
    f.id = "preview";
    f.title = "preview";
    f.setAttribute("sandbox", "allow-scripts allow-modals allow-forms");
    f.hidden = lang !== "html";
    if (doc != null) f.srcdoc = doc;
    preview.replaceWith(f);
    preview = f;
  }

  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.k !== TOKEN || ev.source !== preview.contentWindow) return;
    if (d.t === "o") log(d.s + "\n");
    else if (d.t === "e") log(d.s + "\n", "e");
    else if (d.t === "done") done(!!d.s);
  });

  const HTML_PRELUDE = '<script>(function(){var K=' + JSON.stringify(TOKEN) +
    ';function P(t,s){parent.postMessage({k:K,t:t,s:s},"*")}' +
    'function F(a){if(typeof a==="string")return a;if(a instanceof Error)return String(a);if(a===undefined)return "undefined";try{return JSON.stringify(a)}catch(e){return String(a)}}' +
    '["log","info","debug"].forEach(function(n){console[n]=function(){P("o",[].map.call(arguments,F).join(" "))}});' +
    '["warn","error"].forEach(function(n){console[n]=function(){P("e",[].map.call(arguments,F).join(" "))}});' +
    'window.addEventListener("error",function(e){P("e",e.message+(e.lineno?" (line "+e.lineno+")":""))});' +
    'window.addEventListener("unhandledrejection",function(e){P("e","Unhandled rejection: "+F(e.reason))});' +
    'window.addEventListener("load",function(){P("done",1)})})();</script>';

  function runHtml() {
    const code = ta.value;
    const m = /<head[^>]*>/i.exec(code) || /<html[^>]*>/i.exec(code) || /<!doctype[^>]*>/i.exec(code);
    const at = m ? m.index + m[0].length : 0;
    newPreview(code.slice(0, at) + HTML_PRELUDE + code.slice(at));
  }

  function runJs() {
    if (jsWorker) jsWorker.terminate();
    const lines = stdin.value ? stdin.value.split("\n") : [];
    const prelude =
      "const P=(t,s)=>postMessage({t,s});" +
      "const F=a=>{if(typeof a==='string')return a;if(a instanceof Error)return a.stack||String(a);if(typeof a==='undefined')return 'undefined';try{return JSON.stringify(a)}catch(e){return String(a)}};" +
      "for(const n of ['log','info','debug'])console[n]=(...a)=>P('o',a.map(F).join(' '));" +
      "for(const n of ['warn','error'])console[n]=(...a)=>P('e',a.map(F).join(' '));" +
      "const __L=" + JSON.stringify(lines) + ";self.readLine=self.input=()=>__L.length?__L.shift():null;" +
      "self.onunhandledrejection=e=>P('e','Unhandled rejection: '+F(e.reason));";
    const src = prelude + "(async()=>{\n" + ta.value + "\n})().then(()=>P('done',1),e=>{P('e',String(e));P('done',0)});";
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    jsWorker = new Worker(url);
    URL.revokeObjectURL(url);
    jsWorker.onmessage = (ev) => {
      const m = ev.data;
      if (m.t === "o") log(m.s + "\n");
      else if (m.t === "e") log(m.s + "\n", "e");
      else if (m.t === "done") done(!!m.s);
    };
    jsWorker.onerror = (ev) => {
      ev.preventDefault();
      log(String(ev.message || "script error").replace(/^Uncaught /, "") + (ev.lineno > 1 ? " (line " + (ev.lineno - 1) + ")" : "") + "\n", "e");
      done(false);
    };
  }

  async function runPiston() {
    ctrl = new AbortController();
    const base = endpoint.value.replace(/\/+$/, "");
    store.set("pyrun.endpoint", base);
    try {
      const r = await fetch(base + "/execute", {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: LANGS[lang].piston, version: "*", files: [{ name: fixName(), content: ta.value }], stdin: stdin.value })
      });
      if (!r.ok) { log("http " + r.status + "\n" + (await r.text()) + "\n", "e"); return done(false); }
      const d = await r.json(), x = d.run || {};
      if (d.compile && d.compile.stderr) trace(d.compile.stderr);
      if (x.stdout) log(x.stdout);
      if (x.stderr) trace(x.stderr);
      done(x.code === 0);
    } catch (err) {
      if (err.name === "AbortError") return;
      log("request failed: " + err.message + "\n", "e");
      done(false);
    }
  }

  async function runGodbolt() {
    ctrl = new AbortController();
    const parts = extra.value.trim().split(/\s+/);
    const id = parts.shift() || "g142";
    store.set("pyrun.extra", extra.value);
    const txt = (a) => (a || []).map((x) => x.text).join("\n");
    try {
      const r = await fetch("https://godbolt.org/api/compiler/" + encodeURIComponent(id) + "/compile", {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          source: ta.value, lang: "c++",
          options: {
            userArguments: parts.join(" "),
            executeParameters: { args: [], stdin: stdin.value },
            compilerOptions: { executorRequest: true },
            filters: { execute: true }, tools: [], libraries: []
          }
        })
      });
      if (!r.ok) { log("http " + r.status + "\n" + (await r.text()) + "\n", "e"); return done(false); }
      const d = await r.json(), b = d.buildResult || {};
      const bs = (txt(b.stderr) + "\n" + txt(b.stdout)).trim();
      if (b.code && b.code !== 0) { trace(bs || "build failed"); return done(false); }
      if (bs) trace(bs);
      const so = txt(d.stdout), se = txt(d.stderr);
      if (so) log(so + "\n");
      if (se) trace(se);
      if (d.timedOut) log("timed out\n", "e");
      done(!d.timedOut && (d.code === 0 || d.code === undefined));
    } catch (err) {
      if (err.name === "AbortError") return;
      log("request failed: " + err.message + "\n", "e");
      done(false);
    }
  }

  function stop() {
    const e = engine();
    if (e === "pyodide" && pyWorker) { pyWorker.terminate(); pyWorker = null; ready = false; }
    else if (e === "browser" && lang === "javascript" && jsWorker) { jsWorker.terminate(); jsWorker = null; }
    else if (e === "browser" && lang === "html") newPreview();
    else if (ctrl) ctrl.abort();
    log("\nstopped\n", "m");
    setRunning(false);
    if (e === "pyodide") startPy();
  }

  function toggle() {
    if (running) return stop();
    const e = engine();
    if (e === "pyodide" && !ready) return;
    out.textContent = "";
    t0 = performance.now();
    setRunning(true);
    stateEl.textContent = "running";
    if (e === "pyodide") pyWorker.postMessage({ t: "run", code: ta.value, stdin: stdin.value });
    else if (e === "piston") runPiston();
    else if (e === "godbolt") runGodbolt();
    else if (lang === "javascript") runJs();
    else runHtml();
  }
  runBtn.addEventListener("click", toggle);

  function setLang(next, initial) {
    if (!initial) {
      store.set("pyrun.code." + lang, ta.value);
      if (jsWorker) { jsWorker.terminate(); jsWorker = null; }
      newPreview();
    }
    lang = next;
    langSel.value = next;
    store.set("pyrun.lang", next);
    const legacy = next === "python" ? store.get("pyrun.code", SAMPLES.python) : SAMPLES[next];
    ta.value = store.get("pyrun.code." + next, legacy);
    nameEl.value = (nameEl.value.trim() || "main").replace(KNOWN_EXT, "") + LANGS[next].ext;
    engineSel.innerHTML = LANGS[next].engines.map((e) => '<option value="' + e + '">' + e + "</option>").join("");
    const saved = store.get("pyrun.engine." + next, LANGS[next].engines[0]);
    engineSel.value = LANGS[next].engines.includes(saved) ? saved : LANGS[next].engines[0];
    preview.hidden = next !== "html";
    stdin.hidden = next === "html";
    lineCount = 0;
    draw();
    pos();
    out.textContent = "";
    if (engine() === "pyodide") startPy();
    refresh();
  }

  langSel.addEventListener("change", () => setLang(langSel.value, false));
  engineSel.addEventListener("change", () => {
    store.set("pyrun.engine." + lang, engineSel.value);
    if (engine() === "pyodide") startPy();
    refresh();
  });
  endpoint.addEventListener("change", () => store.set("pyrun.endpoint", endpoint.value));
  extra.addEventListener("change", () => store.set("pyrun.extra", extra.value));

  const t00 = Date.now();
  let frames = 0, lastT = performance.now();
  const fpsEl = $("#fps"), upEl = $("#up");
  const p2 = (n) => (n < 10 ? "0" : "") + n;
  function tick(now) {
    frames++;
    if (now - lastT >= 1000) {
      fpsEl.textContent = Math.round((frames * 1000) / (now - lastT)) + " fps";
      frames = 0; lastT = now;
      const s = Math.floor((Date.now() - t00) / 1000);
      upEl.textContent = p2(Math.floor(s / 3600)) + ":" + p2(Math.floor((s % 3600) / 60)) + ":" + p2(s % 60);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  endpoint.value = store.get("pyrun.endpoint", endpoint.value);
  extra.value = store.get("pyrun.extra", extra.value);
  nameEl.value = store.get("pyrun.name", "main.py");
  const startLang = store.get("pyrun.lang", "python");
  setLang(LANGS[startLang] ? startLang : "python", true);
})();
