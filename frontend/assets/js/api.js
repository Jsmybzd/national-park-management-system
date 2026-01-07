
(function () {
  "use strict";

  function _getToken() {
    try {
      return window.Auth && Auth.getToken ? Auth.getToken() : null;
    } catch (e) {
      return null;
    }
  }

  async function requestJson(method, url, body, options) {
    options = options || {};
    var headers = options.headers || {};
    headers["Accept"] = "application/json";

    var token = options.token != null ? options.token : _getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    var fetchOptions = {
      method: method,
      headers: headers,
    };

    if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      fetchOptions.body = JSON.stringify(body);
    }

    var resp = await fetch(url, fetchOptions);
    var text = await resp.text();
    var data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    }

    if (!resp.ok) {
      var err = new Error("HTTP " + resp.status);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  async function uploadFile(url, formData, options) {
    options = options || {};
    var headers = options.headers || {};
    headers["Accept"] = "application/json";

    var token = options.token != null ? options.token : _getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    var fetchOptions = {
      method: "POST",
      headers: headers,
      body: formData
    };

    var resp = await fetch(url, fetchOptions);
    var text = await resp.text();
    var data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    }

    if (!resp.ok) {
      var err = new Error("HTTP " + resp.status);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  function formatError(err) {
    if (!err) return "未知错误";
    if (typeof err === "string") return err;
    var msg = err.message || "请求失败";
    if (err.data) {
      if (typeof err.data === "string") return msg + ": " + err.data;
      if (err.data.detail) return msg + ": " + err.data.detail;
      try {
        return msg + ": " + JSON.stringify(err.data);
      } catch (e) {
        return msg;
      }
    }
    return msg;
  }

  window.Api = {
    requestJson: requestJson,
    uploadFile: uploadFile,
    formatError: formatError,
  };
})();

