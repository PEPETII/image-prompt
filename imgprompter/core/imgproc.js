var ImgPrompterImgProc = (function () {
  "use strict";

  var MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
  var MAX_EDGE = 512;
  var JPEG_QUALITY = 0.72;
  var IMG_LOAD_TIMEOUT_MS = 15000;

  var QUALITY_MODES = {
    fast: { maxEdge: 512, jpegQuality: 0.72 },
    standard: { maxEdge: 768, jpegQuality: 0.78 },
    high: { maxEdge: 1024, jpegQuality: 0.82 },
  };

  function resolveQualityOpts(opts) {
    var mode = (opts && opts.imageQualityMode) || "standard";
    var preset = QUALITY_MODES[mode] || QUALITY_MODES.standard;
    return {
      maxEdge: (opts && opts.maxEdge) || preset.maxEdge,
      jpegQuality: (opts && opts.jpegQuality) || preset.jpegQuality,
    };
  }

  function estimateDataUrlBytes(dataUrl) {
    var commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return 0;
    var b64Len = dataUrl.length - commaIdx - 1;
    var padding = 0;
    if (dataUrl.indexOf("==", commaIdx) !== -1) padding = 2;
    else if (dataUrl.indexOf("=", commaIdx) !== -1) padding = 1;
    return Math.round((b64Len * 3) / 4) - padding;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var timer = null;
      var done = false;

      function cleanup() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        img.onload = null;
        img.onerror = null;
      }

      img.onload = function () {
        if (done) return;
        done = true;
        cleanup();
        resolve(img);
      };

      img.onerror = function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("IMG_LOAD_FAIL"));
      };

      timer = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("IMG_LOAD_TIMEOUT"));
      }, IMG_LOAD_TIMEOUT_MS);

      img.src = src;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("IMG_COMPRESS_FAIL")); };
      reader.readAsDataURL(blob);
    });
  }

  function packResult(dataUrl, w, h, estBytes, compressedWidth, compressedHeight, compressedBytes) {
    return {
      base64: dataUrl,
      originalWidth: w,
      originalHeight: h,
      compressedWidth: compressedWidth || w,
      compressedHeight: compressedHeight || h,
      compressedBytes: compressedBytes || estBytes || estimateDataUrlBytes(dataUrl),
    };
  }

  function logPerf(session, phase, extra) {
    if (!session || typeof ImgPrompterPerf === "undefined") return;
    ImgPrompterPerf.mark(session, phase);
    ImgPrompterPerf.log(session, phase, extra);
  }

  function inspectBlobBitmap(blob) {
    return createImageBitmap(blob).then(function (bitmap) {
      var info = {
        width: bitmap.width,
        height: bitmap.height,
      };
      if (bitmap.close) bitmap.close();
      return info;
    });
  }

  function resizeBlobToDataUrl(blob, originalWidth, originalHeight, opts) {
    var q = resolveQualityOpts(opts);
    var maxEdge = q.maxEdge;
    var jpegQuality = q.jpegQuality;
    var scale = maxEdge / Math.max(originalWidth, originalHeight);
    var nw = Math.round(originalWidth * scale);
    var nh = Math.round(originalHeight * scale);
    return createImageBitmap(blob, {
      resizeWidth: nw,
      resizeHeight: nh,
      resizeQuality: "low",
    }).then(function (resized) {
      var canvas = new OffscreenCanvas(resized.width, resized.height);
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        if (resized.close) resized.close();
        throw new Error("IMG_COMPRESS_FAIL");
      }
      ctx.drawImage(resized, 0, 0);
      if (resized.close) resized.close();
      return canvas.convertToBlob({ type: "image/jpeg", quality: jpegQuality }).then(function (outBlob) {
        return blobToDataUrl(outBlob).then(function (dataUrl) {
          return packResult(dataUrl, originalWidth, originalHeight, blob.size, nw, nh, estimateDataUrlBytes(dataUrl));
        });
      });
    });
  }

  function compressFromArrayBuffer(buffer, contentType, perfSession, opts) {
    if (!buffer || buffer.byteLength > MAX_ORIGINAL_BYTES) {
      return Promise.reject(new Error("IMG_TOO_LARGE"));
    }
    if (typeof createImageBitmap === "undefined") {
      return Promise.reject(new Error("IMG_COMPRESS_FAIL"));
    }

    var q = resolveQualityOpts(opts);
    var maxEdge = q.maxEdge;

    var blob = new Blob([buffer], { type: contentType || "image/jpeg" });
    return inspectBlobBitmap(blob).then(function (size) {
      logPerf(perfSession, "image_inspect", {
        width: size.width,
        height: size.height,
        bytes: buffer.byteLength,
      });
      if (size.width <= 0 || size.height <= 0) {
        throw new Error("IMG_LOAD_FAIL");
      }
      if (size.width <= maxEdge && size.height <= maxEdge) {
        return blobToDataUrl(blob).then(function (dataUrl) {
          logPerf(perfSession, "image_compress", {
            skipped: true,
            width: size.width,
            height: size.height,
          });
          return packResult(dataUrl, size.width, size.height, buffer.byteLength);
        });
      }
      return resizeBlobToDataUrl(blob, size.width, size.height, opts).then(function (result) {
        logPerf(perfSession, "image_compress", {
          skipped: false,
          width: result.compressedWidth,
          height: result.compressedHeight,
          bytes: result.compressedBytes,
        });
        return result;
      });
    });
  }

  function parseDataUrlMeta(dataUrl) {
    var commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return null;
    var header = dataUrl.substring(0, commaIdx);
    var ctMatch = header.match(/^data:([^;]+)/);
    return {
      contentType: ctMatch ? ctMatch[1] : "image/jpeg",
      base64: dataUrl.substring(commaIdx + 1),
    };
  }

  function dataUrlToArrayBuffer(base64) {
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    var i;
    for (i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function compressFromDataUrl(dataUrl, perfSession, opts) {
    var estBytes = estimateDataUrlBytes(dataUrl);
    if (estBytes > MAX_ORIGINAL_BYTES) {
      return Promise.reject(new Error("IMG_TOO_LARGE"));
    }

    var q = resolveQualityOpts(opts);
    var maxEdge = q.maxEdge;
    var jpegQuality = q.jpegQuality;

    if (typeof createImageBitmap !== "undefined" && typeof OffscreenCanvas !== "undefined") {
      var meta = parseDataUrlMeta(dataUrl);
      if (meta) {
        var blob = new Blob([dataUrlToArrayBuffer(meta.base64)], { type: meta.contentType });
        return inspectBlobBitmap(blob).then(function (size) {
          logPerf(perfSession, "image_inspect", {
            width: size.width,
            height: size.height,
            bytes: estBytes,
          });
          if (size.width <= 0 || size.height <= 0) {
            throw new Error("IMG_LOAD_FAIL");
          }
          if (size.width <= maxEdge && size.height <= maxEdge) {
            logPerf(perfSession, "image_compress", {
              skipped: true,
              width: size.width,
              height: size.height,
            });
            return packResult(dataUrl, size.width, size.height, estBytes);
          }
          return resizeBlobToDataUrl(blob, size.width, size.height, opts).then(function (result) {
            logPerf(perfSession, "image_compress", {
              skipped: false,
              width: result.compressedWidth,
              height: result.compressedHeight,
              bytes: result.compressedBytes,
            });
            return result;
          });
        });
      }
    }

    return loadImage(dataUrl).then(function (img) {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      logPerf(perfSession, "image_inspect", {
        width: w,
        height: h,
        bytes: estBytes,
      });
      if (w === 0 || h === 0) throw new Error("IMG_LOAD_FAIL");
      if (w <= maxEdge && h <= maxEdge) {
        logPerf(perfSession, "image_compress", {
          skipped: true,
          width: w,
          height: h,
        });
        return packResult(dataUrl, w, h, estBytes);
      }

      var scale = maxEdge / Math.max(w, h);
      var nw = Math.round(w * scale);
      var nh = Math.round(h * scale);
      var canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, nw, nh);
      var compressedDataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
      var compressedBytes = estimateDataUrlBytes(compressedDataUrl);
      logPerf(perfSession, "image_compress", {
        skipped: false,
        width: nw,
        height: nh,
        bytes: compressedBytes,
      });
      return packResult(compressedDataUrl, w, h, estBytes, nw, nh, compressedBytes);
    });
  }

  function getViewportCrop(imageEl) {
    if (!imageEl || !imageEl.getBoundingClientRect) return null;

    var rect = imageEl.getBoundingClientRect();
    var x = Math.max(0, rect.left);
    var y = Math.max(0, rect.top);
    var right = Math.min(window.innerWidth, rect.right);
    var bottom = Math.min(window.innerHeight, rect.bottom);
    var width = Math.max(1, right - x);
    var height = Math.max(1, bottom - y);

    if (width <= 1 || height <= 1) return null;

    return {
      x: x,
      y: y,
      width: width,
      height: height,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  function captureDataUrlFromElement(imageEl, opts) {
    if (!imageEl || imageEl.tagName !== "IMG") {
      return Promise.reject(new Error("IMG_LOAD_FAIL"));
    }

    var src = imageEl.currentSrc || imageEl.src || "";
    if (/^data:image/i.test(src)) {
      return Promise.resolve(src);
    }

    if (typeof OffscreenCanvas === "undefined") {
      return Promise.reject(new Error("IMG_LOAD_FAIL"));
    }

    var q = resolveQualityOpts(opts);
    var maxEdge = q.maxEdge;
    var jpegQuality = q.jpegQuality;

    var width = imageEl.naturalWidth || imageEl.width;
    var height = imageEl.naturalHeight || imageEl.height;
    if (width <= 0 || height <= 0) {
      return Promise.reject(new Error("IMG_LOAD_FAIL"));
    }

    var scale = 1;
    if (width > maxEdge || height > maxEdge) {
      scale = maxEdge / Math.max(width, height);
    }
    var cw = Math.max(1, Math.round(width * scale));
    var ch = Math.max(1, Math.round(height * scale));

    try {
      var canvas = new OffscreenCanvas(cw, ch);
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        return Promise.reject(new Error("IMG_LOAD_FAIL"));
      }
      ctx.drawImage(imageEl, 0, 0, cw, ch);
      return canvas.convertToBlob({ type: "image/jpeg", quality: jpegQuality }).then(function (blob) {
        return blobToDataUrl(blob);
      });
    } catch (e) {
      return Promise.reject(new Error("IMG_LOAD_FAIL"));
    }
  }

  function fetchImageBlobFromPage(url) {
    if (!url) {
      return Promise.reject(new Error("IMG_LOAD_FAIL"));
    }
    return fetch(url, { credentials: "include" }).then(function (res) {
      if (!res.ok) throw new Error("IMG_LOAD_FAIL");
      return res.blob();
    }).then(function (blob) {
      return blobToDataUrl(blob);
    });
  }

  return {
    MAX_ORIGINAL_BYTES: MAX_ORIGINAL_BYTES,
    MAX_EDGE: MAX_EDGE,
    QUALITY_MODES: QUALITY_MODES,
    estimateDataUrlBytes: estimateDataUrlBytes,
    loadImage: loadImage,
    compressFromArrayBuffer: compressFromArrayBuffer,
    compressFromDataUrl: compressFromDataUrl,
    getViewportCrop: getViewportCrop,
    captureDataUrlFromElement: captureDataUrlFromElement,
    fetchImageBlobFromPage: fetchImageBlobFromPage,
  };
})();
