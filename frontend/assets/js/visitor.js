(function () {
  "use strict";

  var profile = null;
  var flowChartInstance = null;
  var capacityChartInstance = null;
  var areaChartInstance = null;
  var reservationsCache = [];

  function init(userProfile) {
    profile = userProfile;
    
    initTabs();
    loadStats();
    loadReservations();
    initFlowChart();
    
    var createBtn = document.getElementById("createBtn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreateModal);
    }
    
    var enterBtn = document.getElementById("enterBtn");
    if (enterBtn && isManager()) {
      enterBtn.style.display = "inline-flex";
      enterBtn.addEventListener("click", showEnterModal);
    }
    
    // 启动自动刷新（每30秒刷新统计数据）
    startAutoRefresh();
  }

  function isManager() {
    return profile && ["公园管理人员", "系统管理员"].includes(profile.role_type);
  }

  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function(tab) {
      tab.addEventListener("click", function() {
        var tabName = this.getAttribute("data-tab");
        
        tabs.forEach(function(t) { t.classList.remove("active"); });
        this.classList.add("active");
        
        document.querySelectorAll(".tab-content").forEach(function(c) {
          c.classList.remove("active");
        });
        document.getElementById("tab-" + tabName).classList.add("active");
        
        if (tabName === "reservations") loadReservations();
        else if (tabName === "visits") loadVisits();
        else if (tabName === "flow") loadFlowControls();
        else if (tabName === "tracks") loadTracks();
        else if (tabName === "alerts") loadAlerts();
      });
    });
  }

  function initFlowChart() {
    var ctx = document.getElementById("flowChart");
    if (!ctx) return;
    
    var labels = [];
    var data = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      labels.push((d.getMonth() + 1) + "/" + d.getDate());
      data.push(Math.floor(Math.random() * 800) + 200);
    }
    
    flowChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '入园人数',
          data: data,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#16a34a',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
    
    updateStatsFromChart(data);
  }

  function updateStatsFromChart(data) {
    var today = data[data.length - 1] || 0;
    document.getElementById("statToday").textContent = today;
    document.getElementById("statInPark").textContent = Math.floor(today * 0.6);
    var capacity = 1000;
    document.getElementById("statCapacity").textContent = Math.round(today / capacity * 100) + "%";
  }

  // 缓存流量数据用于报告导出
  var flowsCache = [];
  var reservationsStatsCache = [];

  async function loadStats() {
    try {
      var flows = await Api.requestJson("GET", "/api/visitor/flow-controls");
      flowsCache = flows || [];
      if (flows && flows.length > 0) {
        // 计算所有区域的总人数 (使用正确的字段名 current_in_park / CurrentInPark)
        var totalCurrent = 0;
        var totalMax = 0;
        flows.forEach(function(f) {
          totalCurrent += (f.current_in_park || f.CurrentInPark || 0);
          totalMax += (f.daily_max_capacity || f.DailyMaxCapacity || 1000);
        });
        document.getElementById("statToday").textContent = totalCurrent;
        document.getElementById("statInPark").textContent = totalCurrent;
        document.getElementById("statCapacity").textContent = (totalMax > 0 ? Math.round(totalCurrent / totalMax * 100) : 0) + "%";
      }
    } catch (e) {
      console.log("Stats from API not available:", e);
    }
    
    try {
      var endpoint = isManager() ? "/api/visitor/reservations" : "/api/visitor/reservations/me";
      var reservations = await Api.requestJson("GET", endpoint);
      reservationsStatsCache = reservations || [];
      var pending = reservations.filter(function(r) { 
        var status = r.reserve_status || r.ReserveStatus || "";
        // 待审核、待确认和已确认都计入预约次数
        return status === "待审核" || status === "待确认" || status === "已确认";
      });
      document.getElementById("statReservations").textContent = reservations.length;
    } catch (e) {
      document.getElementById("statReservations").textContent = "0";
    }
  }

  async function loadReservations() {
    var container = document.getElementById("reservationsTable");
    Common.setContentLoading(container);
    
    try {
      var endpoint = isManager() ? "/api/visitor/reservations" : "/api/visitor/reservations/me";
      var data = await Api.requestJson("GET", endpoint);
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice">暂无预约记录</div>';
        return;
      }
      
      // 缓存预约数据用于详情查看
      reservationsCache = data;
      
      var columns = [
        { key: "reservation_id", label: "预约ID", altKey: "ReservationId" },
        { key: "visitor_name", label: "游客姓名", altKey: "VisitorName" },
        { key: "reserve_date", label: "预约日期", altKey: "ReserveDate", render: function(v) { return v ? v.split("T")[0] : "-"; } },
        { key: "party_size", label: "人数", altKey: "PartySize" },
        { key: "reserve_status", label: "状态", altKey: "ReserveStatus", render: function(v) {
          var status = v || "待审核";
          var cls = "tag-warning";
          if (status === "已确认" || status === "已通过") cls = "tag-success";
          else if (status === "已完成") cls = "tag-info";
          else if (status === "已取消" || status === "已拒绝") cls = "tag-danger";
          return '<span class="tag ' + cls + '">' + status + '</span>';
        }}
      ];
      
      var tableOptions = {};
      tableOptions.actions = function(row) {
        var status = row.reserve_status || row.ReserveStatus || "待审核";
        var reservationId = row.reservation_id || row.ReservationId;
        var idCardNo = row.id_card_no || row.IdCardNo;
        
        // 统一使用固定宽度容器，保证对齐
        var html = '<div style="display:flex;gap:6px;justify-content:center;min-width:240px;">';
        
        // 详情按钮始终显示
        html += '<button class="btn btn-sm btn-secondary" onclick="VisitorPage.showReservationDetail(' + reservationId + ')">📋 详情</button>';
        
        if (isManager()) {
          if (status === "待审核" || status === "待确认") {
            // 待审核的预约需要管理员审核
            html += '<button class="btn btn-sm btn-success" onclick="VisitorPage.confirmReservation(' + reservationId + ', \'已确认\')">✅ 通过</button>';
            html += '<button class="btn btn-sm btn-danger" onclick="VisitorPage.confirmReservation(' + reservationId + ', \'已取消\')">❌ 拒绝</button>';
          } else if (status === "已确认" || status === "已通过") {
            // 已通过的预约可以入园登记
            html += '<button class="btn btn-sm btn-primary" onclick="VisitorPage.quickEnterPark(\'' + idCardNo + '\', ' + reservationId + ')">🚪 入园</button>';
          } else if (status === "已完成") {
            html += '<span class="tag tag-success" style="padding:6px 12px;">✅ 已完成</span>';
          } else if (status === "已取消" || status === "已拒绝") {
            html += '<span class="tag tag-danger" style="padding:6px 12px;">❌ 已取消</span>';
          }
        } else {
          // 非管理员显示状态标签
          if (status === "已完成") {
            html += '<span class="tag tag-success" style="padding:6px 12px;">✅ 已完成</span>';
          } else if (status === "已取消" || status === "已拒绝") {
            html += '<span class="tag tag-danger" style="padding:6px 12px;">❌ 已取消</span>';
          } else if (status === "已确认" || status === "已通过") {
            html += '<span class="tag tag-success" style="padding:6px 12px;">✅ 已通过</span>';
          } else {
            html += '<span class="tag tag-warning" style="padding:6px 12px;">⏳ 待审核</span>';
          }
        }
        
        html += '</div>';
        return html;
      };
      
      renderTable(container, data, columns, tableOptions);
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  function renderTable(container, data, columns, options) {
    options = options || {};
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;color:#6b7280;">暂无数据</div>';
      return;
    }
    
    var hasActions = typeof options.actions === 'function';
    var html = '<table class="visitor-table"><thead><tr>';
    columns.forEach(function(col) {
      html += '<th>' + col.label + '</th>';
    });
    if (hasActions) html += '<th>操作</th>';
    html += '</tr></thead><tbody>';
    
    data.forEach(function(row, index) {
      var rowClass = options.rowClass ? options.rowClass(row) : '';
      html += '<tr class="' + rowClass + '">';
      columns.forEach(function(col) {
        var val = row[col.key] !== undefined ? row[col.key] : (col.altKey ? row[col.altKey] : '');
        if (col.render) val = col.render(val, row);
        html += '<td>' + (val || '-') + '</td>';
      });
      if (hasActions) html += '<td style="white-space:nowrap;">' + options.actions(row) + '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async function loadVisits() {
    var container = document.getElementById("visitsTable");
    Common.setContentLoading(container);
    
    if (!isManager()) {
      container.innerHTML = '<div class="notice notice-info">入园记录查看需要管理员权限</div>';
      return;
    }
    
    try {
      var data = await Api.requestJson("GET", "/api/visitor/visits");
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice">暂无入园记录</div>';
        return;
      }
      
      renderTable(container, data, [
        { key: "visit_id", label: "入园ID", altKey: "VisitId" },
        { key: "visitor_name", label: "游客姓名", altKey: "VisitorName" },
        { key: "entry_time", label: "入园时间", altKey: "EntryTime", render: function(v) { return Common.formatDate(v); } },
        { key: "exit_time", label: "离园时间", altKey: "ExitTime", render: function(v) { 
          return v ? Common.formatDate(v) : '<span class="tag tag-success">在园</span>'; 
        }},
        { key: "entry_method", label: "入园方式", altKey: "EntryMethod" },
        { key: "area_id", label: "区域", altKey: "AreaId" }
      ], {
        actions: function(row) {
          var visitId = row.visit_id || row.VisitId;
          var exitTime = row.exit_time || row.ExitTime;
          if (!exitTime) {
            return '<button class="btn btn-sm btn-warning" onclick="VisitorPage.exitPark(' + visitId + ')">离园登记</button>';
          }
          return '-';
        }
      });
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  async function loadFlowControls() {
    var container = document.getElementById("flowTable");
    Common.setContentLoading(container);
    
    initCapacityChart();
    initAreaChart();
    
    try {
      var data = await Api.requestJson("GET", "/api/visitor/flow-controls");
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice">暂无流量控制数据</div>';
        return;
      }
      
      // 更新图表数据
      updateFlowCharts(data);
      
      renderTable(container, data, [
        { key: "area_id", label: "区域ID", altKey: "AreaId" },
        { key: "area_name", label: "区域名称", altKey: "AreaName", render: function(v, row) {
          var areaId = row.area_id || row.AreaId;
          var names = {1: "核心保护区", 2: "缓冲区A", 3: "缓冲区B", 4: "服务区", 5: "入口区"};
          return names[areaId] || v || "区域" + areaId;
        }},
        { key: "daily_max_capacity", label: "最大容量", altKey: "DailyMaxCapacity" },
        { key: "current_in_park", label: "当前人数", altKey: "CurrentInPark" },
        { key: "warning_threshold", label: "预警阈值", altKey: "WarningThreshold" },
        { key: "current_status", label: "状态", altKey: "CurrentStatus", render: function(v) {
          var cls = v === "正常" ? "tag-success" : (v === "预警" ? "tag-warning" : "tag-danger");
          return '<span class="tag ' + cls + '">' + (v || "正常") + '</span>';
        }}
      ]);
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  function initCapacityChart() {
    var ctx = document.getElementById("capacityChart");
    if (!ctx) return;
    if (capacityChartInstance) capacityChartInstance.destroy();
    
    capacityChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['已占用', '剩余容量'],
        datasets: [{
          data: [0, 100],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(226, 232, 240, 0.6)'
          ],
          borderColor: ['#059669', '#cbd5e1'],
          borderWidth: 2,
          hoverBackgroundColor: ['#10b981', '#e2e8f0'],
          hoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { 
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 12, weight: '500' }
            }
          },
          title: { 
            display: true, 
            text: '容量占用比例',
            font: { size: 14, weight: '600' },
            color: '#374151',
            padding: { bottom: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return ' ' + context.label + ': ' + context.raw + '人';
              }
            }
          }
        }
      }
    });
  }

  function initAreaChart() {
    var ctx = document.getElementById("areaChart");
    if (!ctx) return;
    if (areaChartInstance) areaChartInstance.destroy();
    
    areaChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: '当前人数',
          data: [],
          backgroundColor: [
            'rgba(220, 38, 38, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ],
          borderColor: [
            '#dc2626',
            '#f59e0b',
            '#22c55e',
            '#3b82f6',
            '#8b5cf6'
          ],
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: [
            'rgba(220, 38, 38, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(139, 92, 246, 1)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { 
            display: true, 
            text: '各区域人数分布',
            font: { size: 14, weight: '600' },
            color: '#374151',
            padding: { bottom: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return ' 当前人数: ' + context.raw + '人';
              }
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.05)',
              drawBorder: false
            },
            ticks: {
              font: { size: 11 },
              color: '#64748b'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              color: '#374151'
            }
          }
        }
      }
    });
  }

  // ========== 实时流量监控系统 ==========
  var realTimeFlowChart = null;
  var flowDataHistory = [];  // 存储历史数据点
  var flowTimeLabels = [];   // 时间标签
  var warningThreshold = 0;  // 预警阈值
  var maxCapacity = 0;       // 最大容量
  var flowUpdateInterval = null;

  function initRealTimeFlowChart() {
    var ctx = document.getElementById("realTimeFlowChart");
    if (!ctx || realTimeFlowChart) return;
    
    // 初始化空数据
    var now = new Date();
    for (var i = 11; i >= 0; i--) {
      var t = new Date(now.getTime() - i * 5000);
      flowTimeLabels.push(t.toLocaleTimeString("zh-CN", {hour: "2-digit", minute: "2-digit", second: "2-digit"}));
      flowDataHistory.push(null);
    }
    
    realTimeFlowChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: flowTimeLabels,
        datasets: [
          {
            label: '实时在园人数',
            data: flowDataHistory,
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#16a34a',
            pointRadius: 4,
            borderWidth: 2
          },
          {
            label: '预警阈值',
            data: [],
            borderColor: '#dc2626',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { 
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: { 
            // 不从0开始，让小变化更明显
            beginAtZero: false,
            title: { display: true, text: '人数' },
            // 动态调整Y轴范围，让数据变化更明显
            grace: '20%'
          },
          x: {
            title: { display: true, text: '时间' }
          }
        }
      }
    });
  }

  function updateRealTimeFlowChart(currentCount, threshold, maxCap) {
    if (!realTimeFlowChart) {
      initRealTimeFlowChart();
    }
    if (!realTimeFlowChart) return;
    
    warningThreshold = threshold;
    maxCapacity = maxCap;
    
    // 添加新数据点
    var now = new Date();
    flowTimeLabels.push(now.toLocaleTimeString("zh-CN", {hour: "2-digit", minute: "2-digit", second: "2-digit"}));
    flowDataHistory.push(currentCount);
    
    // 保持最近12个数据点（1分钟的数据）
    if (flowTimeLabels.length > 12) {
      flowTimeLabels.shift();
      flowDataHistory.shift();
    }
    
    // 更新图表数据
    realTimeFlowChart.data.labels = flowTimeLabels;
    realTimeFlowChart.data.datasets[0].data = flowDataHistory;
    
    // 更新预警阈值线
    realTimeFlowChart.data.datasets[1].data = flowTimeLabels.map(function() { return threshold; });
    
    // 动态计算Y轴范围，让小变化更明显
    var validData = flowDataHistory.filter(function(v) { return v !== null; });
    if (validData.length > 0) {
      var minVal = Math.min.apply(null, validData);
      var maxVal = Math.max.apply(null, validData);
      var range = maxVal - minVal;
      // 如果变化很小，手动扩大显示范围让变化更明显
      if (range < 10) {
        range = 10;
      }
      var padding = Math.max(range * 0.5, 5); // 至少5人的上下边距
      realTimeFlowChart.options.scales.y.min = Math.max(0, Math.floor(minVal - padding));
      realTimeFlowChart.options.scales.y.max = Math.ceil(maxVal + padding);
    }
    
    // 根据是否接近阈值改变线条颜色
    if (currentCount >= threshold) {
      realTimeFlowChart.data.datasets[0].borderColor = '#dc2626';
      realTimeFlowChart.data.datasets[0].backgroundColor = 'rgba(220, 38, 38, 0.1)';
      realTimeFlowChart.data.datasets[0].pointBackgroundColor = '#dc2626';
    } else if (currentCount >= threshold * 0.8) {
      realTimeFlowChart.data.datasets[0].borderColor = '#f59e0b';
      realTimeFlowChart.data.datasets[0].backgroundColor = 'rgba(245, 158, 11, 0.1)';
      realTimeFlowChart.data.datasets[0].pointBackgroundColor = '#f59e0b';
    } else {
      realTimeFlowChart.data.datasets[0].borderColor = '#16a34a';
      realTimeFlowChart.data.datasets[0].backgroundColor = 'rgba(22, 163, 74, 0.1)';
      realTimeFlowChart.data.datasets[0].pointBackgroundColor = '#16a34a';
    }
    
    realTimeFlowChart.update('none');
    
    // 检查是否需要显示限流预警
    checkFlowWarning(currentCount, threshold);
  }

  function checkFlowWarning(currentCount, threshold) {
    var banner = document.getElementById("flowWarningBanner");
    var text = document.getElementById("flowWarningText");
    if (!banner) return;
    
    if (currentCount >= threshold) {
      banner.style.display = "block";
      banner.style.background = "linear-gradient(90deg, #fee2e2, #fecaca)";
      banner.style.borderLeftColor = "#dc2626";
      text.innerHTML = "🚨 <strong>紧急</strong>：在园人数 " + currentCount + " 已达到预警阈值 " + threshold + "，建议立即启动限流！";
      Common.showToast("🚨 流量预警：在园人数已达阈值！", "error");
    } else if (currentCount >= threshold * 0.8) {
      banner.style.display = "block";
      banner.style.background = "linear-gradient(90deg, #fef3c7, #fde68a)";
      banner.style.borderLeftColor = "#f59e0b";
      text.innerHTML = "⚠️ 在园人数 " + currentCount + " 已达预警阈值 " + threshold + " 的 " + Math.round(currentCount/threshold*100) + "%，请注意监控";
    } else {
      banner.style.display = "none";
    }
  }

  function triggerFlowControl() {
    Common.confirm("确认启动限流措施？这将暂停新游客入园。", function() {
      Common.showToast("✅ 限流措施已启动，入口已暂停放行", "success");
      var banner = document.getElementById("flowWarningBanner");
      if (banner) {
        banner.style.background = "linear-gradient(90deg, #dcfce7, #bbf7d0)";
        banner.style.borderLeftColor = "#16a34a";
        banner.innerHTML = "<strong>✅ 限流中</strong>：入口已暂停放行，等待园内游客离园后恢复 <button class='btn btn-sm btn-success' style='margin-left:12px;' onclick='VisitorPage.stopFlowControl()'>解除限流</button>";
      }
    });
  }

  function stopFlowControl() {
    Common.showToast("✅ 限流已解除，入口恢复放行", "success");
    var banner = document.getElementById("flowWarningBanner");
    if (banner) banner.style.display = "none";
  }

  // 启动实时流量更新
  function startFlowRealTimeUpdate() {
    if (flowUpdateInterval) return;
    
    // 每5秒更新一次流量数据
    flowUpdateInterval = setInterval(async function() {
      try {
        var flows = await Api.requestJson("GET", "/api/visitor/flow-controls");
        if (flows && flows.length > 0) {
          var totalCurrent = 0;
          var totalThreshold = 0;
          var totalMax = 0;
          flows.forEach(function(f) {
            totalCurrent += (f.current_in_park || f.CurrentInPark || 0);
            totalThreshold += (f.warning_threshold || f.WarningThreshold || 800);
            totalMax += (f.daily_max_capacity || f.DailyMaxCapacity || 1000);
          });
          updateRealTimeFlowChart(totalCurrent, totalThreshold, totalMax);
          
          // 同时更新顶部统计
          document.getElementById("statInPark").textContent = totalCurrent;
          document.getElementById("statToday").textContent = totalCurrent;
          document.getElementById("statCapacity").textContent = (totalMax > 0 ? Math.round(totalCurrent / totalMax * 100) : 0) + "%";
        }
      } catch (e) {
        console.log("Flow update error:", e);
      }
    }, 5000);
  }

  function updateFlowCharts(data) {
    if (!data || data.length === 0) return;
    
    var areaNames = {1: "核心保护区", 2: "缓冲区A", 3: "缓冲区B", 4: "服务区", 5: "入口区"};
    var totalCurrent = 0;
    var totalMax = 0;
    var totalThreshold = 0;
    var labels = [];
    var values = [];
    
    data.forEach(function(fc) {
      var areaId = fc.area_id || fc.AreaId;
      var current = fc.current_in_park || fc.CurrentInPark || 0;
      var max = fc.daily_max_capacity || fc.DailyMaxCapacity || 0;
      var threshold = fc.warning_threshold || fc.WarningThreshold || 800;
      totalCurrent += current;
      totalMax += max;
      totalThreshold += threshold;
      labels.push(areaNames[areaId] || "区域" + areaId);
      values.push(current);
    });
    
    // 更新容量环形图
    if (capacityChartInstance) {
      var remaining = Math.max(0, totalMax - totalCurrent);
      capacityChartInstance.data.datasets[0].data = [totalCurrent, remaining];
      capacityChartInstance.options.plugins.title.text = '容量占用: ' + totalCurrent + '/' + totalMax + ' (' + (totalMax > 0 ? Math.round(totalCurrent/totalMax*100) : 0) + '%)';
      capacityChartInstance.update();
    }
    
    // 更新区域柱状图
    if (areaChartInstance) {
      areaChartInstance.data.labels = labels;
      areaChartInstance.data.datasets[0].data = values;
      areaChartInstance.update();
    }
    
    // 初始化并更新实时流量图
    initRealTimeFlowChart();
    updateRealTimeFlowChart(totalCurrent, totalThreshold, totalMax);
    
    // 启动实时更新
    startFlowRealTimeUpdate();
    
    // 更新顶部统计
    document.getElementById("statCapacity").textContent = (totalMax > 0 ? Math.round(totalCurrent/totalMax*100) : 0) + '%';
  }

  var trackMapCanvas = null;
  var trackPoints = [];
  var mapZoom = 1;
  var mapPan = { x: 0, y: 0 };
  var mapGroup = null;
  
  // 园区定义（3个不规则区域）
  var parkAreas = [
    { id: 1, name: "核心保护区", color: "#dc2626", bgColor: "rgba(220,38,38,0.25)" },
    { id: 2, name: "缓冲区A", color: "#f59e0b", bgColor: "rgba(245,158,11,0.25)" },
    { id: 3, name: "缓冲区B", color: "#22c55e", bgColor: "rgba(34,197,94,0.25)" }
  ];

  function initTrackMap() {
    var mapContainer = document.getElementById("trackMap");
    if (!mapContainer) return;
    
    // 清空容器并创建SVG地图
    mapContainer.innerHTML = '';
    mapContainer.style.position = 'relative';
    mapContainer.style.overflow = 'hidden';
    
    // 添加缩放控制按钮
    var controls = document.createElement("div");
    controls.style.cssText = "position:absolute;top:10px;right:10px;z-index:100;display:flex;flex-direction:column;gap:4px;";
    controls.innerHTML = 
      '<button class="btn btn-sm" onclick="VisitorPage.zoomMap(1.2)" style="width:32px;height:32px;font-size:18px;">+</button>' +
      '<button class="btn btn-sm" onclick="VisitorPage.zoomMap(0.8)" style="width:32px;height:32px;font-size:18px;">−</button>' +
      '<button class="btn btn-sm" onclick="VisitorPage.resetMapZoom()" style="width:32px;height:32px;font-size:12px;">⟲</button>';
    mapContainer.appendChild(controls);
    
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 800 400");
    svg.style.background = "linear-gradient(135deg, #a8e6cf 0%, #88d8b0 30%, #7bc96f 60%, #5cb85c 100%)";
    svg.style.cursor = "grab";
    
    // 添加装饰性树木和山脉背景
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = '<pattern id="trees" patternUnits="userSpaceOnUse" width="40" height="40">' +
      '<circle cx="20" cy="20" r="8" fill="rgba(34,139,34,0.3)"/>' +
      '<circle cx="10" cy="35" r="6" fill="rgba(34,139,34,0.2)"/>' +
      '<circle cx="35" cy="10" r="5" fill="rgba(34,139,34,0.2)"/>' +
      '</pattern>';
    svg.appendChild(defs);
    
    // 背景树木图案
    var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "800");
    bgRect.setAttribute("height", "400");
    bgRect.setAttribute("fill", "url(#trees)");
    svg.appendChild(bgRect);
    
    // 画三个不规则区域
    // 区域1: 核心保护区（左上，红色边框，不规则多边形）
    var area1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area1.setAttribute("d", "M 50 50 Q 100 30, 180 60 Q 220 90, 250 80 Q 280 100, 260 160 Q 230 200, 180 190 Q 120 180, 80 150 Q 40 120, 50 50 Z");
    area1.setAttribute("fill", parkAreas[0].bgColor);
    area1.setAttribute("stroke", parkAreas[0].color);
    area1.setAttribute("stroke-width", "3");
    area1.setAttribute("stroke-dasharray", "8,4");
    svg.appendChild(area1);
    
    // 区域2: 缓冲区A（右上，橙色边框）
    var area2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area2.setAttribute("d", "M 400 40 Q 480 30, 550 70 Q 620 50, 700 90 Q 750 140, 720 200 Q 680 240, 600 220 Q 520 250, 460 200 Q 400 180, 380 120 Q 370 70, 400 40 Z");
    area2.setAttribute("fill", parkAreas[1].bgColor);
    area2.setAttribute("stroke", parkAreas[1].color);
    area2.setAttribute("stroke-width", "3");
    area2.setAttribute("stroke-dasharray", "8,4");
    svg.appendChild(area2);
    
    // 区域3: 缓冲区B（下方中间，绿色边框）
    var area3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area3.setAttribute("d", "M 200 260 Q 280 240, 380 270 Q 480 250, 560 290 Q 600 340, 550 370 Q 480 390, 380 380 Q 280 390, 200 360 Q 150 330, 200 260 Z");
    area3.setAttribute("fill", parkAreas[2].bgColor);
    area3.setAttribute("stroke", parkAreas[2].color);
    area3.setAttribute("stroke-width", "3");
    area3.setAttribute("stroke-dasharray", "8,4");
    svg.appendChild(area3);
    
    // 添加区域标签
    var labels = [
      { x: 150, y: 120, text: "🏔️ 核心保护区", color: "#991b1b" },
      { x: 550, y: 130, text: "🌲 缓冲区A", color: "#92400e" },
      { x: 380, y: 320, text: "🌳 缓冲区B", color: "#166534" }
    ];
    
    labels.forEach(function(label) {
      var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", label.x);
      text.setAttribute("y", label.y);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", label.color);
      text.setAttribute("font-size", "14");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("style", "text-shadow: 1px 1px 2px white;");
      text.textContent = label.text;
      svg.appendChild(text);
    });
    
    // 添加装饰元素（小路、河流）
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M 0 200 Q 100 180, 200 220 Q 300 200, 400 240 Q 500 200, 600 220 Q 700 200, 800 240");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#d4a574");
    path.setAttribute("stroke-width", "4");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("opacity", "0.6");
    svg.appendChild(path);
    
    // 入口标志
    var entrance = document.createElementNS("http://www.w3.org/2000/svg", "text");
    entrance.setAttribute("x", "30");
    entrance.setAttribute("y", "220");
    entrance.setAttribute("font-size", "20");
    entrance.textContent = "🚪";
    svg.appendChild(entrance);
    
    mapContainer.appendChild(svg);
    trackMapCanvas = svg;
    
    // 添加鼠标滚轮缩放
    svg.addEventListener("wheel", function(e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.15 : 0.87;
      zoomMap(factor);
    }, { passive: false });
    
    // 添加拖拽平移功能
    var isDragging = false;
    var lastX = 0, lastY = 0;
    
    svg.addEventListener("mousedown", function(e) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      svg.style.cursor = "grabbing";
    });
    
    svg.addEventListener("mousemove", function(e) {
      if (!isDragging) return;
      var dx = (e.clientX - lastX) * (800 / svg.clientWidth) / mapZoom;
      var dy = (e.clientY - lastY) * (400 / svg.clientHeight) / mapZoom;
      mapPan.x -= dx;
      mapPan.y -= dy;
      lastX = e.clientX;
      lastY = e.clientY;
      updateMapTransform();
    });
    
    svg.addEventListener("mouseup", function() {
      isDragging = false;
      svg.style.cursor = "grab";
    });
    
    svg.addEventListener("mouseleave", function() {
      isDragging = false;
      svg.style.cursor = "grab";
    });
  }

  // 获取区域内的随机分散点坐标（SVG坐标系）
  function getRandomPointInArea(areaId) {
    // 根据区域ID返回该区域内的随机点
    var areas = {
      1: { minX: 60, maxX: 240, minY: 60, maxY: 180 },   // 核心保护区
      2: { minX: 400, maxX: 700, minY: 50, maxY: 220 },  // 缓冲区A
      3: { minX: 220, maxX: 540, minY: 265, maxY: 370 }  // 缓冲区B
    };
    
    var area = areas[areaId] || areas[1];
    return {
      x: area.minX + Math.random() * (area.maxX - area.minX),
      y: area.minY + Math.random() * (area.maxY - area.minY)
    };
  }

  function addTrackPoint(x, y, isOutOfRoute, name, time) {
    if (!trackMapCanvas) return;
    
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.style.cursor = "pointer";
    
    // 越界点大且红色，正常点小且绿色
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", isOutOfRoute ? 12 : 6);
    circle.setAttribute("fill", isOutOfRoute ? "#dc2626" : "#22c55e");
    circle.setAttribute("stroke", isOutOfRoute ? "#991b1b" : "#166534");
    circle.setAttribute("stroke-width", isOutOfRoute ? 3 : 2);
    
    if (isOutOfRoute) {
      // 越界点添加警告动画
      circle.innerHTML = '<animate attributeName="r" values="10;14;10" dur="1s" repeatCount="indefinite"/>';
      circle.setAttribute("filter", "drop-shadow(0 0 4px #dc2626)");
    }
    
    g.appendChild(circle);
    
    // 点击显示信息
    g.onclick = function() {
      Common.showToast((isOutOfRoute ? "⚠️ 越界 - " : "✓ 正常 - ") + name + " (" + time + ")", isOutOfRoute ? "warning" : "info");
    };
    
    trackMapCanvas.appendChild(g);
    trackPoints.push(g);
  }

  function clearTrackPoints() {
    trackPoints.forEach(function(p) {
      if (p.parentNode) p.parentNode.removeChild(p);
    });
    trackPoints = [];
  }

  // 地图原始尺寸
  var mapOriginal = { width: 800, height: 400 };

  function zoomMap(factor) {
    mapZoom *= factor;
    mapZoom = Math.max(0.3, Math.min(5, mapZoom)); // 更大的缩放范围
    updateMapTransform();
  }

  function resetMapZoom() {
    mapZoom = 1;
    mapPan = { x: 0, y: 0 };
    updateMapTransform();
  }

  function updateMapTransform() {
    if (!trackMapCanvas) return;
    // 使用固定的原始尺寸计算
    var newWidth = mapOriginal.width / mapZoom;
    var newHeight = mapOriginal.height / mapZoom;
    var newX = (mapOriginal.width - newWidth) / 2 + mapPan.x;
    var newY = (mapOriginal.height - newHeight) / 2 + mapPan.y;
    trackMapCanvas.setAttribute("viewBox", newX + " " + newY + " " + newWidth + " " + newHeight);
  }

  async function loadTracks() {
    var container = document.getElementById("tracksTable");
    Common.setContentLoading(container);
    
    // 初始化地图
    initTrackMap();
    
    // 绑定按钮事件
    var refreshBtn = document.getElementById("refreshTracksBtn");
    var simulateBtn = document.getElementById("simulateTrackBtn");
    if (refreshBtn) refreshBtn.onclick = loadTracks;
    if (simulateBtn && isManager()) {
      simulateBtn.style.display = "inline-flex";
      simulateBtn.onclick = simulateTrack;
    }
    
    if (!isManager()) {
      container.innerHTML = '<div class="notice notice-info">轨迹追踪查看需要管理员权限</div>';
      return;
    }
    
    try {
      // 获取所有轨迹数据
      var allTracks = await Api.requestJson("GET", "/api/visitor/tracks");
      
      // 清除旧标记
      clearTrackPoints();
      
      // 在地图上添加轨迹点（分散显示）
      if (allTracks && allTracks.length > 0) {
        allTracks.forEach(function(track) {
          var areaId = track.AreaId || track.area_id || 1;
          var isOut = track.IsOutOfRoute || track.is_out_of_route;
          var name = track.VisitorName || track.visitor_name || "游客";
          var time = Common.formatDate(track.LocateTime || track.locate_time);
          
          // 获取区域内的随机分散点
          var point = getRandomPointInArea(areaId);
          addTrackPoint(point.x, point.y, isOut, name, time);
        });
      }
      
      // 获取越界轨迹显示在表格
      var outOfRoute = allTracks ? allTracks.filter(function(t) { 
        return t.IsOutOfRoute || t.is_out_of_route; 
      }) : [];
      
      if (!outOfRoute || outOfRoute.length === 0) {
        container.innerHTML = '<div class="notice notice-info">✓ 暂无异常轨迹记录，游客活动正常</div>';
        return;
      }
      
      renderTable(container, outOfRoute, [
        { key: "track_id", label: "轨迹ID", altKey: "TrackId" },
        { key: "visitor_name", label: "游客姓名", altKey: "VisitorName" },
        { key: "locate_time", label: "时间", altKey: "LocateTime", render: function(v) { return Common.formatDate(v); } },
        { key: "area_id", label: "区域", altKey: "AreaId", render: function(v) {
          var area = parkAreas.find(function(a) { return a.id === v; });
          return area ? area.name : "区域" + v;
        }},
        { key: "status", label: "状态", altKey: "Status", render: function(v, row) {
          // 检查Status字段，如果是"已解决"则显示绿色，否则显示红色越界
          var status = v || row.Status || row.status;
          if (status === "已解决") {
            return '<span class="tag tag-success">✅ 已解决</span>';
          }
          return '<span class="tag tag-danger">⚠️ 越界</span>';
        }}
      ]);
    } catch (e) {
      console.error("Load tracks error:", e);
      container.innerHTML = '<div class="notice notice-info">✓ 暂无轨迹数据</div>';
    }
  }

  // ========== 实时轨迹模拟系统 ==========
  var realTimeInterval = null;
  var realTimeEnabled = false;
  var simulatedVisitors = [
    { id: "110101199001011234", name: "张伟" },
    { id: "110101199202022345", name: "李娜" },
    { id: "110101199303033456", name: "王芳" },
    { id: "110101199404044567", name: "刘洋" },
    { id: "110101199505055678", name: "陈静" }
  ];

  async function simulateTrack() {
    // 模拟上报一条轨迹数据（3个区域）
    var areas = [1, 2, 3];
    var randomArea = areas[Math.floor(Math.random() * areas.length)];
    var isOutOfRoute = Math.random() > 0.7; // 30%概率越界
    
    // 随机选择一个模拟游客
    var visitor = simulatedVisitors[Math.floor(Math.random() * simulatedVisitors.length)];
    
    // 使用分散点生成（SVG坐标系）
    var point = getRandomPointInArea(randomArea);
    
    var payload = {
      id_card_no: visitor.id,
      latitude: point.y,
      longitude: point.x,
      area_id: randomArea,
      is_out_of_route: isOutOfRoute
    };
    
    try {
      await Api.requestJson("POST", "/api/visitor/tracks", payload);
      var msg = isOutOfRoute 
        ? "🚨 " + visitor.name + " 越界预警！位置已记录" 
        : "📍 " + visitor.name + " 位置已更新";
      Common.showToast(msg, isOutOfRoute ? "warning" : "success");
      loadTracks();
      if (isOutOfRoute) {
        // 越界时同时刷新预警和统计
        setTimeout(function() {
          loadAlerts();
          loadStats();
        }, 500);
      }
    } catch (e) {
      Common.showToast("轨迹上报失败: " + Api.formatError(e), "error");
    }
  }

  // 开启/关闭实时模拟
  function toggleRealTimeSimulation() {
    if (realTimeEnabled) {
      stopRealTimeSimulation();
    } else {
      startRealTimeSimulation();
    }
  }

  function startRealTimeSimulation() {
    if (realTimeInterval) return;
    realTimeEnabled = true;
    
    // 更新按钮状态
    var btn = document.getElementById("toggleRealTimeBtn");
    if (btn) {
      btn.innerHTML = "⏹️ 停止实时模拟";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-danger");
    }
    
    Common.showToast("🔴 实时轨迹模拟已开启，每10秒自动采集", "info");
    
    // 立即执行一次
    simulateTrack();
    
    // 每10秒执行一次（演示用，实际可改为60秒）
    realTimeInterval = setInterval(function() {
      simulateTrack();
    }, 10000);
  }

  function stopRealTimeSimulation() {
    if (realTimeInterval) {
      clearInterval(realTimeInterval);
      realTimeInterval = null;
    }
    realTimeEnabled = false;
    
    var btn = document.getElementById("toggleRealTimeBtn");
    if (btn) {
      btn.innerHTML = "▶️ 开启实时模拟";
      btn.classList.remove("btn-danger");
      btn.classList.add("btn-primary");
    }
    
    Common.showToast("⏹️ 实时轨迹模拟已停止", "info");
  }

  // 自动刷新数据
  var autoRefreshInterval = null;

  function startAutoRefresh() {
    if (autoRefreshInterval) return;
    // 每30秒自动刷新统计数据
    autoRefreshInterval = setInterval(function() {
      loadStats();
      // 如果在轨迹追踪标签页，也刷新轨迹
      var activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && activeTab.dataset.tab === 'tracks') {
        loadTracks();
      }
    }, 30000);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }

  function showCreateModal() {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var defaultDate = tomorrow.toISOString().split('T')[0];
    
    var content = 
      '<form id="reservationForm">' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label">游客姓名</label>' +
            '<input class="field-input" name="visitor_name" value="' + (profile ? profile.name : '') + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">身份证号</label>' +
            '<input class="field-input" name="id_card_no" placeholder="18位身份证号" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">手机号</label>' +
            '<input class="field-input" name="phone" value="' + (profile ? profile.phone : '') + '" />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">预约日期</label>' +
            '<input class="field-input" name="reserve_date" type="date" value="' + defaultDate + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">时段</label>' +
            '<select class="field-select" name="time_slot">' +
              '<option value="上午">上午 (8:00-12:00)</option>' +
              '<option value="下午">下午 (12:00-17:00)</option>' +
              '<option value="全天">全天</option>' +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">人数</label>' +
            '<input class="field-input" name="party_size" type="number" value="1" min="1" max="10" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">选择公园</label>' +
            '<select class="field-select" name="park_name">' +
              '<option value="张家界国家森林公园">张家界国家森林公园</option>' +
              '<option value="神农架国家森林公园">神农架国家森林公园</option>' +
              '<option value="西双版纳国家森林公园">西双版纳国家森林公园</option>' +
              '<option value="九寨沟国家森林公园">九寨沟国家森林公园</option>' +
              '<option value="武夷山国家森林公园">武夷山国家森林公园</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "新建预约",
      content: content,
      confirmText: "提交预约",
      onConfirm: async function(close) {
        var form = document.getElementById("reservationForm");
        var formData = new FormData(form);
        
        var payload = {
          visitor_name: formData.get("visitor_name"),
          id_card_no: formData.get("id_card_no"),
          phone: formData.get("phone"),
          reserve_date: formData.get("reserve_date"),
          time_slot: formData.get("time_slot"),
          party_size: parseInt(formData.get("party_size")) || 1,
          park_name: formData.get("park_name")
        };
        
        if (!payload.id_card_no || payload.id_card_no.length < 15) {
          Common.showToast("请输入有效的身份证号", "error");
          return;
        }
        
        try {
          await Api.requestJson("POST", "/api/visitor/reservations", payload);
          Common.showToast("预约创建成功", "success");
          close();
          loadReservations();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  async function loadAlerts() {
    var container = document.getElementById("alertsTable");
    Common.setContentLoading(container);
    
    if (!isManager()) {
      container.innerHTML = '<div class="notice notice-info">预警查看需要管理员权限</div>';
      return;
    }
    
    try {
      var allData = await Api.requestJson("GET", "/api/visitor/alerts");
      
      // 只显示游客越界预警（其他预警不在此页面显示）
      var data = allData ? allData.filter(function(a) {
        var alertType = a.alert_type || a.AlertType;
        return alertType === "游客越界";
      }) : [];
      
      // 统计预警数量
      var unhandled = 0, handled = 0;
      if (data && data.length > 0) {
        data.forEach(function(a) {
          var status = a.status || a.Status;
          if (status === "已处理") handled++;
          else unhandled++;
        });
      }
      document.getElementById("alertHigh").textContent = unhandled;
      document.getElementById("alertMedium").textContent = "0";
      document.getElementById("alertHandled").textContent = handled;
      
      // 更新弹幕统计
      var danmakuPending = document.getElementById("danmakuPending");
      var danmakuHandled = document.getElementById("danmakuHandled");
      if (danmakuPending) danmakuPending.textContent = unhandled;
      if (danmakuHandled) danmakuHandled.textContent = handled;
      
      // 启动弹幕效果
      startDanmaku(data);
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice notice-success" style="text-align:center;padding:30px;">✅ 暂无游客越界预警，园区运行正常</div>';
        return;
      }
      
      renderTable(container, data, [
        { key: "alert_id", label: "预警ID", altKey: "AlertId" },
        { key: "visitor_id", label: "游客ID", altKey: "VisitorId" },
        { key: "area_id", label: "区域", altKey: "AreaId", render: function(v) {
          var area = parkAreas.find(function(a) { return a.id === v; });
          return area ? '<span class="tag tag-purple">' + (area ? area.name : "区域" + v) + '</span>' : "区域" + v;
        }},
        { key: "message", label: "预警消息", altKey: "Message" },
        { key: "status", label: "状态", altKey: "Status", render: function(v) {
          return v === "已处理" ? '<span class="tag tag-success">✅ 已处理</span>' : '<span class="tag tag-danger">🚨 未处理</span>';
        }},
        { key: "created_at", label: "时间", altKey: "CreatedAt", render: function(v) { return Common.formatDate(v); } }
      ], {
        actions: function(row) {
          var status = row.status || row.Status;
          var alertId = row.alert_id || row.AlertId;
          if (status !== "已处理") {
            return '<button class="btn btn-sm btn-danger" onclick="VisitorPage.handleAlert(' + alertId + ')">🔔 立即处理</button>';
          }
          return '<span style="color:#16a34a;">✓ 已完成</span>';
        },
        rowClass: function(row) {
          var status = row.status || row.Status;
          return status !== "已处理" ? 'alert-row-danger' : '';
        }
      });
    } catch (e) {
      console.error("Load alerts error:", e);
      document.getElementById("alertHigh").textContent = "0";
      document.getElementById("alertMedium").textContent = "0";
      document.getElementById("alertHandled").textContent = "0";
      container.innerHTML = '<div class="notice notice-success" style="text-align:center;padding:30px;">✅ 暂无游客越界预警，园区运行正常</div>';
    }
  }

  // ========== 弹幕效果 ==========
  var danmakuTimer = null;
  var danmakuIndex = 0;
  
  function startDanmaku(alerts) {
    var container = document.getElementById("danmakuContainer");
    if (!container) return;
    
    // 清除旧弹幕
    if (danmakuTimer) {
      clearInterval(danmakuTimer);
      danmakuTimer = null;
    }
    
    // 清除现有弹幕元素（保留统计栏）
    var oldItems = container.querySelectorAll('.danmaku-item');
    oldItems.forEach(function(item) { item.remove(); });
    
    if (!alerts || alerts.length === 0) {
      // 显示"无预警"提示弹幕
      addDanmakuItem(container, "✅ 园区运行正常，无越界预警", "success", 0);
      return;
    }
    
    danmakuIndex = 0;
    
    // 立即添加前几条
    for (var i = 0; i < Math.min(3, alerts.length); i++) {
      var alert = alerts[i];
      var status = alert.status || alert.Status;
      var message = alert.message || alert.Message || "游客越界预警";
      var visitorId = alert.visitor_id || alert.VisitorId;
      var type = status === "已处理" ? "success" : "danger";
      var text = (status === "已处理" ? "✅ " : "🚨 ") + "游客#" + visitorId + ": " + message;
      addDanmakuItem(container, text, type, i);
    }
    
    // 循环显示弹幕
    danmakuTimer = setInterval(function() {
      danmakuIndex = (danmakuIndex + 1) % alerts.length;
      var alert = alerts[danmakuIndex];
      var status = alert.status || alert.Status;
      var message = alert.message || alert.Message || "游客越界预警";
      var visitorId = alert.visitor_id || alert.VisitorId;
      var type = status === "已处理" ? "success" : "danger";
      var text = (status === "已处理" ? "✅ " : "🚨 ") + "游客#" + visitorId + ": " + message;
      addDanmakuItem(container, text, type, Math.floor(Math.random() * 5));
    }, 2000);
  }
  
  function addDanmakuItem(container, text, type, trackIndex) {
    var item = document.createElement("div");
    item.className = "danmaku-item " + type;
    item.textContent = text;
    
    // 随机轨道位置（避免重叠）
    var top = 20 + (trackIndex % 5) * 50;
    item.style.top = top + "px";
    
    // 动画持续时间（8-12秒）
    var duration = 8 + Math.random() * 4;
    item.style.animationDuration = duration + "s";
    
    container.appendChild(item);
    
    // 动画结束后移除
    setTimeout(function() {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, duration * 1000);
  }

  function showEnterModal() {
    var content = 
      '<form id="enterForm">' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label">身份证号</label>' +
            '<input class="field-input" name="id_card_no" placeholder="游客身份证号" required />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">入园区域</label>' +
            '<select class="field-select" name="area_id">' +
              '<option value="1">核心区</option>' +
              '<option value="2">缓冲区A</option>' +
              '<option value="3">缓冲区B</option>' +
              '<option value="4">服务区</option>' +
              '<option value="5">入口区</option>' +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">入园方式</label>' +
            '<select class="field-select" name="entry_method">' +
              '<option value="线上预约">线上预约</option>' +
              '<option value="现场购票">现场购票</option>' +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">预约编号（可选）</label>' +
            '<input class="field-input" name="reservation_id" placeholder="如有预约请填写" />' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "入园登记",
      content: content,
      confirmText: "确认入园",
      onConfirm: async function(close) {
        var form = document.getElementById("enterForm");
        var formData = new FormData(form);
        
        var payload = {
          id_card_no: formData.get("id_card_no"),
          area_id: parseInt(formData.get("area_id")),
          entry_method: formData.get("entry_method")
        };
        
        var resId = formData.get("reservation_id");
        if (resId && resId.trim() !== "") {
          payload.reservation_id = parseInt(resId);
        }
        
        try {
          await Api.requestJson("POST", "/api/visitor/visits/enter", payload);
          Common.showToast("入园登记成功", "success");
          close();
          loadStats();
          loadVisits();
        } catch (e) {
          Common.showToast("入园失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  async function exitPark(visitId) {
    Common.confirm("确认该游客离园？", async function() {
      try {
        await Api.requestJson("POST", "/api/visitor/visits/" + visitId + "/exit", {});
        Common.showToast("离园登记成功", "success");
        loadStats();
        loadVisits();
      } catch (e) {
        Common.showToast("离园失败: " + Api.formatError(e), "error");
      }
    });
  }

  async function handleAlert(alertId) {
    Common.confirm("确认处理此预警？处理后预警状态将变为【已处理】，关联的轨迹记录状态将变为【已解决】。", async function() {
      try {
        await Api.requestJson("PUT", "/api/visitor/alerts/" + alertId + "/handle", {});
        Common.showToast("✅ 预警已处理，轨迹记录已更新为已解决", "success");
        // 刷新预警列表和轨迹列表
        loadAlerts();
        loadTracks();
      } catch (e) {
        Common.showToast("处理失败: " + Api.formatError(e), "error");
      }
    });
  }

  async function confirmReservation(reservationId, newStatus) {
    Common.confirm("确认" + (newStatus === "已确认" ? "通过" : "取消") + "此预约？", async function() {
      try {
        await Api.requestJson("PUT", "/api/visitor/reservations/" + reservationId + "/confirm", { status: newStatus });
        Common.showToast("预约状态已更新", "success");
        loadReservations();
        loadStats();
      } catch (e) {
        Common.showToast("操作失败: " + Api.formatError(e), "error");
      }
    });
  }

  function showReservationDetail(reservationId) {
    var reservation = reservationsCache.find(function(r) {
      return (r.reservation_id || r.ReservationId) === reservationId;
    });
    
    if (!reservation) {
      Common.showToast("未找到预约信息", "error");
      return;
    }
    
    var r = reservation;
    var timeSlotMap = {"上午": "8:00-12:00", "下午": "12:00-17:00", "全天": "8:00-17:00"};
    var rawStatus = r.reserve_status || r.ReserveStatus || "待确认";
    var displayStatus = (rawStatus === "已确认") ? "待确认" : rawStatus;
    var statusClass = displayStatus === "已取消" ? "tag-danger" : (displayStatus === "已完成" ? "tag-info" : "tag-warning");
    
    var content = 
      '<div class="detail-grid" style="display: grid; grid-template-columns: 120px 1fr; gap: 12px; line-height: 2;">' +
        '<div style="color: #666;">预约编号</div><div><strong>' + (r.reservation_id || r.ReservationId) + '</strong></div>' +
        '<div style="color: #666;">游客姓名</div><div>' + (r.visitor_name || r.VisitorName || "-") + '</div>' +
        '<div style="color: #666;">身份证号</div><div>' + (r.id_card_no || r.IdCardNo || "-") + '</div>' +
        '<div style="color: #666;">联系电话</div><div>' + (r.phone || r.Phone || "-") + '</div>' +
        '<div style="color: #666;">预约日期</div><div>' + ((r.reserve_date || r.ReserveDate || "").split("T")[0]) + '</div>' +
        '<div style="color: #666;">入园时段</div><div>' + (r.time_slot || r.TimeSlot || "-") + ' (' + (timeSlotMap[r.time_slot || r.TimeSlot] || "") + ')</div>' +
        '<div style="color: #666;">同行人数</div><div>' + (r.party_size || r.PartySize || 1) + ' 人</div>' +
        '<div style="color: #666;">票价金额</div><div>¥' + (r.ticket_amount || r.TicketAmount || 0).toFixed(2) + '</div>' +
        '<div style="color: #666;">支付状态</div><div>' + (r.pay_status || r.PayStatus || "未支付") + '</div>' +
        '<div style="color: #666;">预约状态</div><div><span class="tag ' + statusClass + '">' + displayStatus + '</span></div>' +
      '</div>';
    
    Common.showModal({
      title: "预约详情 #" + (r.reservation_id || r.ReservationId),
      content: content,
      confirmText: "关闭",
      hideCancel: true,
      onConfirm: function(close) { close(); }
    });
  }

  // 快速入园登记（从预约记录直接操作）
  function quickEnterPark(idCardNo, reservationId) {
    var content = 
      '<form id="quickEnterForm">' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label">身份证号</label>' +
            '<input class="field-input" name="id_card_no" value="' + idCardNo + '" readonly style="background:#f3f4f6;" />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">预约编号</label>' +
            '<input class="field-input" name="reservation_id" value="' + reservationId + '" readonly style="background:#f3f4f6;" />' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label">入园区域</label>' +
            '<select class="field-select" name="area_id">' +
              '<option value="1">🏔️ 核心保护区</option>' +
              '<option value="2">🌲 缓冲区A</option>' +
              '<option value="3">🌳 缓冲区B</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<p style="margin-top:12px;color:#666;font-size:13px;">💡 入园后预约状态将自动更新为"已完成"</p>' +
      '</form>';
    
    Common.showModal({
      title: "入园登记 - 预约#" + reservationId,
      content: content,
      confirmText: "确认入园",
      onConfirm: async function(close) {
        var form = document.getElementById("quickEnterForm");
        var formData = new FormData(form);
        
        var payload = {
          id_card_no: formData.get("id_card_no"),
          area_id: parseInt(formData.get("area_id")),
          entry_method: "线上预约",
          reservation_id: parseInt(formData.get("reservation_id"))
        };
        
        try {
          await Api.requestJson("POST", "/api/visitor/visits/enter", payload);
          Common.showToast("入园登记成功", "success");
          close();
          // 更新预约状态为已完成
          await Api.requestJson("PUT", "/api/visitor/reservations/" + reservationId + "/confirm", { status: "已完成" });
          loadStats();
          loadReservations();
          loadVisits();
        } catch (e) {
          Common.showToast("入园失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // 导出报告功能
  async function exportReport() {
    Common.showToast("正在生成报告...", "info");
    
    try {
      // 获取各项数据
      var flows = flowsCache.length > 0 ? flowsCache : [];
      var reservations = reservationsStatsCache.length > 0 ? reservationsStatsCache : [];
      var visits = [];
      var tracks = [];
      
      try {
        if (flows.length === 0) flows = await Api.requestJson("GET", "/api/visitor/flow-controls");
      } catch (e) { console.log("Failed to get flows"); }
      
      try {
        if (reservations.length === 0) {
          var endpoint = isManager() ? "/api/visitor/reservations" : "/api/visitor/reservations/me";
          reservations = await Api.requestJson("GET", endpoint);
        }
      } catch (e) { console.log("Failed to get reservations"); }
      
      try {
        visits = await Api.requestJson("GET", "/api/visitor/visits");
      } catch (e) { console.log("Failed to get visits"); }
      
      try {
        tracks = await Api.requestJson("GET", "/api/visitor/tracks");
      } catch (e) { console.log("Failed to get tracks"); }
      
      // 统计数据 (使用正确的字段名)
      var totalCurrent = 0;
      var totalMax = 0;
      flows.forEach(function(f) {
        totalCurrent += (f.current_in_park || f.CurrentInPark || 0);
        totalMax += (f.daily_max_capacity || f.DailyMaxCapacity || 1000);
      });
      
      var pendingCount = reservations.filter(function(r) {
        var status = r.reserve_status || r.ReserveStatus || "";
        return status === "待确认" || status === "已确认";
      }).length;
      
      var completedCount = reservations.filter(function(r) {
        var status = r.reserve_status || r.ReserveStatus || "";
        return status === "已完成";
      }).length;
      
      var cancelledCount = reservations.filter(function(r) {
        var status = r.reserve_status || r.ReserveStatus || "";
        return status === "已取消";
      }).length;
      
      var outOfRouteCount = tracks.filter(function(t) {
        return t.is_out_of_route || t.IsOutOfRoute;
      }).length;
      
      // 生成报告内容
      var today = new Date().toLocaleDateString("zh-CN");
      var report = "╔══════════════════════════════════════╗\n";
      report += "║     国家公园游客服务综合报告         ║\n";
      report += "╚══════════════════════════════════════╝\n\n";
      report += "📅 报告生成时间: " + new Date().toLocaleString("zh-CN") + "\n";
      report += "📍 报告类型: 游客服务模块数据汇总\n\n";
      
      report += "┌──────────────────────────────────────┐\n";
      report += "│           【实时园区统计】           │\n";
      report += "└──────────────────────────────────────┘\n";
      report += "  👥 园内游客总数: " + totalCurrent + " 人\n";
      report += "  📊 总接待容量: " + totalMax + " 人\n";
      report += "  📈 容量占用率: " + (totalMax > 0 ? Math.round(totalCurrent / totalMax * 100) : 0) + "%\n";
      report += "  🚨 越界预警数: " + outOfRouteCount + " 次\n\n";
      
      report += "┌──────────────────────────────────────┐\n";
      report += "│           【预约统计汇总】           │\n";
      report += "└──────────────────────────────────────┘\n";
      report += "  ⏳ 待处理预约: " + pendingCount + " 条\n";
      report += "  ✅ 已完成预约: " + completedCount + " 条\n";
      report += "  ❌ 已取消预约: " + cancelledCount + " 条\n";
      report += "  📋 预约总数: " + reservations.length + " 条\n\n";
      
      report += "┌──────────────────────────────────────┐\n";
      report += "│           【区域流量详情】           │\n";
      report += "└──────────────────────────────────────┘\n";
      if (flows.length === 0) {
        report += "  (暂无区域流量数据)\n";
      } else {
        flows.forEach(function(f, i) {
          var areaName = f.area_name || f.AreaName || ("区域" + (f.area_id || f.AreaId || (i+1)));
          var current = f.current_in_park || f.CurrentInPark || 0;
          var max = f.daily_max_capacity || f.DailyMaxCapacity || 1000;
          var status = f.current_status || f.CurrentStatus || "正常";
          var pct = max > 0 ? Math.round(current/max*100) : 0;
          var bar = "█".repeat(Math.floor(pct/10)) + "░".repeat(10 - Math.floor(pct/10));
          report += "  " + areaName + "\n";
          report += "    人数: " + current + "/" + max + " [" + bar + "] " + pct + "%\n";
          report += "    状态: " + status + "\n";
        });
      }
      
      report += "\n┌──────────────────────────────────────┐\n";
      report += "│         【最近入园记录(前10)】       │\n";
      report += "└──────────────────────────────────────┘\n";
      if (visits.length === 0) {
        report += "  (暂无入园记录)\n";
      } else {
        visits.slice(0, 10).forEach(function(v, i) {
          var name = v.visitor_name || v.VisitorName || "游客";
          var time = v.entry_time || v.EntryTime || "";
          if (time) time = new Date(time).toLocaleString("zh-CN");
          var method = v.entry_method || v.EntryMethod || "-";
          report += "  " + (i+1) + ". " + name + " | " + time + " | " + method + "\n";
        });
      }
      
      report += "\n┌──────────────────────────────────────┐\n";
      report += "│         【最近预约记录(前10)】       │\n";
      report += "└──────────────────────────────────────┘\n";
      if (reservations.length === 0) {
        report += "  (暂无预约记录)\n";
      } else {
        reservations.slice(0, 10).forEach(function(r, i) {
          var id = r.reservation_id || r.ReservationId;
          var name = r.visitor_name || r.VisitorName || "-";
          var date = (r.reserve_date || r.ReserveDate || "").split("T")[0];
          var status = r.reserve_status || r.ReserveStatus || "-";
          if (status === "已确认") status = "待确认";
          report += "  " + (i+1) + ". #" + id + " | " + name + " | " + date + " | " + status + "\n";
        });
      }
      
      report += "\n╔══════════════════════════════════════╗\n";
      report += "║             报告结束                 ║\n";
      report += "╚══════════════════════════════════════╝\n";
      
      // 创建下载
      var blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "游客服务报告_" + today.replace(/\//g, "-") + ".txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      Common.showToast("报告已生成并下载", "success");
    } catch (e) {
      console.error("Export error:", e);
      Common.showToast("导出失败: " + e.message, "error");
    }
  }

  window.VisitorPage = {
    init: init,
    exitPark: exitPark,
    handleAlert: handleAlert,
    confirmReservation: confirmReservation,
    showReservationDetail: showReservationDetail,
    quickEnterPark: quickEnterPark,
    zoomMap: zoomMap,
    resetMapZoom: resetMapZoom,
    exportReport: exportReport,
    toggleRealTimeSimulation: toggleRealTimeSimulation,
    startRealTimeSimulation: startRealTimeSimulation,
    stopRealTimeSimulation: stopRealTimeSimulation,
    triggerFlowControl: triggerFlowControl,
    stopFlowControl: stopFlowControl
  };
})();
