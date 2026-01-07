
(function () {
  "use strict";

  var TOKEN_KEY = "npm_token";
  var PROFILE_KEY = "npm_profile";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token || "");
    } catch (e) {}
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function getProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile || null));
    } catch (e) {}
  }

  function clearProfile() {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch (e) {}
  }

  function requireLogin() {
    if (!getToken()) {
      window.location.href = "/web/login.html";
      return false;
    }
    return true;
  }

  async function logout() {
    var token = getToken();
    try {
      if (token && window.Api) {
        await Api.requestJson("POST", "/api/core/logout", null);
      }
    } catch (e) {
    } finally {
      clearToken();
      clearProfile();
      window.location.href = "/web/login.html";
    }
  }

  window.Auth = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    getProfile: getProfile,
    setProfile: setProfile,
    clearProfile: clearProfile,
    requireLogin: requireLogin,
    logout: logout,
  };
})();

