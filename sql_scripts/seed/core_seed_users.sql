USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.[用户]', N'U') IS NULL
BEGIN
    RAISERROR(N'缺少 dbo.[用户] 表，请先执行 sql_scripts/ddl/core_tables.sql', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.[用户] WHERE phone = N'13800000007')
    INSERT INTO dbo.[用户](name, phone, role_type) VALUES (N'张三', N'13800000007', N'游客');

IF NOT EXISTS (SELECT 1 FROM dbo.[用户] WHERE phone = N'13800000005')
    INSERT INTO dbo.[用户](name, phone, role_type) VALUES (N'李四', N'13800000005', N'公园管理人员');
GO

IF OBJECT_ID(N'dbo.[角色权限]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'游客' AND permission_code=N'VISITOR_RESERVE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'游客', N'VISITOR_RESERVE', N'预约游览');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'游客' AND permission_code=N'VISITOR_INFO_VIEW')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'游客', N'VISITOR_INFO_VIEW', N'查看游客信息');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'游客' AND permission_code=N'PARK_INFO_VIEW')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'游客', N'PARK_INFO_VIEW', N'查看园区信息');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'游客' AND permission_code=N'FEEDBACK_SUBMIT')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'游客', N'FEEDBACK_SUBMIT', N'提交反馈');

    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'公园管理人员' AND permission_code=N'PARK_OVERVIEW_VIEW')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'公园管理人员', N'PARK_OVERVIEW_VIEW', N'查看园区总览');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'公园管理人员' AND permission_code=N'PROJECT_APPROVE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'公园管理人员', N'PROJECT_APPROVE', N'项目审批');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'公园管理人员' AND permission_code=N'FLOW_CONTROL_MANAGE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'公园管理人员', N'FLOW_CONTROL_MANAGE', N'流量控制管理');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'公园管理人员' AND permission_code=N'ENFORCE_SCHEDULE_MANAGE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'公园管理人员', N'ENFORCE_SCHEDULE_MANAGE', N'执法调度管理');
END
GO
