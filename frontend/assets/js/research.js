(function () {
  "use strict";

  var profile = null;
  var currentTab = "projects";
  var projectsCache = [];
  var collectionsCache = [];
  var achievementsCache = [];

  function init(userProfile) {
    profile = userProfile;
    initTabs();
    loadStats();
    loadProjects();
    
    var createBtn = document.getElementById("createBtn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreateModal);
    }
  }

  function isResearcher() {
    return profile && ["科研人员", "系统管理员", "公园管理人员"].includes(profile.role_type);
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
        
        if (tabName === "projects") loadProjects();
        else if (tabName === "collections") loadCollections();
        else if (tabName === "achievements") loadAchievements();
      });
    });
  }

  async function loadStats() {
    try {
      var projects = await Api.requestJson("GET", "/api/research/projects");
      projectsCache = projects || [];
      document.getElementById("statProjects").textContent = projects.length || 0;
    } catch (e) {
      document.getElementById("statProjects").textContent = "0";
    }
    
    try {
      var collections = await Api.requestJson("GET", "/api/research/collections");
      collectionsCache = collections || [];
      document.getElementById("statCollections").textContent = collections.length || 0;
    } catch (e) {
      document.getElementById("statCollections").textContent = "0";
    }
    
    try {
      var achievements = await Api.requestJson("GET", "/api/research/achievements");
      achievementsCache = achievements || [];
      document.getElementById("statAchievements").textContent = achievements.length || 0;
    } catch (e) {
      document.getElementById("statAchievements").textContent = "0";
    }
    
    try {
      var auths = await Api.requestJson("GET", "/api/research/authorizations");
      document.getElementById("statAuthorized").textContent = auths.length || 0;
    } catch (e) {
      document.getElementById("statAuthorized").textContent = "0";
    }
  }

  // ========== 科研项目 ==========
  async function loadProjects() {
    var container = document.getElementById("projectsTable");
    var notice = document.getElementById("notice");
    notice.style.display = "none";
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/research/projects");
      projectsCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无科研项目数据</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>📋 项目编号</th><th>项目名称</th><th>负责人</th><th>申请单位</th><th>研究领域</th><th>状态</th><th>立项时间</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var statusCls = item.status === "在研" ? "tag-success" : 
                        (item.status === "已结题" ? "tag-info" : "tag-warning");
        var fieldCls = item.research_field === "物种保护" ? "tag-purple" : 
                       (item.research_field === "生态修复" ? "tag-success" : "tag-info");
        html += '<tr>' +
          '<td><span class="tag tag-info">' + (item.project_id || '-') + '</span></td>' +
          '<td><strong>' + (item.project_name || '-') + '</strong></td>' +
          '<td>' + (item.leader_id || '-') + '</td>' +
          '<td>' + (item.apply_unit || '-') + '</td>' +
          '<td><span class="tag ' + fieldCls + '">' + (item.research_field || '-') + '</span></td>' +
          '<td><span class="tag ' + statusCls + '">' + (item.status || '在研') + '</span></td>' +
          '<td>' + (item.approval_date ? item.approval_date.split('T')[0] : '-') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="ResearchPage.viewProject(\'' + item.project_id + '\')">详情</button> ' +
            '<button class="btn btn-sm btn-primary" onclick="ResearchPage.editProject(\'' + item.project_id + '\')">编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="ResearchPage.deleteProject(\'' + item.project_id + '\')">删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      if (e && e.status === 403) {
        notice.textContent = "当前角色无权限访问科研模块（需要 科研人员/系统管理员/公园管理人员）";
        notice.style.display = "block";
        container.innerHTML = "";
      } else {
        container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
      }
    }
  }

  // ========== 数据采集记录 ==========
  async function loadCollections() {
    var container = document.getElementById("collectionsTable");
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/research/collections");
      collectionsCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无采集记录</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>🧪 采集编号</th><th>所属项目</th><th>采集人</th><th>采集时间</th><th>区域编号</th><th>数据来源</th><th>采集内容</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var sourceCls = item.data_source === "实地采集" ? "tag-success" : "tag-info";
        html += '<tr>' +
          '<td><span class="tag tag-purple">' + (item.collection_id || '-') + '</span></td>' +
          '<td><span class="tag tag-info">' + (item.project_id || '-') + '</span></td>' +
          '<td>' + (item.collector_id || '-') + '</td>' +
          '<td>' + (item.collection_time ? Common.formatDate(item.collection_time) : '-') + '</td>' +
          '<td>' + (item.area_id || '-') + '</td>' +
          '<td><span class="tag ' + sourceCls + '">' + (item.data_source || '-') + '</span></td>' +
          '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + (item.content || '-') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="ResearchPage.viewCollection(\'' + item.collection_id + '\')">详情</button> ' +
            '<button class="btn btn-sm btn-primary" onclick="ResearchPage.editCollection(\'' + item.collection_id + '\')">编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="ResearchPage.deleteCollection(\'' + item.collection_id + '\')">删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 科研成果 ==========
  async function loadAchievements() {
    var container = document.getElementById("achievementsTable");
    Common.setContentLoading(container);
    
    try {
      var data = await Api.requestJson("GET", "/api/research/achievements");
      achievementsCache = data || [];
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="notice" style="text-align:center;padding:40px;">暂无科研成果</div>';
        return;
      }
      
      var html = '<table class="data-table"><thead><tr>' +
        '<th>📄 成果编号</th><th>所属项目</th><th>成果名称</th><th>成果类型</th><th>发表时间</th><th>共享权限</th><th>操作</th>' +
        '</tr></thead><tbody>';
      
      data.forEach(function(item) {
        var permCls = item.share_permission === "公开" ? "tag-success" : 
                      (item.share_permission === "保密" ? "tag-danger" : "tag-warning");
        var typeCls = item.achievement_type === "论文" ? "tag-info" : 
                      (item.achievement_type === "专利" ? "tag-purple" : "tag-warning");
        html += '<tr>' +
          '<td><span class="tag tag-info">' + (item.achievement_id || '-') + '</span></td>' +
          '<td><span class="tag tag-purple">' + (item.project_id || '-') + '</span></td>' +
          '<td><strong>' + (item.title || '-') + '</strong></td>' +
          '<td><span class="tag ' + typeCls + '">' + (item.achievement_type || '-') + '</span></td>' +
          '<td>' + (item.publish_date ? item.publish_date.split('T')[0] : '-') + '</td>' +
          '<td><span class="tag ' + permCls + '">' + (item.share_permission || '-') + '</span></td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-sm btn-secondary" onclick="ResearchPage.viewAchievement(\'' + item.achievement_id + '\')">详情</button> ' +
            (item.share_permission === "保密" ? '<button class="btn btn-sm btn-warning" onclick="ResearchPage.manageAuth(\'' + item.achievement_id + '\')">授权</button> ' : '') +
            '<button class="btn btn-sm btn-primary" onclick="ResearchPage.editAchievement(\'' + item.achievement_id + '\')">编辑</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="ResearchPage.deleteAchievement(\'' + item.achievement_id + '\')">删除</button>' +
          '</td>' +
          '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="notice notice-danger">加载失败: ' + Api.formatError(e) + '</div>';
    }
  }

  // ========== 创建弹窗 ==========
  function showCreateModal() {
    if (!isResearcher()) {
      Common.showToast("您没有权限执行此操作", "error");
      return;
    }
    
    if (currentTab === "projects") showCreateProjectModal();
    else if (currentTab === "collections") showCreateCollectionModal();
    else if (currentTab === "achievements") showCreateAchievementModal();
  }

  function showCreateProjectModal() {
    var content = 
      '<form id="projectForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">项目编号 *</label><input class="field-input" name="project_id" value="PRJ_' + Date.now() + '" required /></div>' +
          '<div class="field"><label class="field-label">项目名称 *</label><input class="field-input" name="project_name" placeholder="请输入项目名称" required /></div>' +
          '<div class="field"><label class="field-label">负责人ID *</label><input class="field-input" name="leader_id" placeholder="负责人工号" required /></div>' +
          '<div class="field"><label class="field-label">申请单位 *</label><input class="field-input" name="apply_unit" placeholder="申请单位名称" required /></div>' +
          '<div class="field"><label class="field-label">立项日期 *</label><input class="field-input" name="approval_date" type="date" value="' + new Date().toISOString().split('T')[0] + '" required /></div>' +
          '<div class="field"><label class="field-label">研究领域 *</label>' +
            '<select class="field-select" name="research_field">' +
              '<option value="物种保护">物种保护</option>' +
              '<option value="生态修复">生态修复</option>' +
              '<option value="环境监测">环境监测</option>' +
              '<option value="生物多样性">生物多样性</option>' +
              '<option value="其他">其他</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">项目状态</label>' +
            '<select class="field-select" name="status">' +
              '<option value="在研">在研</option>' +
              '<option value="暂停">暂停</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "📋 新建科研项目",
      content: content,
      confirmText: "创建项目",
      onConfirm: async function(close) {
        var form = document.getElementById("projectForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/research/projects", {
            project_id: formData.get("project_id"),
            project_name: formData.get("project_name"),
            leader_id: formData.get("leader_id"),
            apply_unit: formData.get("apply_unit"),
            approval_date: formData.get("approval_date"),
            research_field: formData.get("research_field"),
            status: formData.get("status")
          });
          Common.showToast("✅ 项目创建成功", "success");
          close();
          loadProjects();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function showCreateCollectionModal() {
    if (projectsCache.length === 0) {
      Common.showToast("请先创建科研项目", "warning");
      return;
    }
    
    // 只显示在研项目
    var activeProjects = projectsCache.filter(function(p) { return p.status === "在研"; });
    if (activeProjects.length === 0) {
      Common.showToast("暂无在研项目，已结题项目不可新增采集记录", "warning");
      return;
    }
    
    var projectOptions = activeProjects.map(function(p) {
      return '<option value="' + p.project_id + '">' + p.project_id + ' - ' + p.project_name + '</option>';
    }).join('');
    
    var content = 
      '<form id="collectionForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">采集编号 *</label><input class="field-input" name="collection_id" value="COL_' + Date.now() + '" required /></div>' +
          '<div class="field"><label class="field-label">所属项目 *</label><select class="field-select" name="project_id">' + projectOptions + '</select></div>' +
          '<div class="field"><label class="field-label">采集人ID *</label><input class="field-input" name="collector_id" placeholder="采集人工号" required /></div>' +
          '<div class="field"><label class="field-label">采集时间 *</label><input class="field-input" name="collection_time" type="datetime-local" value="' + new Date().toISOString().slice(0, 16) + '" required /></div>' +
          '<div class="field"><label class="field-label">区域编号 *</label><input class="field-input" name="area_id" placeholder="如：A1, B2" required /></div>' +
          '<div class="field"><label class="field-label">数据来源 *</label>' +
            '<select class="field-select" name="data_source">' +
              '<option value="实地采集">实地采集</option>' +
              '<option value="系统调用">系统调用（调用已有监测数据）</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;">' +
          '<label class="field-label">采集内容 *</label>' +
          '<textarea class="field-input" name="content" rows="3" placeholder="样本编号 / 监测数据编号 / 调查记录内容" required></textarea>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">备注</label>' +
          '<textarea class="field-input" name="remarks" rows="2" placeholder="可选备注信息"></textarea>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "🧪 新建采集记录",
      content: content,
      confirmText: "创建记录",
      onConfirm: async function(close) {
        var form = document.getElementById("collectionForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/research/collections", {
            collection_id: formData.get("collection_id"),
            project_id: formData.get("project_id"),
            collector_id: formData.get("collector_id"),
            collection_time: formData.get("collection_time") + ":00",
            area_id: formData.get("area_id"),
            data_source: formData.get("data_source"),
            content: formData.get("content"),
            remarks: formData.get("remarks") || null
          });
          Common.showToast("✅ 采集记录创建成功", "success");
          close();
          loadCollections();
          loadStats();
        } catch (e) {
          Common.showToast("创建失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function showCreateAchievementModal() {
    if (projectsCache.length === 0) {
      Common.showToast("请先创建科研项目", "warning");
      return;
    }
    
    var projectOptions = projectsCache.map(function(p) {
      return '<option value="' + p.project_id + '">' + p.project_id + ' - ' + p.project_name + '</option>';
    }).join('');
    
    var content = 
      '<form id="achievementForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">成果编号 *</label><input class="field-input" name="achievement_id" value="ACH_' + Date.now() + '" required /></div>' +
          '<div class="field"><label class="field-label">所属项目 *</label><select class="field-select" name="project_id">' + projectOptions + '</select></div>' +
          '<div class="field"><label class="field-label">成果名称 *</label><input class="field-input" name="title" placeholder="论文/报告/专利名称" required /></div>' +
          '<div class="field"><label class="field-label">成果类型 *</label>' +
            '<select class="field-select" name="achievement_type">' +
              '<option value="论文">论文</option>' +
              '<option value="报告">报告</option>' +
              '<option value="专利">专利</option>' +
              '<option value="软件著作权">软件著作权</option>' +
              '<option value="其他">其他</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">发表/提交时间 *</label><input class="field-input" name="publish_date" type="date" value="' + new Date().toISOString().split('T')[0] + '" required /></div>' +
          '<div class="field"><label class="field-label">共享权限 *</label>' +
            '<select class="field-select" name="share_permission">' +
              '<option value="公开">公开（所有人可查看）</option>' +
              '<option value="内部共享">内部共享（科研人员可查看）</option>' +
              '<option value="保密">保密（仅授权人员可查看）</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">文件路径 *</label><input class="field-input" name="file_path" placeholder="/research/files/xxx.pdf" required /></div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "📄 新建科研成果",
      content: content,
      confirmText: "提交成果",
      onConfirm: async function(close) {
        var form = document.getElementById("achievementForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("POST", "/api/research/achievements", {
            achievement_id: formData.get("achievement_id"),
            project_id: formData.get("project_id"),
            title: formData.get("title"),
            achievement_type: formData.get("achievement_type"),
            publish_date: formData.get("publish_date"),
            share_permission: formData.get("share_permission"),
            file_path: formData.get("file_path")
          });
          Common.showToast("✅ 成果提交成功", "success");
          close();
          loadAchievements();
          loadStats();
        } catch (e) {
          Common.showToast("提交失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 查看详情 ==========
  function viewProject(projectId) {
    var p = projectsCache.find(function(x) { return x.project_id === projectId; });
    if (!p) { Common.showToast("项目不存在", "error"); return; }
    
    var content = 
      '<div class="detail-grid" style="display:grid;grid-template-columns:120px 1fr;gap:12px;line-height:2;">' +
        '<div style="color:#666;">项目编号</div><div><strong>' + p.project_id + '</strong></div>' +
        '<div style="color:#666;">项目名称</div><div>' + p.project_name + '</div>' +
        '<div style="color:#666;">负责人ID</div><div>' + p.leader_id + '</div>' +
        '<div style="color:#666;">申请单位</div><div>' + p.apply_unit + '</div>' +
        '<div style="color:#666;">研究领域</div><div><span class="tag tag-purple">' + p.research_field + '</span></div>' +
        '<div style="color:#666;">项目状态</div><div><span class="tag ' + (p.status === "在研" ? "tag-success" : "tag-info") + '">' + p.status + '</span></div>' +
        '<div style="color:#666;">立项时间</div><div>' + (p.approval_date ? p.approval_date.split('T')[0] : '-') + '</div>' +
        '<div style="color:#666;">结题时间</div><div>' + (p.conclusion_date ? p.conclusion_date.split('T')[0] : '未结题') + '</div>' +
      '</div>';
    
    Common.showModal({ title: "📋 项目详情", content: content, confirmText: "关闭", onConfirm: function(c) { c(); } });
  }

  function viewCollection(collectionId) {
    var c = collectionsCache.find(function(x) { return x.collection_id === collectionId; });
    if (!c) { Common.showToast("记录不存在", "error"); return; }
    
    var content = 
      '<div class="detail-grid" style="display:grid;grid-template-columns:120px 1fr;gap:12px;line-height:2;">' +
        '<div style="color:#666;">采集编号</div><div><strong>' + c.collection_id + '</strong></div>' +
        '<div style="color:#666;">所属项目</div><div>' + c.project_id + '</div>' +
        '<div style="color:#666;">采集人ID</div><div>' + c.collector_id + '</div>' +
        '<div style="color:#666;">采集时间</div><div>' + Common.formatDate(c.collection_time) + '</div>' +
        '<div style="color:#666;">区域编号</div><div>' + c.area_id + '</div>' +
        '<div style="color:#666;">数据来源</div><div><span class="tag ' + (c.data_source === "实地采集" ? "tag-success" : "tag-info") + '">' + c.data_source + '</span></div>' +
        '<div style="color:#666;">采集内容</div><div>' + c.content + '</div>' +
        '<div style="color:#666;">备注</div><div>' + (c.remarks || '无') + '</div>' +
      '</div>';
    
    Common.showModal({ title: "🧪 采集记录详情", content: content, confirmText: "关闭", onConfirm: function(cl) { cl(); } });
  }

  function viewAchievement(achievementId) {
    var a = achievementsCache.find(function(x) { return x.achievement_id === achievementId; });
    if (!a) { Common.showToast("成果不存在", "error"); return; }
    
    var content = 
      '<div class="detail-grid" style="display:grid;grid-template-columns:120px 1fr;gap:12px;line-height:2;">' +
        '<div style="color:#666;">成果编号</div><div><strong>' + a.achievement_id + '</strong></div>' +
        '<div style="color:#666;">所属项目</div><div>' + a.project_id + '</div>' +
        '<div style="color:#666;">成果名称</div><div>' + a.title + '</div>' +
        '<div style="color:#666;">成果类型</div><div><span class="tag tag-info">' + a.achievement_type + '</span></div>' +
        '<div style="color:#666;">发表时间</div><div>' + (a.publish_date ? a.publish_date.split('T')[0] : '-') + '</div>' +
        '<div style="color:#666;">共享权限</div><div><span class="tag ' + (a.share_permission === "公开" ? "tag-success" : (a.share_permission === "保密" ? "tag-danger" : "tag-warning")) + '">' + a.share_permission + '</span></div>' +
        '<div style="color:#666;">文件路径</div><div><code>' + a.file_path + '</code></div>' +
      '</div>';
    
    Common.showModal({ title: "📄 成果详情", content: content, confirmText: "关闭", onConfirm: function(cl) { cl(); } });
  }

  // ========== 编辑 ==========
  function editProject(projectId) {
    var p = projectsCache.find(function(x) { return x.project_id === projectId; });
    if (!p) { Common.showToast("项目不存在", "error"); return; }
    
    var content = 
      '<form id="editProjectForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">项目名称</label><input class="field-input" name="project_name" value="' + (p.project_name || '') + '" /></div>' +
          '<div class="field"><label class="field-label">负责人ID</label><input class="field-input" name="leader_id" value="' + (p.leader_id || '') + '" /></div>' +
          '<div class="field"><label class="field-label">申请单位</label><input class="field-input" name="apply_unit" value="' + (p.apply_unit || '') + '" /></div>' +
          '<div class="field"><label class="field-label">结题日期</label><input class="field-input" name="conclusion_date" type="date" value="' + (p.conclusion_date ? p.conclusion_date.split('T')[0] : '') + '" /></div>' +
          '<div class="field"><label class="field-label">项目状态</label>' +
            '<select class="field-select" name="status">' +
              '<option value="在研"' + (p.status === "在研" ? ' selected' : '') + '>在研</option>' +
              '<option value="已结题"' + (p.status === "已结题" ? ' selected' : '') + '>已结题</option>' +
              '<option value="暂停"' + (p.status === "暂停" ? ' selected' : '') + '>暂停</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑项目 - " + projectId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editProjectForm");
        var formData = new FormData(form);
        var payload = {};
        if (formData.get("project_name")) payload.project_name = formData.get("project_name");
        if (formData.get("leader_id")) payload.leader_id = formData.get("leader_id");
        if (formData.get("apply_unit")) payload.apply_unit = formData.get("apply_unit");
        if (formData.get("conclusion_date")) payload.conclusion_date = formData.get("conclusion_date");
        payload.status = formData.get("status");
        
        try {
          await Api.requestJson("PUT", "/api/research/projects/" + projectId, payload);
          Common.showToast("✅ 更新成功", "success");
          close();
          loadProjects();
          loadStats();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function editCollection(collectionId) {
    var c = collectionsCache.find(function(x) { return x.collection_id === collectionId; });
    if (!c) { Common.showToast("记录不存在", "error"); return; }
    
    // 检查项目是否已结题
    var project = projectsCache.find(function(p) { return p.project_id === c.project_id; });
    var isEnded = project && project.status === "已结题";
    
    var content = 
      '<form id="editCollectionForm">' +
        (isEnded ? '<div class="notice notice-warning" style="margin-bottom:12px;">⚠️ 项目已结题，仅可修改备注</div>' : '') +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">采集内容</label><textarea class="field-input" name="content" rows="3"' + (isEnded ? ' disabled' : '') + '>' + (c.content || '') + '</textarea></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;">' +
          '<label class="field-label">备注（已结题项目仅可补充备注）</label>' +
          '<textarea class="field-input" name="remarks" rows="2">' + (c.remarks || '') + '</textarea>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑采集记录 - " + collectionId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editCollectionForm");
        var formData = new FormData(form);
        var payload = { remarks: formData.get("remarks") };
        if (!isEnded) payload.content = formData.get("content");
        
        try {
          await Api.requestJson("PUT", "/api/research/collections/" + collectionId, payload);
          Common.showToast("✅ 更新成功", "success");
          close();
          loadCollections();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  function editAchievement(achievementId) {
    var a = achievementsCache.find(function(x) { return x.achievement_id === achievementId; });
    if (!a) { Common.showToast("成果不存在", "error"); return; }
    
    var content = 
      '<form id="editAchievementForm">' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label">成果名称</label><input class="field-input" name="title" value="' + (a.title || '') + '" /></div>' +
          '<div class="field"><label class="field-label">共享权限</label>' +
            '<select class="field-select" name="share_permission">' +
              '<option value="公开"' + (a.share_permission === "公开" ? ' selected' : '') + '>公开</option>' +
              '<option value="内部共享"' + (a.share_permission === "内部共享" ? ' selected' : '') + '>内部共享</option>' +
              '<option value="保密"' + (a.share_permission === "保密" ? ' selected' : '') + '>保密</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label class="field-label">文件路径</label><input class="field-input" name="file_path" value="' + (a.file_path || '') + '" /></div>' +
        '</div>' +
      '</form>';
    
    Common.showModal({
      title: "编辑成果 - " + achievementId,
      content: content,
      confirmText: "保存",
      onConfirm: async function(close) {
        var form = document.getElementById("editAchievementForm");
        var formData = new FormData(form);
        
        try {
          await Api.requestJson("PUT", "/api/research/achievements/" + achievementId, {
            title: formData.get("title"),
            share_permission: formData.get("share_permission"),
            file_path: formData.get("file_path")
          });
          Common.showToast("✅ 更新成功", "success");
          close();
          loadAchievements();
        } catch (e) {
          Common.showToast("更新失败: " + Api.formatError(e), "error");
        }
      }
    });
  }

  // ========== 删除 ==========
  function deleteProject(projectId) {
    Common.confirm("确认删除项目 " + projectId + "？关联的采集记录和成果也会受影响。", async function() {
      try {
        await Api.requestJson("DELETE", "/api/research/projects/" + projectId);
        Common.showToast("删除成功", "success");
        loadProjects();
        loadStats();
      } catch (e) {
        Common.showToast("删除失败: " + Api.formatError(e), "error");
      }
    });
  }

  function deleteCollection(collectionId) {
    Common.confirm("确认删除采集记录 " + collectionId + "？", async function() {
      try {
        await Api.requestJson("DELETE", "/api/research/collections/" + collectionId);
        Common.showToast("删除成功", "success");
        loadCollections();
        loadStats();
      } catch (e) {
        Common.showToast("删除失败: " + Api.formatError(e), "error");
      }
    });
  }

  function deleteAchievement(achievementId) {
    Common.confirm("确认删除成果 " + achievementId + "？", async function() {
      try {
        await Api.requestJson("DELETE", "/api/research/achievements/" + achievementId);
        Common.showToast("删除成功", "success");
        loadAchievements();
        loadStats();
      } catch (e) {
        Common.showToast("删除失败: " + Api.formatError(e), "error");
      }
    });
  }

  // ========== 授权管理 ==========
  async function manageAuth(achievementId) {
    var a = achievementsCache.find(function(x) { return x.achievement_id === achievementId; });
    if (!a || a.share_permission !== "保密") {
      Common.showToast("仅保密成果需要授权管理", "warning");
      return;
    }
    
    var auths = [];
    try {
      auths = await Api.requestJson("GET", "/api/research/authorizations?achievement_id=" + achievementId);
    } catch (e) {}
    
    var authList = auths.length > 0 
      ? auths.map(function(auth) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f8fafc;border-radius:6px;margin-bottom:6px;">' +
            '<span>👤 ' + auth.user_id + '</span>' +
            '<button class="btn btn-sm btn-danger" onclick="ResearchPage.revokeAuth(\'' + achievementId + '\', \'' + auth.user_id + '\')">撤销</button>' +
          '</div>';
        }).join('')
      : '<div class="notice" style="padding:12px;text-align:center;">暂无授权记录</div>';
    
    var content = 
      '<div style="margin-bottom:16px;">' +
        '<div style="font-weight:600;margin-bottom:8px;">📄 ' + a.title + '</div>' +
        '<div style="color:#666;font-size:13px;">当前授权人员：</div>' +
      '</div>' +
      '<div style="max-height:200px;overflow-y:auto;margin-bottom:16px;">' + authList + '</div>' +
      '<div style="border-top:1px solid #e5e7eb;padding-top:12px;">' +
        '<label class="field-label">添加授权用户</label>' +
        '<div style="display:flex;gap:8px;">' +
          '<input class="field-input" id="newAuthUserId" placeholder="输入用户ID" style="flex:1;" />' +
          '<button class="btn btn-primary" onclick="ResearchPage.addAuth(\'' + achievementId + '\')">添加授权</button>' +
        '</div>' +
      '</div>';
    
    Common.showModal({
      title: "🔐 授权管理 - " + achievementId,
      content: content,
      confirmText: "关闭",
      onConfirm: function(close) { close(); loadAchievements(); }
    });
  }

  async function addAuth(achievementId) {
    var userId = document.getElementById("newAuthUserId").value.trim();
    if (!userId) {
      Common.showToast("请输入用户ID", "warning");
      return;
    }
    
    try {
      await Api.requestJson("POST", "/api/research/authorizations", {
        achievement_id: achievementId,
        user_id: userId
      });
      Common.showToast("授权成功", "success");
      manageAuth(achievementId);  // 刷新弹窗
    } catch (e) {
      Common.showToast("授权失败: " + Api.formatError(e), "error");
    }
  }

  async function revokeAuth(achievementId, userId) {
    try {
      await Api.requestJson("POST", "/api/research/authorizations/revoke?achievement_id=" + achievementId + "&user_id=" + userId);
      Common.showToast("已撤销授权", "success");
      manageAuth(achievementId);  // 刷新弹窗
    } catch (e) {
      Common.showToast("撤销失败: " + Api.formatError(e), "error");
    }
  }

  window.ResearchPage = { 
    init: init,
    viewProject: viewProject,
    viewCollection: viewCollection,
    viewAchievement: viewAchievement,
    editProject: editProject,
    editCollection: editCollection,
    editAchievement: editAchievement,
    deleteProject: deleteProject,
    deleteCollection: deleteCollection,
    deleteAchievement: deleteAchievement,
    manageAuth: manageAuth,
    addAuth: addAuth,
    revokeAuth: revokeAuth
  };
})();

