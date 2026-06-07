var ImgPrompterPopupHistory = (function () {
  "use strict";

  function PopupHistory(opts) {
    this.listEl = opts && opts.listEl ? opts.listEl : null;
    this.emptyEl = opts && opts.emptyEl ? opts.emptyEl : null;
    this.clearBtnEl = opts && opts.clearBtnEl ? opts.clearBtnEl : null;
    this.msgEl = opts && opts.msgEl ? opts.msgEl : null;
    this._tabLoader = null;
    this._msgTimer = null;
    if (this.clearBtnEl) {
      this.clearBtnEl.addEventListener("click", this._onClearClick.bind(this));
    }
  }

  PopupHistory.prototype._onClearClick = function () {
    if (!this.clearBtnEl) return;
    var btn = this.clearBtnEl;
    chrome.runtime.sendMessage({ type: "imgprompter-clear-history" }, function (resp) {
      if (chrome.runtime.lastError || !resp || !resp.ok) return;
      this.load();
    }.bind(this));
  };

  PopupHistory.prototype.bindTabTrigger = function (loader) {
    this._tabLoader = typeof loader === "function" ? loader : null;
  };

  PopupHistory.prototype.onTabActivated = function () {
    if (this._tabLoader) this._tabLoader();
    else this.load();
  };

  PopupHistory.prototype.load = function () {
    var self = this;
    ImgPrompterStore.getHistory(function (list) {
      self.render(list || []);
    });
  };

  PopupHistory.prototype.render = function (list) {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";

    if (!list || list.length === 0) {
      if (this.emptyEl) this.emptyEl.style.display = "block";
      if (this.clearBtnEl) this.clearBtnEl.style.display = "none";
      return;
    }

    if (this.emptyEl) this.emptyEl.style.display = "none";
    if (this.clearBtnEl) this.clearBtnEl.style.display = "inline-block";

    var self = this;
    list.forEach(function (record) {
      self._renderCard(record);
    });
  };

  PopupHistory.prototype._renderCard = function (record) {
    var recordFormat = record && record.format ? record.format : "json";
    var recordLang = record && record.lang ? record.lang : "zh";
    var isPlainFormat = recordFormat === "plain";
    var isJsonFormat = recordFormat === "json";
    var isDetailFormat = recordFormat === "detail";
    var isMjFormat = recordFormat === "mj";
    var isSdFormat = recordFormat === "sd";
    var showPromptTab = isPlainFormat || isMjFormat || isSdFormat;
    var showJsonTab = isJsonFormat || isDetailFormat;

    var card = document.createElement("div");
    card.className = "hist-card";

    var topRow = document.createElement("div");
    topRow.className = "hist-top";

    if (record.imgSrc) {
      var thumb = document.createElement("img");
      thumb.className = "hist-thumb";
      thumb.src = record.imgSrc;
      thumb.alt = "缩略图";
      thumb.addEventListener("error", function () {
        thumb.style.display = "none";
        var placeholder = document.createElement("div");
        placeholder.className = "hist-thumb-placeholder";
        placeholder.textContent = "\uD83D\uDDBC";
        topRow.insertBefore(placeholder, topRow.firstChild);
      });
      topRow.appendChild(thumb);
    } else {
      var placeholder = document.createElement("div");
      placeholder.className = "hist-thumb-placeholder";
      placeholder.textContent = "\uD83D\uDDBC";
      topRow.insertBefore(placeholder, topRow.firstChild);
    }

    var info = document.createElement("div");
    info.className = "hist-info";

    var briefEl = document.createElement("div");
    briefEl.className = "hist-brief";
    briefEl.textContent = record.brief || "（无描述）";
    info.appendChild(briefEl);

    var timeEl = document.createElement("div");
    timeEl.className = "hist-time";
    timeEl.textContent = this._formatTime(record.time) + " · " + recordFormat.toUpperCase();
    info.appendChild(timeEl);

    topRow.appendChild(info);
    card.appendChild(topRow);

    var promptsRow = document.createElement("div");
    promptsRow.className = "hist-prompts";

    if ((isJsonFormat || isDetailFormat) && (record.prompt_zh || record.prompt_en)) {
      showPromptTab = true;
    }

    if (showPromptTab) {
      if ((recordLang === "zh" || recordLang === "both" || !recordLang) && record.prompt_zh) {
        this._appendPromptBlock(promptsRow, "中文", this._truncate(record.prompt_zh, 120), function () {
          this._copy(record.prompt_zh);
        }.bind(this));
      }

      if ((recordLang === "en" || recordLang === "both") && record.prompt_en) {
        this._appendPromptBlock(promptsRow, "英文", this._truncate(record.prompt_en, 120), function () {
          this._copy(record.prompt_en);
        }.bind(this));
      }

      if (isMjFormat && record.prompt_mj) {
        var mjFull = record.prompt_mj || "";
        if (record.mj_params) mjFull += " " + record.mj_params;
        var mjTrim = mjFull.trim();
        (function (copyStr) {
          this._appendPromptBlock(promptsRow, "Midjourney", this._truncate(mjTrim, 120), function () {
            this._copy(copyStr);
          }.bind(this));
        }).call(this, mjTrim);
      }

      if (isSdFormat && record.prompt_sd) {
        (function (sdCopy, negCopy) {
          this._appendPromptBlock(promptsRow, "Stable Diffusion", this._truncate(sdCopy, 120), function () {
            this._copy(sdCopy);
          }.bind(this));
          if (negCopy) {
            this._appendPromptBlock(promptsRow, "Negative", this._truncate(negCopy, 120), function () {
              this._copy(negCopy);
            }.bind(this));
          }
        }).call(this, record.prompt_sd, record.sd_negative || "");
      }
    }

    if (showJsonTab && record.json) {
      var jsonStr = JSON.stringify(record.json);
      var jsonPretty = JSON.stringify(record.json, null, 2);
      (function (copyText) {
        var jsonPreview = document.createElement("div");
        jsonPreview.className = "hist-prompt-block";
        var jsonLabel = document.createElement("div");
        jsonLabel.className = "hist-prompt-label";
        jsonLabel.textContent = isDetailFormat ? "详细 JSON" : "JSON";
        jsonPreview.appendChild(jsonLabel);
        var jsonText = document.createElement("div");
        jsonText.className = "hist-prompt-text";
        jsonText.textContent = this._truncate(jsonStr, 140);
        jsonPreview.appendChild(jsonText);
        var jsonCopy = document.createElement("button");
        jsonCopy.className = "btn btn-outline btn-xs";
        jsonCopy.textContent = "复制 JSON";
        jsonCopy.addEventListener("click", function () {
          this._copy(copyText);
        }.bind(this));
        jsonPreview.appendChild(jsonCopy);
        promptsRow.appendChild(jsonPreview);
      }).call(this, jsonPretty);
    }

    card.appendChild(promptsRow);

    var actionsRow = document.createElement("div");
    actionsRow.className = "hist-actions";

    var openBtn = document.createElement("button");
    openBtn.className = "btn btn-outline btn-xs hist-open-btn";
    openBtn.textContent = "打开详情";
    openBtn.addEventListener("click", this._makeOpenHandler(record, openBtn).bind(this));
    actionsRow.appendChild(openBtn);

    if (record.imgSrc) {
      var reanalyzeBtn = document.createElement("button");
      reanalyzeBtn.className = "btn btn-primary btn-xs hist-reanalyze-btn";
      reanalyzeBtn.textContent = "重新分析";
      reanalyzeBtn.addEventListener("click", this._makeReanalyzeHandler(record, reanalyzeBtn).bind(this));
      actionsRow.appendChild(reanalyzeBtn);
    }

    card.appendChild(actionsRow);
    this.listEl.appendChild(card);
  };

  PopupHistory.prototype._appendPromptBlock = function (parent, label, text, onCopy) {
    var block = document.createElement("div");
    block.className = "hist-prompt-block";
    var labelEl = document.createElement("div");
    labelEl.className = "hist-prompt-label";
    labelEl.textContent = label;
    block.appendChild(labelEl);
    var textEl = document.createElement("div");
    textEl.className = "hist-prompt-text";
    textEl.textContent = text;
    block.appendChild(textEl);
    var copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-outline btn-xs";
    copyBtn.textContent = "复制";
    copyBtn.addEventListener("click", onCopy);
    block.appendChild(copyBtn);
    parent.appendChild(block);
  };

  PopupHistory.prototype._makeOpenHandler = function (record, btn) {
    var self = this;
    return function () {
      btn.disabled = true;
      chrome.runtime.sendMessage(
        { type: "imgprompter-show-history-record", record: record },
        function (resp) {
          btn.disabled = false;
          if (chrome.runtime.lastError) {
            self._showActionMsg(ImgPrompterErr.msg("INJECT_BLOCKED"));
            return;
          }
          if (!resp || !resp.ok) {
            if (resp && resp.code === "INJECT_BLOCKED") {
              self._showActionMsg(ImgPrompterErr.msg("INJECT_BLOCKED"));
            } else if (resp && resp.code === "RECORD_EMPTY") {
              self._showActionMsg(ImgPrompterErr.msg("RECORD_EMPTY"));
            } else {
              self._showActionMsg("打开失败，请稍后重试");
            }
            return;
          }
          self._showActionMsg("已在当前页面打开历史结果");
        }
      );
    };
  };

  PopupHistory.prototype._makeReanalyzeHandler = function (record, btn) {
    var self = this;
    return function () {
      btn.disabled = true;
      chrome.runtime.sendMessage(
        { type: "imgprompter-reanalyze-history-record", record: record },
        function (resp) {
          btn.disabled = false;
          if (chrome.runtime.lastError) {
            self._showActionMsg("重新分析请求失败，请稍后重试");
            return;
          }
          if (!resp || !resp.ok) {
            if (resp && resp.code === "INJECT_BLOCKED") {
              self._showActionMsg(ImgPrompterErr.msg("INJECT_BLOCKED"));
            } else if (resp && resp.code === "IMG_SRC_EMPTY") {
              self._showActionMsg(ImgPrompterErr.msg("IMG_SRC_EMPTY"));
            } else {
              self._showActionMsg("重新分析失败，请稍后重试");
            }
            return;
          }
          self._showActionMsg("已在当前页面重新分析");
        }
      );
    };
  };

  PopupHistory.prototype._showActionMsg = function (text) {
    if (!this.msgEl) return;
    this.msgEl.textContent = text;
    this.msgEl.className = "form-msg ok";
    if (this._msgTimer) clearTimeout(this._msgTimer);
    var el = this.msgEl;
    this._msgTimer = setTimeout(function () {
      el.textContent = "";
      el.className = "form-msg";
    }, 2500);
  };

  PopupHistory.prototype._formatTime = function (iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var h = d.getHours();
    var min = d.getMinutes();
    return m + "/" + day + " " + (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min;
  };

  PopupHistory.prototype._truncate = function (s, max) {
    if (!s) return "";
    var str = String(s);
    if (str.length <= max) return str;
    return str.substring(0, max) + "...";
  };

  PopupHistory.prototype._copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text));
    } else {
      var ta = document.createElement("textarea");
      ta.value = String(text);
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return PopupHistory;
})();
