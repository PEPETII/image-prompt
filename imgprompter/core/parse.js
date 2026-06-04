var ImgPrompterParse = (function () {
  "use strict";

  function stripMarkdown(text) {
    var s = text.trim();
    s = s.replace(/^```(?:json)?\s*/i, "");
    s = s.replace(/\s*```$/i, "");
    return s.trim();
  }

  function safeParse(text) {
    var cleaned = stripMarkdown(text);
    try {
      return { ok: true, data: JSON.parse(cleaned) };
    } catch (e) {
      var start = cleaned.indexOf("{");
      var end = cleaned.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return { ok: true, data: JSON.parse(cleaned.substring(start, end + 1)) };
        } catch (e2) {
        }
      }
      return { ok: false, raw: text };
    }
  }

  return {
    stripMarkdown: stripMarkdown,
    safeParse: safeParse,
  };
})();
