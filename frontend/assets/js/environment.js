(function () {
  "use strict";

  var profile = null;
  var currentTab = "indices";
  var indicesCache = [];
  var devicesCache = [];
  var dataCache = [];
  
  // 实时图表
  var airQualityChart = null;
  var waterQualityChart = null;
  var airDataHistory = [];
  var waterDataHistory = [];
  var chartTimeLabels = [];
  
  // 模拟控制
  var simulationInterval = null;
  var simulationEnabled = false;

  function init(userProfile) {
    profile = userProfile;
    initTabs();
    initCharts();
    loadStats();
    loadIndices();
    
    var createBtn = document.getElementById("createBtn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreateModal);
    }
    
    // 启动自动刷新
    startAutoRefresh();
  }

  function isManager() {
    // 环境监测、执法监管、科研数据、生物多样性统一由公园管理人员管理
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
        
        if (tabName === "indices") loadIndices();
        else if (tabName === "devices") loadDevices();
        else if (tabName === "data") loadData();
        else if (tabName === "calibration") loadCalibration();
        else if (tabName === "alerts") loadAlerts();
      });
    });
  }

  // ========== 实时图表 ==========
  function initCharts() {
    // 初始化时间标签和初始数据
    var now = new Date();
    chartTimeLabels = [];
    airDataHistory = [];
    waterDataHistory = [];
    
    for (var i = 11; i >= 0; i--) {
      var t = new Date(now.getTime() - i * 5000);
      chartTimeLabels.push(t.toLocaleTimeString("zh-CN", {hour: "2-digit", minute: "2-digit", second: "2-digit"}));
      // 使用初始模拟数据而不是null
      airDataHistory.push(35 + Math.random() * 20);
      waterDataHistory.push(6.5 + Math.random() * 1.5);
    }
    
    // 空气质量图表
    var airCtx = document.getElementById("airQualityChart");
    if (airCtx && !airQualityChart) {
      airQualityChart = new Chart(airCtx, {
        type: 'line',
        data: {
          labels: chartTimeLabels,
          datasets: [
            { label: 'PM2.5 (μg/m³)', data: airDataHistory, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.3, pointRadius: 3 },
            { label: '阈值上限(75)', data: chartTimeLabels.map(function() { return 75; }), borderColor: '#dc2626', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: { 
            title: { display: true, text: '🌬️ 空气质量监测 (PM2.5)', font: { size: 14 } },
            legend: { display: true, position: 'top' }
          },
          scales: { 
            y: { beginAtZero: true, max: 120, title: { display: true, text: 'μg/m³' } },
            x: { title: { display: true, text: '时间' } }
          }
        }
      });
    }
    
    // 水质图表
    var waterCtx = document.getElementById("waterQualityChart");
    if (waterCtx && !waterQualityChart) {
      waterQualityChart = new Chart(waterCtx, {
        type: 'line',
        data: {
          labels: chartTimeLabels,
          datasets: [
            { label: 'pH值', data: waterDataHistory, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3, pointRadius: 3 },
            { label: '正常范围(7)', data: chartTimeLabels.map(function() { return 7; }), borderColor: '#f59e0b', borderDash: [5,5], borderWidth: 2, pointRadius: 0, fill: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: { 
            title: { display: true, text: '💧 水质监测 (pH值)', font: { size: 14 } },
            legend: { display: true, position: 'top' }
          },
          scales: { 
            y: { min: 5, max: 10, title: { display: true, text: 'pH' } },
            x: { title: { display: true, text: '时间' } }
          }
        }
      });
    }
  }

  function updateCharts(airValue, waterValue, airThreshold) {
    var now = new Date();
    chartTimeLabels.push(now.toLocaleTimeString("zh-CN", {hour: "2-digit", minute: "2-digit", second: "2-digit"}));
    airDataHistory.push(airValue);
    waterDataHistory.push(waterValue);
    
    if (chartTimeLabels.length > 12) {
      chartTimeLabels.shift();
      airDataHistory.shift();
      waterDataHistory.shift();
    }
    
    if (airQualityChart) {
      airQualityChart.data.labels = chartTimeLabels;
      airQualityChart.data.datasets[0].data = airDataHistory;
      airQualityChart.data.datasets[1].data = chartTimeLabels.map(function() { return airThreshold || 75; });
      
      // 超阈值变红
      if (airValue > (airThreshold || 75)) {
        airQualityChart.data.datasets[0].borderColor = '#dc2626';
        airQualityChart.data.datasets[0].backgroundColor = 'rgba(220,38,38,0.1)';
      } else {
        airQualityChart.data.datasets[0].borderColor = '#16a34a';
        airQualityChart.data.datasets[0].backgroundColor = 'rgba(22,163,74,0.1)';
      }
      airQualityChart.update('none');
    }
    
    if (waterQualityChart) {
      waterQualityChart.data.labels = chartTimeLabels;
      waterQualityChart.data.datasets[0].data = waterDataHistory;
      waterQualityChart.data.datasets[1].data = chartTimeLabels.map(function() { return 7; }); // 中性pH
      waterQualityChart.update('none');
    }
  }

  // ========== 模拟数据采集 ==========
  function toggleSimulation() {
    if (simulationEnabled) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }

  function startSimulation() {
    if (simulationInterval) return;
    simulationEnabled = true;
    
    var btn = document.getElementById("toggleSimulationBtn");
    if (btn) {
      btn.innerHTML = "⏹️ 停止模拟";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-danger");
    }
    
    Common.showToast("🔴 实时数据采集模拟已开启", "info");
    
    // 立即执行一次
    simulateDataCollection();
    
    // 每5秒执行一次
    simulationInterval = setInterval(simulateDataCollection, 5000);
  }

  function stopSimulation() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    simulationEnabled = false;
    
    var btn = document.getElementById("toggleSimulationBtn");
    if (btn) {
      btn.innerHTML = "▶️ 开启模拟";
      btn.classList.remove("btn-danger");
      btn.classList.add("btn-primary");
    }
    
    Common.showToast("⏹️ 数据采集模拟已停止", "info");
  }

  async function simulateDataCollection() {
    // 模拟空气质量数据 (PM2.5: 正常0-75, 轻度75-115, 中度115-150)
    var airValue = 30 + Math.random() * 60; // 30-90
    var isAirAbnormal = airValue > 75;
    
    // 模拟水质数据 (pH: 正常6.5-8.5)
    var waterValue = 6 + Math.random() * 3; // 6-9
    var isWaterAbnormal = waterValue < 6.5 || waterValue > 8.5;
    
    // 更新图表
    updateCharts(airValue.toFixed(1), waterValue.toFixed(2), 75);
    
    // 检查异常并显示预警
    checkAbnormalAlert(isAirAbnormal, isWaterAbnormal, airValue, waterValue);
    
    // 尝试上报数据到后端
    try {
      // 上报空气质量数据
      await Api.requestJson("POST", "/api/environment/environment-data", {
        index_id: "AIR_PM25",
        device_id: 4, // 空气质量传感器
        monitor_value: parseFloat(airValue.toFixed(1)),
        area_id: 1,
        data_quality: isAirAbnormal ? "差" : "优",
        is_abnormal: isAirAbnormal
      });
    } catch (e) {
      console.log("Air data upload:", e.message);
    }
    
    try {
      // 上报水质数据
      await Api.requestJson("POST", "/api/environment/environment-data", {
        index_id: "WATER_PH",
        device_id: 5, // 水质监测仪
        monitor_value: parseFloat(waterValue.toFixed(2)),
        area_id: 2,
        data_quality: isWaterAbnormal ? "中" : "优",
        is_abnormal: isWaterAbnormal
      });
    } catch (e) {
      console.log("Water data upload:", e.message);
    }
    
    // 刷新统计
    loadStats();
  }

  function checkAbnormalAlert(isAirAbnormal, isWaterAbnormal, airValue, waterValue) {
    var banner = document.getElementById("alertBanner");
    var text = document.getElementById("alertText");
    if (!banner) return;
    
    if (isAirAbnormal || isWaterAbnormal) {
      banner.style.display = "block";
      var msgs = [];
      if (isAirAbnormal) msgs.push("PM2.5=" + airValue.toFixed(1) + "μg/m³ 超标");
      if (isWaterAbnormal) msgs.push("pH=" + waterValue.toFixed(2) + " 异常");
      text.innerHTML = msgs.join("；") + " <button class='btn btn-sm btn-danger' style='margin-left:8px;' onclick='EnvironmentPage.handleAlert()'>处理预警</button>";
      
      if (isAirAbnormal) {
        Common.showToast("🚨 空气质量预警：PM2.5=" + airValue.toFixed(1), "error");
      }
    } else {
      banner.style.display = "none";
    }
  }

  function handleAlert() {
    Common.showToast("✅ 预警已处理，已通知相关人员", "success");
    document.getElementById("alertBanner").style.display = "none";
  }

  // ========== 设备故障提醒 ==========
  function showDeviceFaultAlert(faultDevices, offlineDevices) {
    var banner = document.getElementById("alertBanner");
    var alertText = document.getElementById("alertText");
    
    var messages = [];
    if (faultDevices.length > 0) {
      var faultIds = faultDevices.map(function(d) { return "#" + (d.id || d.device_id); }).join(", ");
      messages.push("🔴 " + faultDevices.length + " 台设备故障 (" + faultIds + ")");
    }
    if (offlineDevices.length > 0) {
      var offlineIds = offlineDevices.map(function(d) { return "#" + (d.id || d.device_id); }).join(", ");
      messages.push("⚪ " + offlineDevices.length + " 台设备离线 (" + offlineIds + ")");
    }
    
    if (messages.length > 0) {
      alertText.innerHTML = messages.join(" | ") + 
        ' <button class="btn btn-sm btn-danger" onclick="EnvironmentPage.showFaultDetails()" style="margin-left:12px;">查看详情</button>';
      banner.style.display = "block";
      banner.style.background = "linear-gradient(90deg, #fee2e2, #fecaca)";
      
      // 同时弹出Toast提醒
      Common.showToast("⚠️ 设备异常：" + faultDevices.length + " 台故障, " + offlineDevices.length + " 台离线", "error");
    }
  }

  function showFaultDetails() {
    var faultDevices = devicesCache.filter(function(d) { return d.status === "故障"; });
    var offlineDevices = devicesCache.filter(function(d) { return d.status === "离线"; });
    
    var content = '<div style="max-height:400px;overflow-y:auto;">';
    
    if (faultDevices.length > 0) {
      content += '<h4 style="color:#dc2626;margin-bottom:12px;">🔴 故障设备 (' + faultDevices.length + ' 台)</h4>';
      content += '<table class="data-table" style="margin-bottom:20px;"><thead><tr><th>设备ID</th><th>类型</th><th>区域</th><th>操作</th></tr></thead><tbody>';
      faultDevices.forEach(function(d) {
        var areaName = d.deployment_area_id === 1 ? "核心保护区" : (d.deployment_area_id === 2 ? "缓冲区" : (d.deployment_area_id === 3 ? "实验区" : "-"));
        content += '<tr style="background:#fef2f2;">' +
          '<td>#' + (d.id || d.device_id) + '</td>' +
          '<td>' + (d.type || d.device_type || '-') + '</td>' +
          '<td>' + areaName + '</td>' +
          '<td><button class="btn btn-sm btn-primary" onclick="EnvironmentPage.updateDeviceStatus(' + (d.id || d.device_id) + ')">修复</button></td>' +
          '</tr>';
      });
      content += '</tbody></table>';
    }
    
    if (offlineDevices.length > 0) {
      content += '<h4 style="color:#6b7280;margin-bottom:12px;">⚪ 离线设备 (' + offlineDevices.length + ' 台)</h4>';
      content += '<table class="data-table"><thead><tr><th>设备ID</th><th>类型</th><th>区域</th><th>操作</th></tr></thead><tbody>';
      offlineDevices.forEach(function(d) {
        var areaName = d.deployment_area_id === 1 ? "核心保护区" : (d.deployment_area_id === 2 ? "缓冲区" : (d.deployment_area_id === 3 ? "实验区" : "-"));
        content += '<tr>' +
          '<td>#' + (d.id || d.device_id) + '</td>' +
          '<td>' + (d.type || d.device_type || '-') + '</td>' +
          '<td>' + areaName + '</td>' +
          '<td><button class="btn btn-sm btn-secondary" onclick="EnvironmentPage.updateDeviceStatus(' + (d.id || d.device_id) + ')">重连</button></td>' +
          '</tr>';
      });
      content += '</tbody></table>';
    }
    
    content += '</div>';
    
    Common.showModal({
      title: "⚠️ 设备异常详情",
      content: content,
      confirmText: "关闭",
      onConfirm: function(close) { close(); }
    });
  }

  // ========== 自动刷新 ==========
  var autoRefreshInterval = null;
  
  function startAutoRefresh() {
    if (autoRefreshInterval) return;
    autoRefreshInterval = setInterval(function() {
      loadStats();
      // 每小时检查设备状态
      checkDeviceStatus();
    }, 30000);
  }

  async function checkDeviceStatus() {
    try {
      var devices = await Api.requestJson("GET", "/api/environment/monitor-devices/need-calibration");
      if (devices && devices.length > 0) {
        Common.showToast("🔧 有 " + devices.length + " 台设备需要校准", "warning");
      }
    } catch (e) {
      console.log("Check calibration error:", e);
    }
  }

  // ========== 统计加载 ==========
  async function loadStats() {
    try {
      var indices = await Api.requestJson("GET", "/api/environment/monitor-indices");
      indicesCache = indices || [];
      document.getElementById("statIndices").textContent = indices.length || 0;
      
      // 更新指标筛选下拉框
      var select = document.getElementById("dataFilterIndex");
      if (select && indices.length > 0) {
        select.innerHTML = '<option value="">全部指标</option>';
        indices.forEach(function(idx) {
          select.innerHTML += '<option value="' + idx.index_id + '">' + idx.index_name + '</option>';
        });
      }
    } catch (e) {
      document.getElementById("statIndices").textContent = "--";
    }
    
    try {
      // 获取所有设备
      var allDevices = await Api.requestJson("GET", "/api/environment/monitor-devices");
      devicesCache = allDevices || [];
      var onlineCount = devicesCache.filter(function(d) { return d.status === "正常"; }).length;
      document.getElementById("statDevices").textContent = onlineCount + "/" + devicesCache.length;
      
      // 检查故障设备并触发提醒
      var faultDevices = devicesCache.filter(function(d) { return d.status === "故障"; });
      var offlineDevices = devicesCache.filter(function(d) { return d.status === "离线"; });
      
      if (faultDevices.length > 0 || offlineDevices.length > 0) {
        showDeviceFaultAlert(faultDevices, offlineDevices);
      }
    } catch (e) {
      console.log("Load devices error:", e);
      document.getElementById("statDevices").textContent = "--";
    }
    
    try {
      var needCalibration = await Api.requestJson("GET", "/api/environment/monitor-devices/need-calibration");
      document.getElementById("statCalibration").textContent = (needCalibration && needCalibration.length) || 0;
    } catch (e) {
      console.log("Load calibration error:", e);
      document.getElementById("statCalibration").textContent = "0";
    }
    
    // 统计异常数据（从缓存中计算）
    var abnormalCount = dataCache.filter(function(d) { return d.is_abnormal; }).length;
    document.getElementById("statAbnormal").textContent = abnormalCount || 0;
  }

  // ========== 监测指标 ==========
  async function loadIndices() {
    var container = document.getElementById("indicesTable");
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/environment/monitor-indices");
      indicesCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice">暂无监测指标数据</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>指标编号</th><th>名称</th><th>单位</th><th>阈值下限</th><th>阈值上限</th><th>监测频率</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        html += '<tr>' +
          '<td>' + (item.index_id || '-') + '</td>' +
          '<td><strong>' + (item.index_name || '-') + '</strong></td>' +
          '<td>' + (item.unit || '-') + '</td>' +
          '<td>' + (item.lower_threshold || item.normal_range_min || '-') + '</td>' +
          '<td>' + (item.upper_threshold || item.normal_range_max || '-') + '</td>' +
          '<td>' + (item.monitor_frequency || '-') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="EnvironmentPage.editIndex(\'' + item.index_id + '\')">编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="EnvironmentPage.deleteIndex(\'' + item.index_id + '\')">删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 监测设备 ==========
  async function loadDevices() {
    var container = document.getElementById("devicesTable");
    Common.setContentLoading(container);
    
    try {
      // 获取所有设备
      var allDevices = await Api.requestJson("GET", "/api/environment/monitor-devices");
      devicesCache = allDevices || [];
      
      if (allDevices.length === 0) {
        container.innerHTML = '<div class="notice">暂无监测设备数据</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>设备ID</th><th>设备类型</th><th>部署区域</th><th>安装时间</th><th>校准周期</th><th>状态</th><th>通信协议</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      allDevices.forEach(function(item) {
        var statusCls = item.status === "正常" ? "tag-success" : (item.status === "故障" ? "tag-danger" : "tag-warning");
        var areaName = item.deployment_area_id === 1 ? "核心保护区" : (item.deployment_area_id === 2 ? "缓冲区" : (item.deployment_area_id === 3 ? "实验区" : (item.deployment_area_id || '-')));
        html += '<tr>' +
          '<td>' + (item.id || item.device_id || '-') + '</td>' +
          '<td>' + (item.type || item.device_type || '-') + '</td>' +
          '<td>' + areaName + '</td>' +
          '<td>' + (item.install_time ? item.install_time.split('T')[0] : '-') + '</td>' +
          '<td>' + (item.calibration_cycle || 30) + '天</td>' +
          '<td><span class="tag ' + statusCls + '">' + (item.status || '未知') + '</span></td>' +
          '<td>' + (item.communication_protocol || '-') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="EnvironmentPage.updateDeviceStatus(' + (item.id || item.device_id) + ')">状态</button> ' +
            '<button class="btn btn-sm btn-primary" onclick="EnvironmentPage.calibrateDevice(' + (item.id || item.device_id) + ')">校准</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="EnvironmentPage.deleteDevice(' + (item.id || item.device_id) + ')">删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  function updateDeviceStatus(deviceId) {
    var content = 
      '<form id="statusForm">' +
        '<div class="field">' +
          '<label class="field-label">设备状态</label>' +
          '<select class="field-select" name="status">' +
            '<option value="正常">正常</option>' +
            '<option value="故障">故障</option>' +
            '<option value="离线">离线</option>' +
          '</select>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "更新设备状态 #" + deviceId,
      content: content,
      confirmText: "更新",
      onConfirm: async function(close) {
        var status = document.querySelector('#statusForm select[name="status"]').value;
        try {
          await Api.requestJson("PUT", "/api/environment/monitor-devices/" + deviceId + "/status?status_value=" + encodeURIComponent(status));
          Common.showToast("设备状态已更新", "success");
          close();
          loadDevices();
          loadStats();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function calibrateDevice(deviceId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var content = 
      '<form id="calibrateForm">' +
        '<div class="field">' +
          '<label class="field-label">校准结果</label>' +
          '<select class="field-select" name="result">' +
            '<option value="合格">合格</option>' +
            '<option value="不合格">不合格</option>' +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">校准说明</label>' +
          '<textarea class="field-input" name="desc" rows="3" placeholder="输入校准说明..."></textarea>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "设备校准 #" + deviceId,
      content: content,
      confirmText: "提交校准记录",
      onConfirm: async function(close) {
        var form = document.getElementById("calibrateForm");
        var result = form.querySelector('select[name="result"]').value;
        var desc = form.querySelector('textarea[name="desc"]').value;
        
        try {
          await Api.requestJson("POST", "/api/environment/calibration-records", {
            device_id: deviceId,
            calibration_time: new Date().toISOString(),
            calibrator_id: profile.user_id,
            calibration_result: result,
            calibration_desc: desc || null
          });
          Common.showToast("校准记录已提交", "success");
          close();
          loadDevices();
          loadCalibration();
          loadStats();
        } catch (e) {
          Common.showToast("提交失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 环境数据 ==========
  async function loadData() {
    var container = document.getElementById("dataTable");
    Common.setContentLoading(container);
    
    try {
      // 从多个设备获取数据
      var data = [];
      for (var devId = 1; devId <= 20; devId++) {
        try {
          var deviceData = await Api.requestJson("GET", "/api/environment/environment-data/device/" + devId);
          if (deviceData && deviceData.length) data = data.concat(deviceData);
        } catch (e) {}
      }
      dataCache = data;
      
      // 更新异常数据统计
      var abnormalCount = data.filter(function(d) { return d.is_abnormal; }).length;
      document.getElementById("statAbnormal").textContent = abnormalCount || 0;
      
      if (data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">📭 暂无环境监测数据<br><small style="color:#6b7280;">请点击"▶️ 开启模拟"按钮开始模拟数据采集</small></div>';
        return;
      }
      
      renderDataTable(data);
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 校准记录 ==========
  async function loadCalibration() {
    var container = document.getElementById("calibrationTable");
    Common.setContentLoading(container);
    
    try {
      // 获取各设备的校准记录
      var allRecords = [];
      for (var devId = 1; devId <= 10; devId++) {
        try {
          var records = await Api.requestJson("GET", "/api/environment/calibration-records/device/" + devId);
          if (records) allRecords = allRecords.concat(records);
        } catch (e) {}
      }
      
      if (allRecords.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">📋 暂无校准记录<br><small style="color:#6b7280;">在监测设备标签页点击"校准"按钮可添加校准记录</small></div>';
        return;
      }
      
      // 排序
      allRecords.sort(function(a, b) {
        return new Date(b.calibration_time) - new Date(a.calibration_time);
      });
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>记录ID</th><th>设备ID</th><th>校准时间</th><th>校准人员</th><th>校准结果</th><th>说明</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      allRecords.forEach(function(item) {
        var resultCls = item.calibration_result === "合格" ? "tag-success" : "tag-danger";
        var recordIdSafe = (item.record_id || '').replace(/'/g, "\\'");
        html += '<tr>' +
          '<td style="font-size:11px;">' + (item.record_id || '-').substring(0, 16) + '</td>' +
          '<td>' + (item.device_id || '-') + '</td>' +
          '<td>' + (item.calibration_time ? Common.formatDate(item.calibration_time) : '-') + '</td>' +
          '<td>' + (item.calibrator_id || '-') + '</td>' +
          '<td><span class="tag ' + resultCls + '">' + (item.calibration_result || '-') + '</span></td>' +
          '<td>' + (item.calibration_desc || '-') + '</td>' +
          '<td><button class="btn btn-sm btn-danger" onclick="EnvironmentPage.deleteCalibration(\'' + recordIdSafe + '\')">删除</button></td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 预警信息 ==========
  async function loadAlerts() {
    var container = document.getElementById("alertsTable");
    Common.setContentLoading(container);
    
    try {
      var alerts = [];
      
      // 1. 设备故障预警
      var faultDevices = devicesCache.filter(function(d) { return d.status === "故障"; });
      faultDevices.forEach(function(device) {
        alerts.push({
          type: "设备故障",
          level: "高",
          content: "设备 #" + (device.id || device.device_id) + " (" + (device.type || device.device_type) + ") 处于故障状态",
          time: new Date().toISOString(),
          source: "设备监控"
        });
      });
      
      // 2. 设备离线预警
      var offlineDevices = devicesCache.filter(function(d) { return d.status === "离线"; });
      offlineDevices.forEach(function(device) {
        alerts.push({
          type: "设备离线",
          level: "中",
          content: "设备 #" + (device.id || device.device_id) + " (" + (device.type || device.device_type) + ") 已离线",
          time: new Date().toISOString(),
          source: "设备监控"
        });
      });
      
      // 3. 设备待校准预警
      var now = new Date();
      devicesCache.forEach(function(device) {
        if (device.last_calibration_time) {
          var lastCal = new Date(device.last_calibration_time);
          var daysSince = Math.floor((now - lastCal) / (1000 * 60 * 60 * 24));
          var cycle = device.calibration_cycle || 30;
          if (daysSince >= cycle) {
            alerts.push({
              type: "校准过期",
              level: "中",
              content: "设备 #" + (device.id || device.device_id) + " 已超过校准周期 " + (daysSince - cycle) + " 天，请及时校准",
              time: new Date().toISOString(),
              source: "校准管理"
            });
          }
        } else {
          alerts.push({
            type: "未校准",
            level: "低",
            content: "设备 #" + (device.id || device.device_id) + " 从未进行过校准",
            time: new Date().toISOString(),
            source: "校准管理"
          });
        }
      });
      
      // 4. 环境数据异常预警
      var abnormalData = dataCache.filter(function(d) { return d.is_abnormal; });
      abnormalData.slice(0, 20).forEach(function(data) {
        var areaName = data.area_id === 1 ? "核心保护区" : (data.area_id === 2 ? "缓冲区" : (data.area_id === 3 ? "实验区" : "区域" + data.area_id));
        alerts.push({
          type: "数据异常",
          level: "高",
          content: areaName + " " + data.index_id + " 监测值 " + data.monitor_value + " 超出阈值范围",
          time: data.collect_time,
          source: "数据监测",
          reason: data.abnormal_reason || "超出标准阈值"
        });
      });
      
      // 按级别和时间排序
      var levelOrder = { "高": 0, "中": 1, "低": 2 };
      alerts.sort(function(a, b) {
        if (levelOrder[a.level] !== levelOrder[b.level]) {
          return levelOrder[a.level] - levelOrder[b.level];
        }
        return new Date(b.time) - new Date(a.time);
      });
      
      if (alerts.length === 0) {
        container.innerHTML = '<div class="notice notice-success" style="text-align:center;padding:40px;">✅ 当前无预警信息<br><small style="color:#6b7280;">所有设备运行正常，环境数据均在标准范围内</small></div>';
        return;
      }
      
      var html = '<div style="margin-bottom:12px;"><span style="font-weight:600;">共 ' + alerts.length + ' 条预警</span>' +
        ' <span class="tag tag-danger">高危 ' + alerts.filter(function(a){return a.level==="高";}).length + '</span>' +
        ' <span class="tag tag-warning">中危 ' + alerts.filter(function(a){return a.level==="中";}).length + '</span>' +
        ' <span class="tag tag-info">低危 ' + alerts.filter(function(a){return a.level==="低";}).length + '</span>' +
        '</div>';
      
      html += '<table class="data-table"><thead><tr>' +
        '<th>预警级别</th><th>预警类型</th><th>预警内容</th><th>来源</th><th>时间</th>' +
        '</tr></thead><tbody>';
      
      alerts.forEach(function(alert) {
        var levelCls = alert.level === "高" ? "tag-danger" : (alert.level === "中" ? "tag-warning" : "tag-info");
        var typeCls = alert.type === "设备故障" ? "tag-danger" : (alert.type === "数据异常" ? "tag-warning" : "tag-info");
        html += '<tr' + (alert.level === "高" ? ' style="background:#fef2f2;"' : '') + '>' +
          '<td><span class="tag ' + levelCls + '">' + alert.level + '</span></td>' +
          '<td><span class="tag ' + typeCls + '">' + alert.type + '</span></td>' +
          '<td>' + alert.content + '</td>' +
          '<td>' + alert.source + '</td>' +
          '<td style="font-size:11px;">' + (alert.time ? Common.formatDate(alert.time) : '-') + '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 新增弹窗 ==========
  function showCreateModal() {
    if (currentTab === "indices") {
      showCreateIndexModal();
    } else if (currentTab === "devices") {
      showCreateDeviceModal();
    } else {
      Common.showToast("请在监测指标或监测设备标签页新增", "info");
    }
  }

  function showCreateIndexModal() {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var content = 
      '<form id="createIndexForm">' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label">指标编号</label>' +
            '<input class="field-input" name="index_id" placeholder="如 AIR_PM25" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">指标名称</label>' +
            '<input class="field-input" name="index_name" placeholder="如 空气质量PM2.5" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">计量单位</label>' +
            '<input class="field-input" name="unit" placeholder="如 μg/m³" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">阈值下限</label>' +
            '<input class="field-input" name="lower" type="number" step="0.01" placeholder="0" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">阈值上限</label>' +
            '<input class="field-input" name="upper" type="number" step="0.01" placeholder="75" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">监测频率</label>' +
            '<select class="field-select" name="frequency">' +
              '<option value="小时">小时</option>' +
              '<option value="日">日</option>' +
              '<option value="周">周</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "新增监测指标",
      content: content,
      confirmText: "创建",
      onConfirm: async function(close) {
        var form = document.getElementById("createIndexForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/environment/monitor-indices", {
            index_id: formData.get("index_id"),
            index_name: formData.get("index_name"),
            unit: formData.get("unit"),
            lower_threshold: parseFloat(formData.get("lower")),
            upper_threshold: parseFloat(formData.get("upper")),
            monitor_frequency: formData.get("frequency")
          });
          Common.showToast("创建成功", "success");
          close();
          loadIndices();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function showCreateDeviceModal() {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    var content = 
      '<form id="createDeviceForm">' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label">设备类型</label>' +
            '<select class="field-select" name="type">' +
              '<option value="空气质量传感器">空气质量传感器</option>' +
              '<option value="水质监测仪">水质监测仪</option>' +
              '<option value="土壤湿度传感器">土壤湿度传感器</option>' +
              '<option value="气象站">气象站</option>' +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">部署区域</label>' +
            '<select class="field-select" name="area_id">' +
              '<option value="1">核心保护区</option>' +
              '<option value="2">缓冲区</option>' +
              '<option value="3">实验区</option>' +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">校准周期(天)</label>' +
            '<input class="field-input" name="calibration_cycle" type="number" value="30" />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">通信协议</label>' +
            '<select class="field-select" name="protocol">' +
              '<option value="4G">4G</option>' +
              '<option value="LORA">LORA</option>' +
              '<option value="WIFI">WIFI</option>' +
              '<option value="卫星">卫星</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "新增监测设备",
      content: content,
      confirmText: "创建",
      onConfirm: async function(close) {
        var form = document.getElementById("createDeviceForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/environment/monitor-devices", {
            type: formData.get("type"),
            deployment_area_id: parseInt(formData.get("area_id")),
            install_time: new Date().toISOString(),
            calibration_cycle: parseInt(formData.get("calibration_cycle")) || 30,
            communication_protocol: formData.get("protocol")
          });
          Common.showToast("设备创建成功", "success");
          close();
          loadDevices();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function editIndex(indexId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    // 从缓存中找到指标数据
    var index = indicesCache.find(function(i) { return i.index_id === indexId; });
    if (!index) {
      Common.showToast("找不到指标数据", "error");
      return;
    }
    
    var content = 
      '<form id="editIndexForm">' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label">指标编号</label>' +
            '<input class="field-input" value="' + indexId + '" disabled />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">指标名称</label>' +
            '<input class="field-input" name="index_name" value="' + (index.index_name || '') + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">单位</label>' +
            '<input class="field-input" name="unit" value="' + (index.unit || '') + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">阈值下限</label>' +
            '<input class="field-input" name="lower_threshold" type="number" step="0.01" value="' + (index.lower_threshold || 0) + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">阈值上限</label>' +
            '<input class="field-input" name="upper_threshold" type="number" step="0.01" value="' + (index.upper_threshold || 0) + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">监测频率</label>' +
            '<select class="field-select" name="monitor_frequency">' +
              '<option value="实时"' + (index.monitor_frequency === '实时' ? ' selected' : '') + '>实时</option>' +
              '<option value="1分钟"' + (index.monitor_frequency === '1分钟' ? ' selected' : '') + '>1分钟</option>' +
              '<option value="5分钟"' + (index.monitor_frequency === '5分钟' ? ' selected' : '') + '>5分钟</option>' +
              '<option value="15分钟"' + (index.monitor_frequency === '15分钟' ? ' selected' : '') + '>15分钟</option>' +
              '<option value="1小时"' + (index.monitor_frequency === '1小时' ? ' selected' : '') + '>1小时</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑监测指标 - " + indexId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editIndexForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("PATCH", "/api/environment/monitor-indices/" + indexId, {
            index_name: formData.get("index_name"),
            unit: formData.get("unit"),
            lower_threshold: parseFloat(formData.get("lower_threshold")),
            upper_threshold: parseFloat(formData.get("upper_threshold")),
            monitor_frequency: formData.get("monitor_frequency")
          });
          Common.showToast("指标更新成功", "success");
          close();
          loadIndices();
          loadStats();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 删除功能 ==========
  function deleteIndex(indexId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除监测指标 <strong>' + indexId + '</strong> 吗？<br><small style="color:#ef4444;">此操作不可恢复</small></p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/environment/monitor-indices/" + indexId);
          Common.showToast("删除成功", "success");
          close();
          loadIndices();
          loadStats();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function deleteDevice(deviceId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除设备 <strong>#' + deviceId + '</strong> 吗？<br><small style="color:#ef4444;">此操作不可恢复，相关数据也可能受影响</small></p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/environment/monitor-devices/" + deviceId);
          Common.showToast("删除成功", "success");
          close();
          loadDevices();
          loadStats();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function deleteData(dataId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除这条监测数据吗？<br><small style="color:#ef4444;">此操作不可恢复</small></p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/environment/environment-data/" + encodeURIComponent(dataId));
          Common.showToast("删除成功", "success");
          close();
          loadData();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function deleteCalibration(recordId) {
    if (!isManager()) {
      Common.showToast("需要公园管理人员权限", "error");
      return;
    }
    
    Common.showModal({
      title: "确认删除",
      content: '<p style="text-align:center;padding:20px;">确定要删除这条校准记录吗？<br><small style="color:#ef4444;">此操作不可恢复</small></p>',
      confirmText: "删除",
      onConfirm: async function(close) {
        try {
          await Api.requestJson("DELETE", "/api/environment/calibration-records/" + encodeURIComponent(recordId));
          Common.showToast("删除成功", "success");
          close();
          loadCalibration();
        } catch (e) {
          Common.showToast("删除失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 导出报告 ==========
  async function exportReport() {
    Common.showToast("正在生成环境监测报告...", "info");
    
    var today = new Date().toLocaleDateString("zh-CN");
    var report = "╔══════════════════════════════════════╗\n";
    report += "║     国家公园环境监测报告             ║\n";
    report += "╚══════════════════════════════════════╝\n\n";
    report += "📅 报告生成时间: " + new Date().toLocaleString("zh-CN") + "\n\n";
    
    report += "┌──────────────────────────────────────┐\n";
    report += "│           【监测指标概况】           │\n";
    report += "└──────────────────────────────────────┘\n";
    report += "  监测指标数量: " + indicesCache.length + " 项\n";
    indicesCache.forEach(function(idx) {
      report += "  • " + idx.index_name + " (" + idx.unit + ") 阈值: " + 
        (idx.lower_threshold || '-') + " ~ " + (idx.upper_threshold || '-') + "\n";
    });
    
    report += "\n┌──────────────────────────────────────┐\n";
    report += "│           【监测设备状态】           │\n";
    report += "└──────────────────────────────────────┘\n";
    var normalCount = devicesCache.filter(function(d) { return d.status === "正常"; }).length;
    var faultCount = devicesCache.filter(function(d) { return d.status === "故障"; }).length;
    report += "  设备总数: " + devicesCache.length + " 台\n";
    report += "  正常运行: " + normalCount + " 台\n";
    report += "  故障设备: " + faultCount + " 台\n";
    
    report += "\n┌──────────────────────────────────────┐\n";
    report += "│           【最近监测数据】           │\n";
    report += "└──────────────────────────────────────┘\n";
    if (dataCache.length > 0) {
      dataCache.slice(0, 10).forEach(function(d) {
        report += "  " + d.index_id + ": " + d.monitor_value + " [" + 
          (d.is_abnormal ? "异常" : "正常") + "] " + 
          Common.formatDate(d.collect_time) + "\n";
      });
    } else {
      report += "  (暂无数据)\n";
    }
    
    report += "\n╔══════════════════════════════════════╗\n";
    report += "║             报告结束                 ║\n";
    report += "╚══════════════════════════════════════╝\n";
    
    var blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "环境监测报告_" + today.replace(/\//g, "-") + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    Common.showToast("报告已生成并下载", "success");
  }

  // ========== 筛选功能 ==========
  function filterData() {
    var indexFilter = document.getElementById("dataFilterIndex").value;
    var areaFilter = document.getElementById("dataFilterArea").value;
    var abnormalFilter = document.getElementById("dataFilterAbnormal").value;
    
    var filtered = dataCache.filter(function(item) {
      if (indexFilter && item.index_id !== indexFilter) return false;
      if (areaFilter && String(item.area_id) !== areaFilter) return false;
      if (abnormalFilter !== "") {
        var isAbnormal = abnormalFilter === "1";
        if (item.is_abnormal !== (isAbnormal ? 1 : 0) && item.is_abnormal !== isAbnormal) return false;
      }
      return true;
    });
    
    renderDataTable(filtered);
    Common.showToast("筛选完成，共 " + filtered.length + " 条数据", "info");
  }

  function resetFilter() {
    document.getElementById("dataFilterIndex").value = "";
    document.getElementById("dataFilterArea").value = "";
    document.getElementById("dataFilterAbnormal").value = "";
    renderDataTable(dataCache);
    Common.showToast("已重置筛选条件", "info");
  }

  function renderDataTable(data) {
    var container = document.getElementById("dataTable");
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="notice">暂无符合条件的数据</div>';
      return;
    }
    
    data.sort(function(a, b) {
      return new Date(b.collect_time) - new Date(a.collect_time);
    });
    
    var html = '<table class="data-table"><thead><tr>' +
      '<th>数据ID</th><th>指标</th><th>设备</th><th>监测值</th><th>区域</th><th>质量</th><th>状态</th><th>采集时间</th><th>操作</th>' +
      '</tr></thead><tbody>';
    
    data.slice(0, 50).forEach(function(item) {
      var qualityCls = item.data_quality === "优" ? "tag-success" : 
                      (item.data_quality === "良" ? "tag-info" : 
                      (item.data_quality === "中" ? "tag-warning" : "tag-danger"));
      var abnormalCls = item.is_abnormal ? "tag-danger" : "tag-success";
      var areaName = item.area_id === 1 ? "核心保护区" : (item.area_id === 2 ? "缓冲区" : (item.area_id === 3 ? "实验区" : item.area_id));
      var dataIdSafe = (item.data_id || '').replace(/'/g, "\\'");
      
      html += '<tr' + (item.is_abnormal ? ' style="background:#fef2f2;"' : '') + '>' +
        '<td style="font-size:11px;color:#6b7280;">' + (item.data_id || '-').substring(0, 16) + '</td>' +
        '<td><strong>' + (item.index_id || '-') + '</strong></td>' +
        '<td>' + (item.device_id || '-') + '</td>' +
        '<td><strong style="color:#16a34a;">' + (item.monitor_value || '-') + '</strong></td>' +
        '<td>' + areaName + '</td>' +
        '<td><span class="tag ' + qualityCls + '">' + (item.data_quality || '-') + '</span></td>' +
        '<td><span class="tag ' + abnormalCls + '">' + (item.is_abnormal ? '⚠异常' : '✓正常') + '</span></td>' +
        '<td style="font-size:11px;">' + (item.collect_time ? Common.formatDate(item.collect_time) : '-') + '</td>' +
        '<td><button class="btn btn-sm btn-danger" onclick="EnvironmentPage.deleteData(\'' + dataIdSafe + '\')">删除</button></td>' +
        '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  window.EnvironmentPage = { 
    init: init,
    loadData: loadData,
    loadAlerts: loadAlerts,
    filterData: filterData,
    resetFilter: resetFilter,
    toggleSimulation: toggleSimulation,
    handleAlert: handleAlert,
    showFaultDetails: showFaultDetails,
    updateDeviceStatus: updateDeviceStatus,
    calibrateDevice: calibrateDevice,
    editIndex: editIndex,
    deleteIndex: deleteIndex,
    deleteDevice: deleteDevice,
    deleteData: deleteData,
    deleteCalibration: deleteCalibration,
    exportReport: exportReport
  };
})();

