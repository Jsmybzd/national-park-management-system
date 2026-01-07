(function () {
  "use strict";

  var profile = null;
  var currentTab = "species";
  var speciesCache = [];
  var habitatsCache = [];
  var recordsCache = [];

  function init(userProfile) {
    profile = userProfile;
    initTabs();
    loadStats();
    loadSpecies();
    
    var createBtn = document.getElementById("createBtn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreateModal);
    }
  }

  function isMonitor() {
    // 允许所有已登录用户查看，但只有特定角色可以创建
    return profile && ["生态监测员", "数据分析师", "系统管理员", "公园管理人员", "科研人员", "游客"].includes(profile.role_type);
  }

  function isAnalyst() {
    // 允许数据分析师、系统管理员、公园管理人员核实数据
    return profile && ["数据分析师", "系统管理员", "公园管理人员"].includes(profile.role_type);
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
        
        if (tabName === "species") loadSpecies();
        else if (tabName === "habitats") loadHabitats();
        else if (tabName === "observations") loadObservations();
      });
    });
  }

  async function loadStats() {
    try {
      var resp = await Api.requestJson("GET", "/api/biodiversity/species");
      // API返回 {total, species, page, page_size}
      var species = resp.species || resp.items || resp.records || [];
      if (Array.isArray(resp)) species = resp;
      speciesCache = species;
      document.getElementById("statSpecies").textContent = resp.total || species.length || 0;
      
      var endangered = species.filter(function(s) {
        return s.protect_level === "国家一级" || s.protect_level === "国家二级";
      });
      document.getElementById("statEndangered").textContent = endangered.length || 0;
    } catch (e) {
      console.error("Load species stats error:", e);
      document.getElementById("statSpecies").textContent = "0";
      document.getElementById("statEndangered").textContent = "0";
    }
    
    try {
      var resp = await Api.requestJson("GET", "/api/biodiversity/records");
      var records = resp.records || [];
      recordsCache = records;
      document.getElementById("statObservations").textContent = resp.total || records.length || 0;
    } catch (e) {
      console.error("Load records stats error:", e);
      document.getElementById("statObservations").textContent = "0";
    }
    
    // 统计栖息地数量（从区域物种关联中获取）
    try {
      var areasResp = await Api.requestJson("GET", "/api/biodiversity/all-areas");
      var areas = areasResp.map(function(a) { return a.area_id; });
      var habitatCount = 0;
      for (var i = 0; i < areas.length; i++) {
        try {
          var data = await Api.requestJson("GET", "/api/biodiversity/areas/" + areas[i] + "/species");
          if (data && data.length > 0) habitatCount++;
        } catch (e) {}
      }
      document.getElementById("statHabitats").textContent = habitatCount || "0";
    } catch (e) {
      document.getElementById("statHabitats").textContent = "0";
    }
  }

  // ========== 物种信息 ==========
  async function loadSpecies() {
    var container = document.getElementById("speciesTable");
    Common.setContentLoading(container);
    
    try {
      var resp = await Api.requestJson("GET", "/api/biodiversity/species");
      // API返回 {total, species, page, page_size}
      var data = resp.species || resp.items || resp.records || [];
      if (Array.isArray(resp)) data = resp;
      speciesCache = data;
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无物种数据</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>🦁 编号</th><th>中文名</th><th>学名</th><th>分类</th><th>保护级别</th><th>生存习性</th><th>分布范围</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var levelCls = item.protect_level === "国家一级" ? "tag-danger" : 
                       (item.protect_level === "国家二级" ? "tag-warning" : "tag-info");
        var taxonomy = [item.class_name, item.order, item.family].filter(Boolean).join(' / ') || '-';
        html += '<tr>' +
          '<td><span class="tag tag-info">' + item.id + '</span></td>' +
          '<td><strong>' + (item.chinese_name || '-') + '</strong></td>' +
          '<td><em style="color:#666;">' + (item.latin_name || '-') + '</em></td>' +
          '<td style="font-size:12px;">' + taxonomy + '</td>' +
          '<td><span class="tag ' + levelCls + '">' + (item.protect_level || '无') + '</span></td>' +
          '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (item.live_habit || '') + '">' + (item.live_habit || '-') + '</td>' +
          '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;">' + (item.distribution_range || '-') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="BiodiversityPage.viewSpecies(' + item.id + ')">详情</button> ' +
            '<button class="btn btn-sm btn-primary" onclick="BiodiversityPage.editSpecies(' + item.id + ')">编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="BiodiversityPage.deleteSpecies(' + item.id + ')">删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 栖息地信息 ==========
  async function loadHabitats() {
    var container = document.getElementById("habitatsTable");
    Common.setContentLoading(container);
    
    // 显示区域物种关联
    try {
      // 先获取实际的区域列表
      var areasResp = await Api.requestJson("GET", "/api/biodiversity/all-areas");
      var areas = areasResp.map(function(a) { return a.area_id; });
      if (!areas || areas.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无区域数据</div>';
        return;
      }
      var allData = [];
      
      for (var i = 0; i < areas.length; i++) {
        try {
          var data = await Api.requestJson("GET", "/api/biodiversity/areas/" + areas[i] + "/species");
          data.forEach(function(d) { d.area_id = areas[i]; });
          allData = allData.concat(data);
        } catch (e) {}
      }
      
      if (!allData || allData.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无栖息地物种关联数据</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>🏔️ 区域ID</th><th>物种编号</th><th>中文名</th><th>学名</th><th>保护级别</th><th>主要物种</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      allData.forEach(function(item) {
        var levelCls = item.protect_level === "国家一级" ? "tag-danger" : 
                       (item.protect_level === "国家二级" ? "tag-warning" : "tag-info");
        html += '<tr>' +
          '<td><span class="tag tag-purple">区域 ' + item.area_id + '</span></td>' +
          '<td><span class="tag tag-info">' + item.species_id + '</span></td>' +
          '<td><strong>' + (item.chinese_name || '-') + '</strong></td>' +
          '<td><em style="color:#666;">' + (item.latin_name || '-') + '</em></td>' +
          '<td><span class="tag ' + levelCls + '">' + (item.protect_level || '无') + '</span></td>' +
          '<td>' + (item.is_main ? '<span class="tag tag-success">✓ 主要</span>' : '<span class="tag">普通</span>') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-warning" onclick="BiodiversityPage.toggleMainSpecies(' + item.area_id + ', ' + item.species_id + ', ' + (item.is_main ? 0 : 1) + ')">' + (item.is_main ? '取消主要' : '设为主要') + '</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="BiodiversityPage.removeFromArea(' + item.area_id + ', ' + item.species_id + ')">移除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      html += '<div style="margin-top:16px;"><button class="btn btn-primary" onclick="BiodiversityPage.showAddToAreaModal()">➕ 添加物种到区域</button></div>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 监测记录 ==========
  async function loadObservations() {
    var container = document.getElementById("observationsTable");
    Common.setContentLoading(container);
    
    try {
      var resp = await Api.requestJson("GET", "/api/biodiversity/records");
      var data = resp.records || [];
      recordsCache = data;
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无监测记录</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>📍 记录ID</th><th>物种</th><th>监测方式</th><th>监测时间</th><th>地点</th><th>数量</th><th>记录文件</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var methodCls = item.monitoring_method === "红外相机" ? "tag-info" : 
                        (item.monitoring_method === "人工巡查" ? "tag-success" : "tag-purple");
        var stateCls = item.state === "有效" ? "tag-success" : "tag-warning";
        var species = speciesCache.find(function(s) { return s.id === item.species_id; });
        var speciesName = species ? species.chinese_name : '物种#' + item.species_id;
        var location = (item.latitude && item.longitude) ? item.latitude.toFixed(2) + ',' + item.longitude.toFixed(2) : '-';
        
        // 记录文件列
        var fileCell = '<div style="display:flex;gap:4px;align-items:center;justify-content:center;">';
        if (item.image_path) {
          fileCell += '<a href="' + item.image_path + '" target="_blank" class="btn btn-sm btn-success" download>📥 下载</a>';
        }
        fileCell += '<button class="btn btn-sm btn-info" onclick="BiodiversityPage.uploadFile(' + item.id + ')">📤 上传</button>';
        fileCell += '</div>';
        
        html += '<tr>' +
          '<td><span class="tag tag-info">' + item.id + '</span></td>' +
          '<td><strong>' + speciesName + '</strong></td>' +
          '<td><span class="tag ' + methodCls + '">' + (item.monitoring_method || '-') + '</span></td>' +
          '<td>' + Common.formatDate(item.time) + '</td>' +
          '<td style="font-size:11px;">' + location + '</td>' +
          '<td>' + (item.count || '-') + '</td>' +
          '<td>' + fileCell + '</td>' +
          '<td><span class="tag ' + stateCls + '">' + (item.state || '待核实') + '</span></td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="BiodiversityPage.viewRecord(' + item.id + ')">详情</button> ';
        
        if (item.state === "待核实" && isAnalyst()) {
          html += '<button class="btn btn-sm btn-success" onclick="BiodiversityPage.verifyRecord(' + item.id + ')">✓ 核实</button> ';
        }
        
        html += '<button class="btn btn-sm btn-danger" onclick="BiodiversityPage.deleteRecord(' + item.id + ')">删除</button>' +
          '</td></tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 创建弹窗 ==========
  function showCreateModal() {
    if (!isMonitor()) {
      Common.showToast("您没有权限执行此操作", "error");
      return;
    }
    
    if (currentTab === "species") showCreateSpeciesModal();
    else if (currentTab === "habitats") showAddToAreaModal();
    else if (currentTab === "observations") showCreateRecordModal();
  }

  function showCreateSpeciesModal() {
    var content = 
      '<form id="speciesForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">中文名 *</label><input class="field-input" name="chinese_name" placeholder="如：大熊猫" required /></div>' +
          '<div class="field"><label class="field-label">拉丁名</label><input class="field-input" name="latin_name" placeholder="如：Ailuropoda melanoleuca" /></div>' +
          '<div class="field"><label class="field-label">界</label><input class="field-input" name="kingdom" value="动物界" /></div>' +
          '<div class="field"><label class="field-label">门</label><input class="field-input" name="phylum" placeholder="如：脊索动物门" /></div>' +
          '<div class="field"><label class="field-label">纲</label><input class="field-input" name="class_name" placeholder="如：哺乳纲" /></div>' +
          '<div class="field"><label class="field-label">目</label><input class="field-input" name="order" placeholder="如：食肉目" /></div>' +
          '<div class="field"><label class="field-label">科</label><input class="field-input" name="family" placeholder="如：熊科" /></div>' +
          '<div class="field"><label class="field-label">属</label><input class="field-input" name="genus" placeholder="如：大熊猫属" /></div>' +
          '<div class="field"><label class="field-label">种</label><input class="field-input" name="species" placeholder="如：大熊猫" /></div>' +
          '<div class="field"><label class="field-label">保护级别 *</label>' +
            '<select class="field-select" name="protect_level">' +
              '<option value="无">无</option>' +
              '<option value="国家二级">国家二级</option>' +
              '<option value="国家一级">国家一级</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;"><label class="field-label">生存习性</label><textarea class="field-input" name="live_habit" rows="2" placeholder="描述物种的生活习性"></textarea></div>' +
        '<div class="field"><label class="field-label">分布范围</label><textarea class="field-input" name="distribution_range" rows="2" placeholder="描述物种的地理分布"></textarea></div>' +
      '</form>';
    
    Common.showModal({
      title: "🦁 新增物种信息",
      content: content,
      confirmText: "创建",
      onConfirm: async function(close) {
        var form = document.getElementById("speciesForm");
        var formData = new FormData(form);
        
        if (!formData.get("chinese_name")) {
          Common.showToast("请输入中文名", "error");
          return;
        }
        
        try {
          await Api.requestJson("POST", "/api/biodiversity/species", {
            chinese_name: formData.get("chinese_name"),
            latin_name: formData.get("latin_name") || null,
            kingdom: formData.get("kingdom") || null,
            phylum: formData.get("phylum") || null,
            class_name: formData.get("class_name") || null,
            order: formData.get("order") || null,
            family: formData.get("family") || null,
            genus: formData.get("genus") || null,
            species: formData.get("species") || null,
            protect_level: formData.get("protect_level"),
            live_habit: formData.get("live_habit") || null,
            distribution_range: formData.get("distribution_range") || null
          });
          Common.showToast("✅ 物种创建成功", "success");
          close();
          loadSpecies();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function showCreateRecordModal() {
    if (speciesCache.length === 0) {
      Common.showToast("请先创建物种信息", "warning");
      return;
    }
    
    var speciesOptions = speciesCache.map(function(s) {
      return '<option value="' + s.id + '">' + s.id + ' - ' + s.chinese_name + '</option>';
    }).join('');
    
    var content = 
      '<form id="recordForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">物种 *</label><select class="field-select" name="species_id">' + speciesOptions + '</select></div>' +
          '<div class="field"><label class="field-label">监测方式 *</label>' +
            '<select class="field-select" name="monitoring_method">' +
              '<option value="红外相机">红外相机</option>' +
              '<option value="人工巡查">人工巡查</option>' +
              '<option value="无人机">无人机</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">监测时间 *</label><input class="field-input" name="time" type="datetime-local" value="' + new Date().toISOString().slice(0, 16) + '" required /></div>' +
          '<div class="field"><label class="field-label">监测设备ID</label><input class="field-input" name="device_id" type="number" placeholder="可选" /></div>' +
          '<div class="field"><label class="field-label">纬度</label><input class="field-input" name="latitude" type="number" step="0.000001" placeholder="如：30.123456" /></div>' +
          '<div class="field"><label class="field-label">经度</label><input class="field-input" name="longitude" type="number" step="0.000001" placeholder="如：102.123456" /></div>' +
          '<div class="field"><label class="field-label">数量统计</label><input class="field-input" name="count" type="number" min="0" placeholder="观测到的数量" /></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;">' +
          '<label class="field-label">📷 上传监测影像</label>' +
          '<div style="display:flex;gap:12px;align-items:flex-start;">' +
            '<div style="flex:1;">' +
              '<input type="file" id="imageUpload" accept="image/*" style="display:none;" />' +
              '<button type="button" class="btn btn-info" onclick="document.getElementById(\'imageUpload\').click()" style="width:100%;">选择图片文件</button>' +
              '<div id="selectedFileName" style="margin-top:8px;color:#666;font-size:12px;">未选择文件</div>' +
              '<input class="field-input" name="image_path" id="imagePathInput" placeholder="或输入图片URL路径" style="margin-top:8px;" />' +
            '</div>' +
            '<div id="imagePreviewContainer" style="width:120px;height:90px;border:2px dashed #d1d5db;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f9fafb;">' +
              '<span style="color:#9ca3af;font-size:12px;">预览</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;"><label class="field-label">行为描述</label><textarea class="field-input" name="behavior" rows="3" placeholder="描述观测到的行为"></textarea></div>' +
      '</form>';
    
    Common.showModal({
      title: "📍 新增监测记录",
      content: content,
      confirmText: "创建记录",
      onConfirm: async function(close) {
        var form = document.getElementById("recordForm");
        var formData = new FormData(form);
        
        // 获取图片路径（优先使用上传的base64，否则使用输入的URL）
        var imagePath = window._uploadedImageData || formData.get("image_path") || null;
        
        try {
          await Api.requestJson("POST", "/api/biodiversity/records", {
            species_id: parseInt(formData.get("species_id")),
            monitoring_method: formData.get("monitoring_method"),
            time: formData.get("time") + ":00",
            device_id: formData.get("device_id") ? parseInt(formData.get("device_id")) : null,
            latitude: formData.get("latitude") ? parseFloat(formData.get("latitude")) : null,
            longitude: formData.get("longitude") ? parseFloat(formData.get("longitude")) : null,
            count: formData.get("count") ? parseInt(formData.get("count")) : null,
            image_path: imagePath,
            behavior: formData.get("behavior") || null
          });
          window._uploadedImageData = null;
          Common.showToast("✅ 监测记录创建成功，状态为待核实", "success");
          close();
          loadObservations();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
    
    // 添加图片上传事件监听
    setTimeout(function() {
      var fileInput = document.getElementById("imageUpload");
      if (fileInput) {
        fileInput.addEventListener("change", function(e) {
          var file = e.target.files[0];
          if (!file) return;
          
          document.getElementById("selectedFileName").textContent = file.name;
          
          var reader = new FileReader();
          reader.onload = function(ev) {
            var base64 = ev.target.result;
            window._uploadedImageData = base64;
            document.getElementById("imagePathInput").value = "data:image (已选择本地文件)";
            document.getElementById("imagePreviewContainer").innerHTML = 
              '<img src="' + base64 + '" style="max-width:100%;max-height:100%;object-fit:cover;" />';
          };
          reader.readAsDataURL(file);
        });
      }
    }, 100);
  }

  function showAddToAreaModal() {
    if (speciesCache.length === 0) {
      Common.showToast("请先创建物种信息", "warning");
      return;
    }
    
    var speciesOptions = speciesCache.map(function(s) {
      return '<option value="' + s.id + '">' + s.id + ' - ' + s.chinese_name + '</option>';
    }).join('');
    
    var content = 
      '<form id="areaSpeciesForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">区域ID *</label><input class="field-input" name="area_id" type="number" value="1" min="1" required /></div>' +
          '<div class="field"><label class="field-label">物种 *</label><select class="field-select" name="species_id">' + speciesOptions + '</select></div>' +
          '<div class="field"><label class="field-label">是否主要物种</label>' +
            '<select class="field-select" name="is_main">' +
              '<option value="0">否</option>' +
              '<option value="1">是（主要物种）</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "➕ 添加物种到区域",
      content: content,
      confirmText: "添加",
      onConfirm: async function(close) {
        var form = document.getElementById("areaSpeciesForm");
        var formData = new FormData(form);
        var areaId = parseInt(formData.get("area_id"));
        
        try {
          await Api.requestJson("POST", "/api/biodiversity/areas/" + areaId + "/species", {
            species_id: parseInt(formData.get("species_id")),
            is_main: parseInt(formData.get("is_main")) === 1
          });
          Common.showToast("✅ 添加成功", "success");
          close();
          loadHabitats();
        } catch (e) {
          Common.showToast("添加失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 查看详情 ==========
  function viewSpecies(id) {
    var s = speciesCache.find(function(x) { return x.id === id; });
    if (!s) { Common.showToast("物种不存在", "error"); return; }
    
    var content = 
      '<div class="detail-grid" style="display:grid;grid-template-columns:100px 1fr;gap:12px;line-height:2;">' +
        '<div style="color:#666;">物种编号</div><div><strong>' + s.id + '</strong></div>' +
        '<div style="color:#666;">中文名</div><div>' + s.chinese_name + '</div>' +
        '<div style="color:#666;">拉丁名</div><div><em>' + (s.latin_name || '-') + '</em></div>' +
        '<div style="color:#666;">分类</div><div>' + [s.kingdom, s.phylum, s.class_name, s.order, s.family, s.genus, s.species].filter(Boolean).join(' → ') + '</div>' +
        '<div style="color:#666;">保护级别</div><div><span class="tag ' + (s.protect_level === "国家一级" ? "tag-danger" : (s.protect_level === "国家二级" ? "tag-warning" : "tag-info")) + '">' + s.protect_level + '</span></div>' +
        '<div style="color:#666;">生存习性</div><div>' + (s.live_habit || '未记录') + '</div>' +
        '<div style="color:#666;">分布范围</div><div>' + (s.distribution_range || '未记录') + '</div>' +
      '</div>';
    
    Common.showModal({ title: "🦁 物种详情", content: content, confirmText: "关闭", onConfirm: function(c) { c(); } });
  }

  function viewRecord(id) {
    var r = recordsCache.find(function(x) { return x.id === id; });
    if (!r) { Common.showToast("记录不存在", "error"); return; }
    
    var species = speciesCache.find(function(s) { return s.id === r.species_id; });
    var speciesName = species ? species.chinese_name : '物种#' + r.species_id;
    
    // 图片预览区域
    var imageHtml = '';
    if (r.image_path) {
      imageHtml = '<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px;text-align:center;">' +
        '<div style="color:#666;margin-bottom:8px;font-weight:500;">📷 监测影像</div>' +
        '<img src="' + r.image_path + '" alt="监测影像" style="max-width:100%;max-height:300px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';" />' +
        '<div style="display:none;color:#999;padding:20px;">图片加载失败，路径：' + r.image_path + '</div>' +
        '<div style="margin-top:8px;"><a href="' + r.image_path + '" target="_blank" class="btn btn-sm btn-info">🔍 查看原图</a></div>' +
      '</div>';
    }
    
    var content = 
      '<div class="detail-grid" style="display:grid;grid-template-columns:100px 1fr;gap:12px;line-height:2;">' +
        '<div style="color:#666;">记录编号</div><div><strong>' + r.id + '</strong></div>' +
        '<div style="color:#666;">物种</div><div>' + speciesName + '</div>' +
        '<div style="color:#666;">监测方式</div><div><span class="tag tag-info">' + r.monitoring_method + '</span></div>' +
        '<div style="color:#666;">监测时间</div><div>' + Common.formatDate(r.time) + '</div>' +
        '<div style="color:#666;">监测地点</div><div>' + (r.latitude && r.longitude ? r.latitude + ', ' + r.longitude : '未记录') + '</div>' +
        '<div style="color:#666;">数量统计</div><div>' + (r.count || '未统计') + '</div>' +
        '<div style="color:#666;">行为描述</div><div>' + (r.behavior || '无') + '</div>' +
        '<div style="color:#666;">数据状态</div><div><span class="tag ' + (r.state === "有效" ? "tag-success" : "tag-warning") + '">' + r.state + '</span></div>' +
        (r.analysis_conclusion ? '<div style="color:#666;">分析结论</div><div>' + r.analysis_conclusion + '</div>' : '') +
      '</div>' + imageHtml;
    
    Common.showModal({ title: "📍 监测记录详情", content: content, confirmText: "关闭", onConfirm: function(c) { c(); } });
  }

  // ========== 编辑 ==========
  function editSpecies(id) {
    var s = speciesCache.find(function(x) { return x.id === id; });
    if (!s) { Common.showToast("物种不存在", "error"); return; }
    
    var content = 
      '<form id="editSpeciesForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">中文名</label><input class="field-input" name="chinese_name" value="' + (s.chinese_name || '') + '" /></div>' +
          '<div class="field"><label class="field-label">拉丁名</label><input class="field-input" name="latin_name" value="' + (s.latin_name || '') + '" /></div>' +
          '<div class="field"><label class="field-label">保护级别</label>' +
            '<select class="field-select" name="protect_level">' +
              '<option value="无"' + (s.protect_level === "无" ? ' selected' : '') + '>无</option>' +
              '<option value="国家二级"' + (s.protect_level === "国家二级" ? ' selected' : '') + '>国家二级</option>' +
              '<option value="国家一级"' + (s.protect_level === "国家一级" ? ' selected' : '') + '>国家一级</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;"><label class="field-label">生存习性</label><textarea class="field-input" name="live_habit" rows="2">' + (s.live_habit || '') + '</textarea></div>' +
        '<div class="field"><label class="field-label">分布范围</label><textarea class="field-input" name="distribution_range" rows="2">' + (s.distribution_range || '') + '</textarea></div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑物种 - " + s.chinese_name,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editSpeciesForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("PUT", "/api/biodiversity/species/" + id, {
            chinese_name: formData.get("chinese_name"),
            latin_name: formData.get("latin_name") || null,
            protect_level: formData.get("protect_level"),
            live_habit: formData.get("live_habit") || null,
            distribution_range: formData.get("distribution_range") || null
          });
          Common.showToast("✅ 更新成功", "success");
          close();
          loadSpecies();
          loadStats();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 删除 ==========
  function deleteSpecies(id) {
    Common.confirm("确认删除此物种？关联的监测记录也会被删除。", async function() {
      try {
        await Api.requestJson("DELETE", "/api/biodiversity/species/" + id);
        Common.showToast("删除成功", "success");
        loadSpecies();
        loadStats();
      } catch (e) {
        Common.showToast("删除失败: " + Api.formatError(e), "error");
      }
    });
  }

  function deleteRecord(id) {
    Common.confirm("确认删除此监测记录？", async function() {
      try {
        await Api.requestJson("DELETE", "/api/biodiversity/records/" + id);
        Common.showToast("删除成功", "success");
        loadObservations();
        loadStats();
      } catch (e) {
        Common.showToast("删除失败: " + Api.formatError(e), "error");
      }
    });
  }

  // ========== 区域物种操作 ==========
  async function toggleMainSpecies(areaId, speciesId, isMain) {
    try {
      await Api.requestJson("PUT", "/api/biodiversity/areas/" + areaId + "/species/" + speciesId + "?is_main=" + isMain);
      Common.showToast("更新成功", "success");
      loadHabitats();
    } catch (e) {
      Common.showToast("更新失败: " + Api.formatError(e), "error");
    }
  }

  async function removeFromArea(areaId, speciesId) {
    Common.confirm("确认从该区域移除此物种？", async function() {
      try {
        await Api.requestJson("DELETE", "/api/biodiversity/areas/" + areaId + "/species/" + speciesId);
        Common.showToast("移除成功", "success");
        loadHabitats();
      } catch (e) {
        Common.showToast("移除失败: " + Api.formatError(e), "error");
      }
    });
  }

  // ========== 数据核实 ==========
  async function verifyRecord(id) {
    Common.confirm("确认核实此监测记录？核实后状态将变为「有效」。", async function() {
      try {
        await Api.requestJson("POST", "/api/biodiversity/records/" + id + "/verify");
        Common.showToast("✅ 数据已核实", "success");
        loadObservations();
      } catch (e) {
        Common.showToast("核实失败: " + Api.formatError(e), "error");
      }
    });
  }

  // ========== 上传记录文件 ==========
  function uploadFile(recordId) {
    var content = 
      '<div style="text-align:center;padding:20px;">' +
        '<input type="file" id="recordFileInput" style="display:none;" />' +
        '<div id="dropZone" style="border:2px dashed #d1d5db;border-radius:12px;padding:40px;cursor:pointer;transition:all 0.2s;" ' +
          'onclick="document.getElementById(\'recordFileInput\').click()">' +
          '<div style="font-size:48px;margin-bottom:12px;">📁</div>' +
          '<div style="color:#666;">点击选择文件或拖拽文件到此处</div>' +
          '<div id="selectedFile" style="margin-top:12px;color:#10b981;font-weight:500;"></div>' +
        '</div>' +
        '<div id="uploadProgress" style="display:none;margin-top:16px;">' +
          '<div style="background:#e5e7eb;border-radius:8px;height:8px;overflow:hidden;">' +
            '<div id="progressBar" style="background:linear-gradient(90deg,#10b981,#059669);height:100%;width:0%;transition:width 0.3s;"></div>' +
          '</div>' +
          '<div id="progressText" style="margin-top:8px;color:#666;font-size:12px;">上传中...</div>' +
        '</div>' +
      '</div>';
    
    Common.showModal({
      title: "📤 上传记录文件",
      content: content,
      confirmText: "上传",
      onConfirm: async function(close) {
        var fileInput = document.getElementById("recordFileInput");
        if (!fileInput.files || !fileInput.files[0]) {
          Common.showToast("请先选择文件", "warning");
          return;
        }
        
        var file = fileInput.files[0];
        document.getElementById("uploadProgress").style.display = "block";
        document.getElementById("progressBar").style.width = "30%";
        
        try {
          var formData = new FormData();
          formData.append("file", file);
          
          document.getElementById("progressBar").style.width = "60%";
          
          var resp = await Api.uploadFile("/api/biodiversity/records/" + recordId + "/upload", formData);
          
          document.getElementById("progressBar").style.width = "100%";
          document.getElementById("progressText").textContent = "上传成功！";
          
          Common.showToast("✅ 文件上传成功", "success");
          setTimeout(function() {
            close();
            loadObservations();
          }, 500);
        } catch (e) {
          document.getElementById("progressBar").style.background = "#ef4444";
          document.getElementById("progressText").textContent = "上传失败";
          Common.showToast("上传失败: " + Api.formatError(e), "error");
        }
      }
    });
    
    // 绑定文件选择事件
    setTimeout(function() {
      var fileInput = document.getElementById("recordFileInput");
      var dropZone = document.getElementById("dropZone");
      
      if (fileInput) {
        fileInput.addEventListener("change", function(e) {
          var file = e.target.files[0];
          if (file) {
            document.getElementById("selectedFile").textContent = "已选择: " + file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
            dropZone.style.borderColor = "#10b981";
            dropZone.style.background = "#ecfdf5";
          }
        });
      }
      
      if (dropZone) {
        dropZone.addEventListener("dragover", function(e) {
          e.preventDefault();
          dropZone.style.borderColor = "#10b981";
          dropZone.style.background = "#ecfdf5";
        });
        dropZone.addEventListener("dragleave", function(e) {
          e.preventDefault();
          dropZone.style.borderColor = "#d1d5db";
          dropZone.style.background = "transparent";
        });
        dropZone.addEventListener("drop", function(e) {
          e.preventDefault();
          var file = e.dataTransfer.files[0];
          if (file) {
            fileInput.files = e.dataTransfer.files;
            document.getElementById("selectedFile").textContent = "已选择: " + file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
            dropZone.style.borderColor = "#10b981";
            dropZone.style.background = "#ecfdf5";
          }
        });
      }
    }, 100);
  }

  window.BiodiversityPage = { 
    init: init,
    viewSpecies: viewSpecies,
    viewRecord: viewRecord,
    uploadFile: uploadFile,
    editSpecies: editSpecies,
    deleteSpecies: deleteSpecies,
    deleteRecord: deleteRecord,
    showAddToAreaModal: showAddToAreaModal,
    toggleMainSpecies: toggleMainSpecies,
    removeFromArea: removeFromArea,
    verifyRecord: verifyRecord
  };
})();
