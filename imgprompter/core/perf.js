var ImgPrompterPerf = (function () {
  "use strict";

  var PREFIX = "[ImgPrompterPerf]";

  function now() {
    return Date.now();
  }

  function safeMeta(meta) {
    var out = {};
    var key;
    if (!meta || typeof meta !== "object") return out;
    for (key in meta) {
      if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
      if (/key|token|image|base64|dataurl|authorization/i.test(key)) continue;
      out[key] = meta[key];
    }
    return out;
  }

  function create(label, meta) {
    return {
      label: label || "session",
      meta: safeMeta(meta),
      startAt: now(),
      marks: {},
    };
  }

  function mark(session, name) {
    if (!session || !name) return;
    session.marks[name] = now();
  }

  function duration(session, startName, endName) {
    if (!session) return -1;
    var startAt = startName ? session.marks[startName] : session.startAt;
    var endAt = endName ? session.marks[endName] : now();
    if (typeof startAt !== "number" || typeof endAt !== "number" || endAt < startAt) return -1;
    return endAt - startAt;
  }

  function summary(session, names) {
    var out = {};
    var i;
    if (!session || !names || !names.length) return out;
    for (i = 0; i < names.length; i++) {
      out[names[i]] = duration(session, names[i]);
    }
    return out;
  }

  function log(session, name, extra) {
    if (!session || !name || typeof console === "undefined" || !console.log) return;
    var payload = {
      session: session.label,
      ms: duration(session, name),
      meta: session.meta,
      extra: safeMeta(extra),
    };
    console.log(PREFIX, name, payload);
  }

  function logTotal(session, extra) {
    if (!session || typeof console === "undefined" || !console.log) return;
    console.log(PREFIX, "total", {
      session: session.label,
      ms: duration(session),
      meta: session.meta,
      extra: safeMeta(extra),
    });
  }

  return {
    now: now,
    create: create,
    mark: mark,
    duration: duration,
    summary: summary,
    log: log,
    logTotal: logTotal,
  };
})();
