(function () {
  "use strict";

  async function _loadHtml(url) {
    var resp = await fetch(url, { method: "GET" });
    if (!resp.ok) throw new Error("load " + url + " failed");
    return await resp.text();
  }

  async function getProfile() {
    try {
      var cached = Auth.getProfile();
      if (cached && cached.role_type) return cached;
    } catch (e) {}

    var prof = await Api.requestJson("GET", "/api/core/profile");
    Auth.setProfile(prof);
    return prof;
  }

  // 管理员角色列表
  var ADMIN_ROLES = ["系统管理员", "公园管理人员", "数据分析师", "生态监测员", "科研人员", "执法人员"];
  
  function isAdminRole(roleType) {
    return ADMIN_ROLES.indexOf(roleType) !== -1;
  }

  async function initLayout(opts) {
    opts = opts || {};
    var sidebarEl = document.getElementById("sidebar");
    var headerEl = document.getElementById("header");

    var profile = await getProfile();
    var isAdmin = profile && isAdminRole(profile.role_type);
    
    // 根据角色加载不同的侧边栏
    if (sidebarEl) {
      if (isAdmin) {
        sidebarEl.innerHTML = await _loadHtml("/web/components/sidebar.html");
      } else {
        sidebarEl.innerHTML = await _loadHtml("/web/components/sidebar-user.html");
      }
    }
    if (headerEl) headerEl.innerHTML = await _loadHtml("/web/components/header.html");
    
    // 更新用户信息显示
    var userName = document.getElementById("userName");
    var userRole = document.getElementById("userRole");
    var userAvatar = document.getElementById("userAvatar");
    
    if (profile) {
      var name = profile.name || profile.user_name || profile.username || "用户";
      var role = profile.role_type || "未知角色";
      
      if (userName) userName.textContent = name;
      if (userRole) userRole.textContent = role;
      if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
    }
    
    // 兼容旧版whoami元素
    var who = document.getElementById("whoami");
    if (who && profile) {
      who.textContent = (profile.name || "") + " · " + (profile.role_type || "");
    }

    // 设置页面标题
    if (opts.pageTitle) {
      var pageTitleEl = document.getElementById("pageTitle");
      if (pageTitleEl) pageTitleEl.textContent = opts.pageTitle;
    }

    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", Auth.logout);

    // 高亮当前导航
    var active = opts.active;
    if (active) {
      var links = document.querySelectorAll(".nav-link");
      for (var i = 0; i < links.length; i++) {
        var el = links[i];
        if ((el.getAttribute("data-nav") || "") === active) {
          el.classList.add("active");
        }
      }
    }

    return { profile: profile, isAdmin: isAdmin };
  }

  function setContentLoading(el, loadingText) {
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>' + (loadingText || "加载中...") + '</span></div>';
  }

  function renderJsonTable(el, rows, columns, opts) {
    if (!el) return;
    rows = rows || [];
    columns = columns || [];
    opts = opts || {};

    var html = '<div class="table-wrapper"><table class="table"><thead><tr>';
    for (var i = 0; i < columns.length; i++) {
      html += "<th>" + columns[i].label + "</th>";
    }
    if (opts.actions) {
      html += "<th>操作</th>";
    }
    html += "</tr></thead><tbody>";

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || {};
      html += "<tr>";
      for (var c = 0; c < columns.length; c++) {
        var col = columns[c];
        var key = col.key;
        var v = row[key];
        if (v === null || v === undefined) v = "";
        
        // 支持自定义渲染
        if (col.render) {
          html += "<td>" + col.render(v, row) + "</td>";
        } else if (col.tag) {
          html += '<td><span class="tag ' + (col.tagClass || '') + '">' + String(v) + '</span></td>';
        } else {
          html += "<td>" + String(v) + "</td>";
        }
      }
      if (opts.actions) {
        html += "<td>" + opts.actions(row) + "</td>";
      }
      html += "</tr>";
    }

    if (!rows.length) {
      var colSpan = columns.length + (opts.actions ? 1 : 0);
      html += '<tr><td colspan="' + colSpan + '" class="table-empty">暂无数据</td></tr>';
    }

    html += "</tbody></table></div>";
    el.innerHTML = html;
  }

  // Toast提示
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + message + '</span>';
    container.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // 模态框
  function showModal(opts) {
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = 
      '<div class="modal-header">' +
        '<div class="modal-title">' + (opts.title || '提示') + '</div>' +
        '<button class="modal-close" type="button">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' + (opts.content || '') + '</div>' +
      (opts.footer !== false ? '<div class="modal-footer">' +
        '<button class="btn modal-cancel" type="button">取消</button>' +
        '<button class="btn btn-primary modal-confirm" type="button">' + (opts.confirmText || '确认') + '</button>' +
      '</div>' : '');
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    function close() {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.remove(); }, 300);
    }
    
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.modal-cancel')?.addEventListener('click', close);
    overlay.querySelector('.modal-confirm')?.addEventListener('click', function() {
      if (opts.onConfirm) opts.onConfirm(close);
      else close();
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close();
    });
    
    return { close: close, overlay: overlay, modal: modal };
  }

  // 确认对话框
  function confirm(message, onConfirm) {
    return showModal({
      title: '确认操作',
      content: '<p>' + message + '</p>',
      onConfirm: function(close) {
        close();
        if (onConfirm) onConfirm();
      }
    });
  }

  // 格式化日期
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.getFullYear() + '-' + 
           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getDate()).padStart(2, '0') + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
  }

  window.Common = {
    initLayout: initLayout,
    setContentLoading: setContentLoading,
    renderJsonTable: renderJsonTable,
    showToast: showToast,
    showModal: showModal,
    confirm: confirm,
    formatDate: formatDate
  };
})();

