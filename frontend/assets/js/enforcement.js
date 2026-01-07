(function () {
  "use strict";

  var profile = null;
  var currentTab = "staff";
  var staffCache = [];
  var monitorsCache = [];
  var recordsCache = [];
  var dispatchCache = [];
  var pendingAlert = null;
  var evidenceImageCache = {};  // 存储上传的证据图片 {record_id: [base64Images]}

  function init(userProfile) {
    profile = userProfile;
    initTabs();
    loadStats();
    loadStaff();
    
    var createBtn = document.getElementById("createBtn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreateModal);
    }
  }

  function isManager() {
    return profile && ["公园管理人员", "系统管理员"].includes(profile.role_type);
  }

  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function(tab) {
      tab.addEventListener("click", function() {
        var tabName = this.getAttribute("data-tab");
        currentTab = tabName;
        
        tabs.forEach(function(t) { t.classList.remove("active"); });
        this.classList.add("active");
        
        document.querySelectorAll(".tab-content").forEach(function(c) {
          c.classList.remove("active");
        });
        document.getElementById("tab-" + tabName).classList.add("active");
        
        if (tabName === "staff") loadStaff();
        else if (tabName === "monitors") loadMonitors();
        else if (tabName === "records") loadRecords();
        else if (tabName === "dispatch") loadDispatch();
        else if (tabName === "alerts") loadAlerts();
      });
    });
  }

  // ========== 统计加载 ==========
  async function loadStats() {
    try {
      var staff = await Api.requestJson("GET", "/api/enforcement/staff");
      staffCache = staff || [];
      document.getElementById("statStaff").textContent = staff.length || 0;
    } catch (e) {
      document.getElementById("statStaff").textContent = "--";
    }
    
    try {
      var monitors = await Api.requestJson("GET", "/api/enforcement/monitor");
      monitorsCache = monitors || [];
      document.getElementById("statMonitors").textContent = monitors.length || 0;
    } catch (e) {
      document.getElementById("statMonitors").textContent = "--";
    }
    
    try {
      var records = await Api.requestJson("GET", "/api/enforcement/records");
      recordsCache = records || [];
      var unprocessed = records.filter(function(r) { return r.handle_status === "未处理"; }).length;
      document.getElementById("statRecords").textContent = unprocessed + "/" + records.length;
    } catch (e) {
      document.getElementById("statRecords").textContent = "--";
    }
    
    try {
      var dispatch = await Api.requestJson("GET", "/api/enforcement/dispatch");
      dispatchCache = dispatch || [];
      var pending = dispatch.filter(function(d) { return d.dispatch_status !== "已完成"; }).length;
      document.getElementById("statDispatch").textContent = pending;
    } catch (e) {
      document.getElementById("statDispatch").textContent = "--";
    }
  }

  // ========== 执法人员 ==========
  async function loadStaff() {
    var container = document.getElementById("staffTable");
    var notice = document.getElementById("notice");
    notice.style.display = "none";
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/enforcement/staff");
      staffCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无执法人员数据</div>';
        return;
      }
      
      var html = '<table class="enforcement-table"><thead><tr>' +
        '<th>👮 执法ID</th><th>姓名</th><th>部门</th><th>执法权限</th><th>📞 联系方式</th><th>🔧 设备编号</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item, index) {
        var permCls = item.permission && item.permission.includes('特级') ? 'tag-danger' : 
                      (item.permission && item.permission.includes('一级') ? 'tag-warning' : 'tag-info');
        html += '<tr>' +
          '<td><span class="tag tag-purple">' + (item.law_enforcement_id || '-') + '</span></td>' +
          '<td><strong style="color:#1e40af;">' + (item.staff_name || '-') + '</strong></td>' +
          '<td>' + (item.department || '-') + '</td>' +
          '<td><span class="tag ' + permCls + '" style="font-size:11px;">' + (item.permission || '未设置').substring(0, 15) + '</span></td>' +
          '<td style="font-family:monospace;">' + (item.contact || '-') + '</td>' +
          '<td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">' + (item.equipment_number || '-') + '</code></td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="EnforcementPage.editStaff(\'' + item.law_enforcement_id + '\')">✏️ 编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="EnforcementPage.deleteStaff(\'' + item.law_enforcement_id + '\')">🗑️ 删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      if (e && e.status === 403) {
        notice.textContent = "当前角色无权限访问执法模块（需要 系统管理员/公园管理人员/执法人员）";
        notice.style.display = "block";
        container.innerHTML = "";
      } else {
        container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
      }
    }
  }

  // ========== 视频监控点 ==========
  async function loadMonitors() {
    var container = document.getElementById("monitorsTable");
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/enforcement/monitor");
      monitorsCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无监控点数据</div>';
        return;
      }
      
      var html = '<table class="enforcement-table"><thead><tr>' +
        '<th>📹 监控点编号</th><th>📍 部署区域</th><th>经度</th><th>纬度</th><th>监控范围</th><th>设备状态</th><th>存储周期</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var statusCls = item.device_status === "正常" ? "tag-success" : "tag-danger";
        var statusIcon = item.device_status === "正常" ? "✅" : "❌";
        var rowCls = item.device_status === "故障" ? 'class="row-danger"' : '';
        html += '<tr ' + rowCls + '>' +
          '<td><span class="tag tag-info">' + (item.monitor_point_id || '-') + '</span></td>' +
          '<td><span class="tag tag-purple">' + (item.area_number || '-') + '</span></td>' +
          '<td style="font-family:monospace;font-size:11px;">' + (item.install_location_lng || '-') + '</td>' +
          '<td style="font-family:monospace;font-size:11px;">' + (item.install_location_lat || '-') + '</td>' +
          '<td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;">' + (item.monitor_range || '-') + '</td>' +
          '<td><span class="tag ' + statusCls + '">' + statusIcon + ' ' + (item.device_status || '未知') + '</span></td>' +
          '<td><strong>' + (item.data_storage_cycle || 90) + '</strong> 天</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="EnforcementPage.editMonitor(\'' + item.monitor_point_id + '\')">✏️ 编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="EnforcementPage.deleteMonitor(\'' + item.monitor_point_id + '\')">🗑️ 删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 非法行为记录 ==========
  async function loadRecords() {
    var container = document.getElementById("recordsTable");
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/enforcement/records");
      recordsCache = data || [];
      renderRecordsTable(data);
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  function renderRecordsTable(data) {
    var container = document.getElementById("recordsTable");
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无非法行为记录</div>';
      return;
    }
    
    var html = '<table class="enforcement-table"><thead><tr>' +
      '<th>📝 记录编号</th><th>⚠️ 行为类型</th><th>🕒 发生时间</th><th>📍 区域</th><th>处理状态</th><th>👮 执法ID</th><th>📹 监控点</th><th>🖼️ 证据</th><th>操作</th>' +
      '</tr></thead><tbody>';
    
    data.forEach(function(item) {
      var statusCls = item.handle_status === "已结案" ? "tag-success" : 
                      (item.handle_status === "处理中" ? "tag-info" : "tag-danger");
      var statusIcon = item.handle_status === "已结案" ? "✅" : 
                       (item.handle_status === "处理中" ? "⏳" : "🚨");
      var typeCls = item.behavior_type === "盗猎" ? "tag-danger" : 
                    (item.behavior_type === "非法进入" ? "tag-warning" : 
                    (item.behavior_type === "破坏植被" ? "tag-purple" : "tag-info"));
      var rowCls = item.handle_status === "未处理" ? 'class="row-danger"' : '';
      
      html += '<tr ' + rowCls + '>' +
        '<td><span class="tag tag-info" style="font-size:10px;">' + (item.record_id || '-') + '</span></td>' +
        '<td><span class="tag ' + typeCls + '">' + (item.behavior_type || '-') + '</span></td>' +
        '<td style="font-size:12px;">' + (item.occur_time ? Common.formatDate(item.occur_time) : '-') + '</td>' +
        '<td><span class="tag tag-purple">' + (item.area_number || '-') + '</span></td>' +
        '<td><span class="tag ' + statusCls + '">' + statusIcon + ' ' + (item.handle_status || '未处理') + '</span></td>' +
        '<td>' + (item.law_enforcement_id ? '<span class="tag tag-success">' + item.law_enforcement_id + '</span>' : '<em style="color:#dc2626;">未分配</em>') + '</td>' +
        '<td><span class="tag tag-info" style="font-size:10px;">' + (item.monitor_point_id || '-') + '</span></td>' +
        '<td>' + (item.evidence_path ? '<button class="btn btn-sm btn-secondary" onclick="EnforcementPage.viewEvidence(\'' + item.record_id + '\')">🖼️ 查看</button>' : '-') + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn btn-sm btn-primary" onclick="EnforcementPage.processRecord(\'' + item.record_id + '\')">📝 处理</button> ' +
          '<button class="btn btn-sm btn-warning" onclick="EnforcementPage.dispatchRecord(\'' + item.record_id + '\')">🚗 调度</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="EnforcementPage.deleteRecord(\'' + item.record_id + '\')">🗑️</button>' +
        '</td>' +
        '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function filterRecords() {
    var statusFilter = document.getElementById("filterStatus").value;
    var typeFilter = document.getElementById("filterType").value;
    
    var filtered = recordsCache.filter(function(item) {
      if (statusFilter && item.handle_status !== statusFilter) return false;
      if (typeFilter && item.behavior_type !== typeFilter) return false;
      return true;
    });
    
    renderRecordsTable(filtered);
    Common.showToast("筛选完成，共 " + filtered.length + " 条记录", "info");
  }

  function resetFilter() {
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterType").value = "";
    renderRecordsTable(recordsCache);
    Common.showToast("已重置筛选", "info");
  }

  // ========== 执法调度 ==========
  async function loadDispatch() {
    var container = document.getElementById("dispatchTable");
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/enforcement/dispatch");
      dispatchCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无调度记录</div>';
        return;
      }
      
      var html = '<table class="enforcement-table"><thead><tr>' +
        '<th>🚗 调度编号</th><th>📝 关联记录</th><th>👮 执法人员</th><th>调度时间</th><th>响应时间</th><th>完成时间</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var statusCls = item.dispatch_status === "已完成" ? "tag-success" : 
                        (item.dispatch_status === "已响应" || item.dispatch_status === "已派单" ? "tag-info" : "tag-warning");
        var statusIcon = item.dispatch_status === "已完成" ? "✅" : 
                         (item.dispatch_status === "已响应" ? "🟢" : 
                         (item.dispatch_status === "已派单" ? "🟡" : "⏳"));
        
        html += '<tr>' +
          '<td><span class="tag tag-info" style="font-size:10px;">' + (item.dispatch_id || '-') + '</span></td>' +
          '<td><span class="tag tag-purple" style="font-size:10px;">' + (item.record_id || '-') + '</span></td>' +
          '<td><span class="tag tag-success">' + (item.law_enforcement_id || '-') + '</span></td>' +
          '<td style="font-size:12px;">' + (item.dispatch_time ? Common.formatDate(item.dispatch_time) : '-') + '</td>' +
          '<td style="font-size:12px;">' + (item.response_time ? '<span style="color:#16a34a;">' + Common.formatDate(item.response_time) + '</span>' : '<em style="color:#999;">-</em>') + '</td>' +
          '<td style="font-size:12px;">' + (item.complete_time ? '<span style="color:#16a34a;font-weight:600;">' + Common.formatDate(item.complete_time) + '</span>' : '<em style="color:#999;">-</em>') + '</td>' +
          '<td><span class="tag ' + statusCls + '">' + statusIcon + ' ' + (item.dispatch_status || '待响应') + '</span></td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-primary" onclick="EnforcementPage.updateDispatchStatus(\'' + item.dispatch_id + '\')">🔄 更新状态</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="EnforcementPage.deleteDispatch(\'' + item.dispatch_id + '\')">🗑️</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 预警中心 ==========
  function loadAlerts() {
    var container = document.getElementById("alertsTable");
    
    // 从非法行为记录中获取未处理的作为预警
    var alerts = recordsCache.filter(function(r) { return r.handle_status === "未处理"; });
    
    // 添加监控点故障预警
    var faultMonitors = monitorsCache.filter(function(m) { return m.device_status === "故障"; });
    faultMonitors.forEach(function(m) {
      alerts.push({
        alert_type: "设备故障",
        content: "监控点 " + m.monitor_point_id + " 设备故障，位于区域 " + m.area_number,
        time: new Date().toISOString(),
        level: "中"
      });
    });
    
    if (alerts.length === 0) {
      container.innerHTML = '<div class="notice notice-success" style="text-align:center;padding:40px;">✅ 当前无预警<br><small>所有监控正常，无未处理非法行为</small></div>';
      return;
    }
    
    var html = '<div style="margin-bottom:16px;display:flex;gap:16px;">' +
      '<div style="flex:1;padding:16px;background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.05));border-radius:12px;text-align:center;border:1px solid rgba(239,68,68,0.2);">' +
        '<div style="font-size:28px;font-weight:bold;color:#dc2626;">' + alerts.filter(function(a) { return a.record_id; }).length + '</div>' +
        '<div style="color:#666;">🚨 非法行为预警</div>' +
      '</div>' +
      '<div style="flex:1;padding:16px;background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.05));border-radius:12px;text-align:center;border:1px solid rgba(245,158,11,0.2);">' +
        '<div style="font-size:28px;font-weight:bold;color:#d97706;">' + alerts.filter(function(a) { return !a.record_id; }).length + '</div>' +
        '<div style="color:#666;">⚠️ 设备故障预警</div>' +
      '</div>' +
    '</div>';
    html += '<table class="enforcement-table"><thead><tr>' +
      '<th>预警类型</th><th>详细内容</th><th>时间</th><th>操作</th>' +
      '</tr></thead><tbody>';
    
    alerts.forEach(function(alert) {
      if (alert.record_id) {
        // 非法行为预警
        html += '<tr class="row-danger">' +
          '<td><span class="tag tag-danger">🚨 ' + (alert.behavior_type || '非法行为') + '</span></td>' +
          '<td style="text-align:left;"><strong>区域:</strong> ' + alert.area_number + ' &nbsp; <strong>监控点:</strong> ' + (alert.monitor_point_id || '-') + '</td>' +
          '<td style="font-size:12px;">' + (alert.occur_time ? Common.formatDate(alert.occur_time) : '-') + '</td>' +
          '<td><button class="btn btn-sm btn-danger" onclick="EnforcementPage.dispatchRecord(\'' + alert.record_id + '\')">🚗 立即调度</button></td>' +
          '</tr>';
      } else {
        // 设备故障预警
        html += '<tr>' +
          '<td><span class="tag tag-warning">⚠️ ' + alert.alert_type + '</span></td>' +
          '<td style="text-align:left;">' + alert.content + '</td>' +
          '<td style="font-size:12px;">' + Common.formatDate(alert.time) + '</td>' +
          '<td><button class="btn btn-sm btn-secondary" onclick="EnforcementPage.viewMonitorDetail()">🔍 查看详情</button></td>' +
          '</tr>';
      }
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ========== 智能预警模拟 ==========
  async function simulateAlert() {
    // 先确保有监控点数据
    if (monitorsCache.length === 0) {
      try {
        var monitors = await Api.requestJson("GET", "/api/enforcement/monitor");
        monitorsCache = monitors || [];
      } catch (e) {
        Common.showToast("请先添加监控点数据", "error");
        return;
      }
    }
    
    if (monitorsCache.length === 0) {
      Common.showToast("⚠️ 暂无监控点，请先在【视频监控点】标签添加监控设备", "warning");
      return;
    }
    
    var types = ["非法进入", "盗猎", "破坏植被", "非法采集"];
    
    // 从现有监控点中随机选择
    var randomMonitor = monitorsCache[Math.floor(Math.random() * monitorsCache.length)];
    var alertType = types[Math.floor(Math.random() * types.length)];
    
    pendingAlert = {
      behavior_type: alertType,
      area_number: randomMonitor.area_number,
      monitor_point_id: randomMonitor.monitor_point_id,
      occur_time: new Date().toISOString()
    };
    
    var banner = document.getElementById("alertBanner");
    var alertText = document.getElementById("alertText");
    alertText.innerHTML = '🚨 在 <strong>' + randomMonitor.area_number + '</strong> 检测到 <strong style="color:#dc2626;">' + alertType + '</strong> 行为（监控点: ' + randomMonitor.monitor_point_id + '）';
    banner.style.display = "block";
    banner.classList.add("danger");
    
    Common.showToast("🚨 智能视频监控识别预警：检测到" + alertType + "！", "error");
    
    // 播放提示音效果（通过震动动画模拟）
    banner.style.animation = "none";
    setTimeout(function() { banner.style.animation = "pulse-danger 2s infinite"; }, 10);
  }

  async function handleAlert() {
    if (!pendingAlert) {
      Common.showToast("无待处理预警", "info");
      return;
    }
    
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    // 选择执法人员进行调度
    if (staffCache.length === 0) {
      Common.showToast("暂无可调度的执法人员", "error");
      return;
    }
    
    var staffOptions = staffCache.map(function(s) {
      return '<option value="' + s.law_enforcement_id + '">' + s.staff_name + ' (' + s.department + ')</option>';
    }).join('');
    
    var content = 
      '<form id="alertDispatchForm">' +
        '<div class="field" style="margin-bottom:16px;">' +
          '<label class="field-label">预警信息</label>' +
          '<div style="padding:12px;background:#fef2f2;border-radius:8px;">' +
            '<p><strong>行为类型：</strong>' + pendingAlert.behavior_type + '</p>' +
            '<p><strong>发生区域：</strong>' + pendingAlert.area_number + '</p>' +
            '<p><strong>监控点：</strong>' + pendingAlert.monitor_point_id + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">选择执法人员</label>' +
          '<select class="field-select" name="staff" required>' + staffOptions + '</select>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "🚨 处理预警 - 调度执法人员",
      content: content,
      confirmText: "立即调度",
      onConfirm: async function(close) {
        var form = document.getElementById("alertDispatchForm");
        var staffId = form.querySelector('select[name="staff"]').value;
        
        try {
          // 1. 创建非法行为记录
          var recordId = "REC_" + Date.now();
          await Api.requestJson("POST", "/api/enforcement/records", {
            record_id: recordId,
            behavior_type: pendingAlert.behavior_type,
            occur_time: pendingAlert.occur_time,
            area_number: pendingAlert.area_number,
            evidence_path: "/evidence/" + recordId + ".mp4",
            handle_status: "处理中",
            law_enforcement_id: staffId,
            monitor_point_id: pendingAlert.monitor_point_id
          });
          
          // 2. 创建调度记录
          var dispatchId = "DSP_" + Date.now();
          // 注意：后端可能有专门的调度创建存储过程
          
          Common.showToast("✅ 预警处理成功，已调度执法人员 " + staffId, "success");
          close();
          
          document.getElementById("alertBanner").style.display = "none";
          pendingAlert = null;
          
          loadStats();
          loadRecords();
        } catch (e) {
          Common.showToast("处理失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 新增弹窗 ==========
  function showCreateModal() {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    if (currentTab === "staff") showCreateStaffModal();
    else if (currentTab === "monitors") showCreateMonitorModal();
    else if (currentTab === "records") showCreateRecordModal();
    else Common.showToast("请在对应标签页新增数据", "info");
  }

  function showCreateStaffModal() {
    var content = 
      '<form id="createStaffForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">执法ID</label><input class="field-input" name="law_enforcement_id" placeholder="如 EF001" required /></div>' +
          '<div class="field"><label class="field-label">姓名</label><input class="field-input" name="staff_name" required /></div>' +
          '<div class="field"><label class="field-label">部门</label><input class="field-input" name="department" placeholder="如 执法大队" required /></div>' +
          '<div class="field"><label class="field-label">执法权限</label><input class="field-input" name="permission" placeholder="如 一级执法权" /></div>' +
          '<div class="field"><label class="field-label">联系方式</label><input class="field-input" name="contact" placeholder="手机号" required /></div>' +
          '<div class="field"><label class="field-label">设备编号</label><input class="field-input" name="equipment_number" placeholder="如 DEV_001" /></div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "新增执法人员",
      content: content,
      confirmText: "创建",
      onConfirm: async function(close) {
        var form = document.getElementById("createStaffForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/enforcement/staff", {
            law_enforcement_id: formData.get("law_enforcement_id"),
            staff_name: formData.get("staff_name"),
            department: formData.get("department"),
            permission: formData.get("permission"),
            contact: formData.get("contact"),
            equipment_number: formData.get("equipment_number")
          });
          Common.showToast("创建成功", "success");
          close();
          loadStaff();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function showCreateMonitorModal() {
    var content = 
      '<form id="createMonitorForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">监控点编号</label><input class="field-input" name="monitor_point_id" placeholder="如 CAM_001" required /></div>' +
          '<div class="field"><label class="field-label">部署区域</label><input class="field-input" name="area_number" placeholder="如 核心保护区-A1" required /></div>' +
          '<div class="field"><label class="field-label">经度</label><input class="field-input" name="lng" type="number" step="0.000001" placeholder="如 120.123456" required /></div>' +
          '<div class="field"><label class="field-label">纬度</label><input class="field-input" name="lat" type="number" step="0.000001" placeholder="如 30.123456" required /></div>' +
          '<div class="field"><label class="field-label">监控范围</label><input class="field-input" name="monitor_range" placeholder="如 半径500米" /></div>' +
          '<div class="field"><label class="field-label">存储周期(天)</label><input class="field-input" name="data_storage_cycle" type="number" value="90" /></div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "新增视频监控点",
      content: content,
      confirmText: "创建",
      onConfirm: async function(close) {
        var form = document.getElementById("createMonitorForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/enforcement/monitor", {
            monitor_point_id: formData.get("monitor_point_id"),
            area_number: formData.get("area_number"),
            install_location_lng: parseFloat(formData.get("lng")),
            install_location_lat: parseFloat(formData.get("lat")),
            monitor_range: formData.get("monitor_range"),
            data_storage_cycle: parseInt(formData.get("data_storage_cycle")) || 90
          });
          Common.showToast("创建成功", "success");
          close();
          loadMonitors();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function showCreateRecordModal() {
    if (monitorsCache.length === 0) {
      Common.showToast("⚠️ 请先添加监控点数据", "warning");
      return;
    }
    
    var monitorOptions = monitorsCache.map(function(m) {
      return '<option value="' + m.monitor_point_id + '" data-area="' + m.area_number + '">' + m.monitor_point_id + ' (' + m.area_number + ')</option>';
    }).join('');
    
    var content = 
      '<form id="createRecordForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">📝 记录编号</label><input class="field-input" name="record_id" value="REC_' + Date.now() + '" required /></div>' +
          '<div class="field"><label class="field-label">⚠️ 行为类型</label>' +
            '<select class="field-select" name="behavior_type">' +
              '<option value="非法进入">🚷 非法进入</option>' +
              '<option value="盗猎">🎯 盗猎</option>' +
              '<option value="破坏植被">🌿 破坏植被</option>' +
              '<option value="非法采集">🧺 非法采集</option>' +
              '<option value="其他">📋 其他</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">📹 监控点</label><select class="field-select" name="monitor_point_id" onchange="EnforcementPage.onMonitorSelect(this)">' + monitorOptions + '</select></div>' +
          '<div class="field"><label class="field-label">📍 发生区域</label><input class="field-input" name="area_number" value="' + (monitorsCache[0] ? monitorsCache[0].area_number : '') + '" required /></div>' +
        '</div>' +
        '<div class="field" style="margin-top:16px;">' +
          '<label class="field-label">🖼️ 证据图片上传</label>' +
          '<div class="image-upload-area" onclick="document.getElementById(\'evidenceFileInput\').click()">' +
            '<input type="file" id="evidenceFileInput" name="evidence_files" multiple accept="image/*" style="display:none;" onchange="EnforcementPage.previewImages(this)" />' +
            '<div>📤 点击上传图片证据（支持多张）</div>' +
            '<small style="color:#666;">支持 JPG、PNG、GIF 格式</small>' +
          '</div>' +
          '<div id="imagePreviewContainer" class="image-preview"></div>' +
          '<input type="hidden" name="evidence_path" id="evidencePathInput" value="/evidence/REC_' + Date.now() + '.jpg" />' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "🚨 新增非法行为记录",
      content: content,
      confirmText: "创建记录",
      onConfirm: async function(close) {
        var form = document.getElementById("createRecordForm");
        var formData = new FormData(form);
        
        // 生成证据路径（实际项目中应上传到服务器）
        var evidencePath = formData.get("evidence_path") || "/evidence/REC_" + Date.now() + ".jpg";
        
        try {
          var recordId = formData.get("record_id");
          await Api.requestJson("POST", "/api/enforcement/records", {
            record_id: recordId,
            behavior_type: formData.get("behavior_type"),
            occur_time: new Date().toISOString(),
            area_number: formData.get("area_number"),
            evidence_path: evidencePath,
            monitor_point_id: formData.get("monitor_point_id")
          });
          
          // 存储上传的图片到缓存
          if (tempUploadedImages.length > 0) {
            evidenceImageCache[recordId] = tempUploadedImages.slice();
            // 同时存储到localStorage以便刷新后保留
            try {
              var stored = JSON.parse(localStorage.getItem("evidenceImages") || "{}");
              stored[recordId] = tempUploadedImages.slice();
              localStorage.setItem("evidenceImages", JSON.stringify(stored));
            } catch (e) { console.warn("localStorage存储失败", e); }
          }
          tempUploadedImages = [];
          
          Common.showToast("✅ 非法行为记录创建成功", "success");
          close();
          loadRecords();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }
  
  // 监控点选择时自动填充区域
  function onMonitorSelect(selectEl) {
    var selectedOption = selectEl.options[selectEl.selectedIndex];
    var areaInput = document.querySelector('#createRecordForm input[name="area_number"]');
    if (areaInput && selectedOption.dataset.area) {
      areaInput.value = selectedOption.dataset.area;
    }
  }
  
  // 临时存储当前上传的图片
  var tempUploadedImages = [];
  
  // 图片预览
  function previewImages(input) {
    var container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    tempUploadedImages = [];  // 清空临时存储
    
    if (input.files && input.files.length > 0) {
      for (var i = 0; i < input.files.length; i++) {
        var file = input.files[i];
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = document.createElement("img");
          img.src = e.target.result;
          container.appendChild(img);
          // 存储base64图片数据
          tempUploadedImages.push(e.target.result);
        };
        reader.readAsDataURL(file);
      }
      
      // 更新证据路径
      var pathInput = document.getElementById("evidencePathInput");
      if (pathInput) {
        pathInput.value = "/evidence/" + input.files[0].name;
      }
      
      Common.showToast("已选择 " + input.files.length + " 张图片", "success");
    }
  }
  
  // 查看证据
  function viewEvidence(recordId) {
    var record = recordsCache.find(function(r) { return r.record_id === recordId; });
    if (!record) {
      Common.showToast("记录不存在", "error");
      return;
    }
    
    // 从缓存或localStorage获取图片
    var images = evidenceImageCache[recordId];
    if (!images) {
      try {
        var stored = JSON.parse(localStorage.getItem("evidenceImages") || "{}");
        images = stored[recordId];
        if (images) evidenceImageCache[recordId] = images;  // 恢复到内存缓存
      } catch (e) { console.warn("读取localStorage失败", e); }
    }
    
    var imageHtml = '';
    if (images && images.length > 0) {
      imageHtml = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:16px;">';
      images.forEach(function(imgSrc, idx) {
        imageHtml += '<img src="' + imgSrc + '" style="max-width:300px;max-height:250px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);cursor:pointer;" onclick="window.open(this.src)" title="点击放大" />';
      });
      imageHtml += '</div>';
    } else {
      imageHtml = 
        '<div style="background:#f1f5f9;border-radius:12px;padding:40px;margin-bottom:16px;">' +
          '<div style="font-size:48px;margin-bottom:12px;">🖼️</div>' +
          '<div style="color:#666;">暂无上传的图片证据</div>' +
          '<code style="display:block;margin-top:8px;padding:8px;background:#fff;border-radius:4px;">' + (record.evidence_path || '无') + '</code>' +
        '</div>';
    }
    
    // 上传按钮区域
    var uploadHtml = 
      '<div style="margin-top:16px;padding-top:16px;border-top:1px dashed #e5e7eb;">' +
        '<div class="image-upload-area" onclick="document.getElementById(\'evidenceUploadInput_' + recordId + '\').click()" style="padding:12px;">' +
          '<input type="file" id="evidenceUploadInput_' + recordId + '" multiple accept="image/*" style="display:none;" onchange="EnforcementPage.uploadEvidenceForRecord(\'' + recordId + '\', this)" />' +
          '<div>📤 ' + (images && images.length > 0 ? '追加上传图片' : '上传证据图片') + '</div>' +
        '</div>' +
      '</div>';
    
    var content = 
      '<div style="text-align:center;padding:20px;">' +
        '<div style="margin-bottom:16px;">' +
          '<span class="tag tag-info">' + recordId + '</span> ' +
          '<span class="tag tag-warning">' + (record.behavior_type || '未知') + '</span> ' +
          '<span class="tag tag-purple">' + (record.area_number || '-') + '</span>' +
        '</div>' +
        imageHtml +
        (images && images.length > 0 ? '<div style="color:#16a34a;font-size:12px;">✅ 共 ' + images.length + ' 张证据图片（点击图片可放大）</div>' : '') +
        uploadHtml +
      '</div>';
    
    Common.showModal({
      title: "🖼️ 查看证据 - " + recordId,
      content: content,
      confirmText: "关闭",
      onConfirm: function(close) { close(); }
    });
  }
  
  // 为现有记录上传证据图片
  function uploadEvidenceForRecord(recordId, input) {
    if (!input.files || input.files.length === 0) return;
    
    // 获取现有图片
    var existingImages = evidenceImageCache[recordId] || [];
    try {
      var stored = JSON.parse(localStorage.getItem("evidenceImages") || "{}");
      if (stored[recordId] && !evidenceImageCache[recordId]) {
        existingImages = stored[recordId];
      }
    } catch (e) {}
    
    var newImages = [];
    var filesLoaded = 0;
    var totalFiles = input.files.length;
    
    for (var i = 0; i < input.files.length; i++) {
      var reader = new FileReader();
      reader.onload = function(e) {
        newImages.push(e.target.result);
        filesLoaded++;
        
        // 所有文件读取完成后保存
        if (filesLoaded === totalFiles) {
          var allImages = existingImages.concat(newImages);
          evidenceImageCache[recordId] = allImages;
          
          // 保存到localStorage
          try {
            var stored = JSON.parse(localStorage.getItem("evidenceImages") || "{}");
            stored[recordId] = allImages;
            localStorage.setItem("evidenceImages", JSON.stringify(stored));
          } catch (e) { console.warn("localStorage存储失败", e); }
          
          Common.showToast("✅ 已上传 " + newImages.length + " 张图片", "success");
          
          // 关闭当前弹窗并重新打开以刷新显示
          var modalClose = document.querySelector('.modal-overlay');
          if (modalClose) modalClose.click();
          setTimeout(function() { viewEvidence(recordId); }, 300);
        }
      };
      reader.readAsDataURL(input.files[i]);
    }
  }
  
  // 查看监控点详情
  function viewMonitorDetail() {
    // 切换到监控点标签
    var monitorsTab = document.querySelector('.tab[data-tab="monitors"]');
    if (monitorsTab) {
      monitorsTab.click();
    }
    Common.showToast("已切换到监控点列表", "info");
  }

  // ========== 处理记录 ==========
  function processRecord(recordId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var record = recordsCache.find(function(r) { return r.record_id === recordId; });
    if (!record) {
      Common.showToast("记录不存在", "error");
      return;
    }
    
    var content = 
      '<form id="processForm">' +
        '<div class="field" style="margin-bottom:16px;">' +
          '<label class="field-label">处理状态</label>' +
          '<select class="field-select" name="handle_status">' +
            '<option value="未处理"' + (record.handle_status === "未处理" ? " selected" : "") + '>未处理</option>' +
            '<option value="处理中"' + (record.handle_status === "处理中" ? " selected" : "") + '>处理中</option>' +
            '<option value="已结案"' + (record.handle_status === "已结案" ? " selected" : "") + '>已结案</option>' +
          '</select>' +
        '</div>' +
        '<div class="field" style="margin-bottom:16px;">' +
          '<label class="field-label">处理结果</label>' +
          '<textarea class="field-input" name="handle_result" rows="3" placeholder="描述处理结果...">' + (record.handle_result || '') + '</textarea>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">处罚依据</label>' +
          '<textarea class="field-input" name="punishment_basis" rows="2" placeholder="法律法规依据...">' + (record.punishment_basis || '') + '</textarea>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "处理非法行为记录 - " + recordId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("processForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("PUT", "/api/enforcement/records/" + recordId, {
            handle_status: formData.get("handle_status"),
            handle_result: formData.get("handle_result"),
            punishment_basis: formData.get("punishment_basis")
          });
          Common.showToast("更新成功", "success");
          close();
          loadRecords();
          loadStats();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 调度执法人员 ==========
  function dispatchRecord(recordId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认调度",
      content: '<p style="text-align:center;padding:20px;">是否为记录 <strong>' + recordId + '</strong> 调度就近执法人员？</p>',
      confirmText: "确认调度",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("GET", "/api/enforcement/dispatch/create-by-procedure/" + recordId);
          Common.showToast("调度成功", "success");
          close();
          loadDispatch();
          loadRecords();
          loadStats();
        } catch (e) {
          Common.showToast("调度失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 更新调度状态 ==========
  function updateDispatchStatus(dispatchId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var dispatch = dispatchCache.find(function(d) { return d.dispatch_id === dispatchId; });
    
    var content = 
      '<form id="dispatchStatusForm">' +
        '<div class="field">' +
          '<label class="field-label">调度状态</label>' +
          '<select class="field-select" name="dispatch_status">' +
            '<option value="待响应"' + (dispatch && dispatch.dispatch_status === "待响应" ? " selected" : "") + '>待响应</option>' +
            '<option value="已派单"' + (dispatch && dispatch.dispatch_status === "已派单" ? " selected" : "") + '>已派单</option>' +
            '<option value="已响应"' + (dispatch && dispatch.dispatch_status === "已响应" ? " selected" : "") + '>已响应</option>' +
            '<option value="已完成"' + (dispatch && dispatch.dispatch_status === "已完成" ? " selected" : "") + '>已完成</option>' +
          '</select>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "更新调度状态 - " + dispatchId,
      content: content,
      confirmText: "更新",
      onConfirm: async function(close) {
        var status = document.querySelector('#dispatchStatusForm select[name="dispatch_status"]').value;
        
        try {
          await Api.requestJson("PUT", "/api/enforcement/dispatch/" + dispatchId + "/status", {
            dispatch_status: status
          });
          Common.showToast("更新成功", "success");
          close();
          loadDispatch();
          loadStats();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 编辑功能 ==========
  function editStaff(staffId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var staff = staffCache.find(function(s) { return s.law_enforcement_id === staffId; });
    if (!staff) {
      Common.showToast("人员不存在", "error");
      return;
    }
    
    var content = 
      '<form id="editStaffForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">执法ID</label><input class="field-input" value="' + staffId + '" disabled /></div>' +
          '<div class="field"><label class="field-label">姓名</label><input class="field-input" name="staff_name" value="' + (staff.staff_name || '') + '" required /></div>' +
          '<div class="field"><label class="field-label">部门</label><input class="field-input" name="department" value="' + (staff.department || '') + '" required /></div>' +
          '<div class="field"><label class="field-label">执法权限</label><input class="field-input" name="permission" value="' + (staff.permission || '') + '" /></div>' +
          '<div class="field"><label class="field-label">联系方式</label><input class="field-input" name="contact" value="' + (staff.contact || '') + '" required /></div>' +
          '<div class="field"><label class="field-label">设备编号</label><input class="field-input" name="equipment_number" value="' + (staff.equipment_number || '') + '" /></div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑执法人员 - " + staffId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editStaffForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("PUT", "/api/enforcement/staff/" + staffId, {
            staff_name: formData.get("staff_name"),
            department: formData.get("department"),
            permission: formData.get("permission"),
            contact: formData.get("contact"),
            equipment_number: formData.get("equipment_number")
          });
          Common.showToast("更新成功", "success");
          close();
          loadStaff();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function editMonitor(monitorId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var monitor = monitorsCache.find(function(m) { return m.monitor_point_id === monitorId; });
    if (!monitor) {
      Common.showToast("监控点不存在", "error");
      return;
    }
    
    var content = 
      '<form id="editMonitorForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">监控点编号</label><input class="field-input" value="' + monitorId + '" disabled /></div>' +
          '<div class="field"><label class="field-label">部署区域</label><input class="field-input" name="area_number" value="' + (monitor.area_number || '') + '" required /></div>' +
          '<div class="field"><label class="field-label">监控范围</label><input class="field-input" name="monitor_range" value="' + (monitor.monitor_range || '') + '" /></div>' +
          '<div class="field"><label class="field-label">设备状态</label>' +
            '<select class="field-select" name="device_status">' +
              '<option value="正常"' + (monitor.device_status === "正常" ? " selected" : "") + '>正常</option>' +
              '<option value="故障"' + (monitor.device_status === "故障" ? " selected" : "") + '>故障</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">存储周期(天)</label><input class="field-input" name="data_storage_cycle" type="number" value="' + (monitor.data_storage_cycle || 90) + '" /></div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑监控点 - " + monitorId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editMonitorForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("PUT", "/api/enforcement/monitor/" + monitorId, {
            area_number: formData.get("area_number"),
            monitor_range: formData.get("monitor_range"),
            device_status: formData.get("device_status"),
            data_storage_cycle: parseInt(formData.get("data_storage_cycle")) || 90
          });
          Common.showToast("更新成功", "success");
          close();
          loadMonitors();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 删除功能 ==========
  function deleteStaff(staffId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除执法人员 <strong>' + staffId + '</strong> 吗？</p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/enforcement/staff/" + staffId);
          Common.showToast("删除成功", "success");
          close();
          loadStaff();
          loadStats();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function deleteMonitor(monitorId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除监控点 <strong>' + monitorId + '</strong> 吗？</p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/enforcement/monitor/" + monitorId);
          Common.showToast("删除成功", "success");
          close();
          loadMonitors();
          loadStats();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function deleteRecord(recordId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除记录 <strong>' + recordId + '</strong> 吗？</p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/enforcement/records/" + recordId);
          Common.showToast("删除成功", "success");
          close();
          loadRecords();
          loadStats();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function deleteDispatch(dispatchId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除调度记录 <strong>' + dispatchId + '</strong> 吗？</p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/enforcement/dispatch/" + dispatchId);
          Common.showToast("删除成功", "success");
          close();
          loadDispatch();
          loadStats();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  window.EnforcementPage = { 
    init: init,
    filterRecords: filterRecords,
    resetFilter: resetFilter,
    simulateAlert: simulateAlert,
    handleAlert: handleAlert,
    editStaff: editStaff,
    editMonitor: editMonitor,
    deleteStaff: deleteStaff,
    deleteMonitor: deleteMonitor,
    deleteRecord: deleteRecord,
    deleteDispatch: deleteDispatch,
    processRecord: processRecord,
    dispatchRecord: dispatchRecord,
    updateDispatchStatus: updateDispatchStatus,
    onMonitorSelect: onMonitorSelect,
    previewImages: previewImages,
    viewEvidence: viewEvidence,
    viewMonitorDetail: viewMonitorDetail,
    uploadEvidenceForRecord: uploadEvidenceForRecord
  };
})();

