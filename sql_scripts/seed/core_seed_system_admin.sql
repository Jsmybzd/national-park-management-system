USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.[用户]', N'U') IS NULL
BEGIN
    RAISERROR(N'缺少 dbo.[用户] 表，请先执行 sql_scripts/ddl/core_tables.sql', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.[用户] WHERE phone = N'13800000001')
    INSERT INTO dbo.[用户](name, phone, role_type) VALUES (N'系统管理员', N'13800000001', N'系统管理员');
GO

IF OBJECT_ID(N'dbo.[角色权限]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'系统管理员' AND permission_code=N'USER_MANAGE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'系统管理员', N'USER_MANAGE', N'用户管理');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'系统管理员' AND permission_code=N'DATA_VIEW_ALL')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'系统管理员', N'DATA_VIEW_ALL', N'查看所有数据');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'系统管理员' AND permission_code=N'DATA_EDIT_ALL')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'系统管理员', N'DATA_EDIT_ALL', N'编辑所有数据');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'系统管理员' AND permission_code=N'SYSTEM_CONFIG')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'系统管理员', N'SYSTEM_CONFIG', N'系统配置');
    IF NOT EXISTS (SELECT 1 FROM dbo.[角色权限] WHERE role_type=N'系统管理员' AND permission_code=N'BACKUP_RESTORE')
        INSERT INTO dbo.[角色权限](role_type, permission_code, permission_name) VALUES (N'系统管理员', N'BACKUP_RESTORE', N'备份恢复');
END
GO
