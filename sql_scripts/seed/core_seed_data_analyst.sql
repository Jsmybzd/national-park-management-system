USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.[用户]', N'U') IS NULL
BEGIN
    RAISERROR(N'缺少 dbo.[用户] 表，请先执行 sql_scripts/ddl/core_tables.sql', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.[用户] WHERE phone = N'13800000002')
    INSERT INTO dbo.[用户](name, phone, role_type) VALUES (N'数据分析师', N'13800000002', N'数据分析师');
GO

IF OBJECT_ID(N'dbo.[角色权限]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'数据分析师' AND permission_code=N'DATA_VIEW_ALL')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'数据分析师', N'DATA_VIEW_ALL', N'查看所有数据');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'数据分析师' AND permission_code=N'DATA_ANALYSIS')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'数据分析师', N'DATA_ANALYSIS', N'数据分析');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'数据分析师' AND permission_code=N'REPORT_GENERATE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'数据分析师', N'REPORT_GENERATE', N'生成报告');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'数据分析师' AND permission_code=N'THRESHOLD_MANAGE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'数据分析师', N'THRESHOLD_MANAGE', N'阈值管理');
END
GO
