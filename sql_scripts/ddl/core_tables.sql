USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.[用户]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[用户](
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        phone NVARCHAR(20) NULL,
        role_type NVARCHAR(20) NOT NULL,
        created_time DATETIME2 NOT NULL CONSTRAINT DF_用户_created_time DEFAULT(SYSUTCDATETIME()),
        CONSTRAINT CHK_用户角色 CHECK (role_type IN (N'系统管理员', N'生态监测员', N'数据分析师', N'技术人员', N'游客', N'执法人员', N'科研人员', N'公园管理人员'))
    );

    CREATE INDEX IX_用户_role_type ON dbo.[用户](role_type);
    CREATE INDEX IX_用户_phone ON dbo.[用户](phone);
END
GO

IF OBJECT_ID(N'dbo.[角色权限]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[角色权限](
        role_type NVARCHAR(20) NOT NULL,
        permission_code NVARCHAR(50) NOT NULL,
        permission_name NVARCHAR(100) NULL,
        description NVARCHAR(200) NULL,
        CONSTRAINT PK_角色权限 PRIMARY KEY(role_type, permission_code)
    );

    CREATE INDEX IX_角色权限_role_type ON dbo.[角色权限](role_type);
END
GO

IF OBJECT_ID(N'dbo.[用户会话]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[用户会话](
        session_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        login_time DATETIME2 NOT NULL CONSTRAINT DF_用户会话_login_time DEFAULT(SYSUTCDATETIME()),
        last_activity DATETIME2 NOT NULL CONSTRAINT DF_用户会话_last_activity DEFAULT(SYSUTCDATETIME()),
        is_active INT NOT NULL CONSTRAINT DF_用户会话_is_active DEFAULT(1),
        ip_address NVARCHAR(50) NULL,
        CONSTRAINT FK_用户会话_user FOREIGN KEY(user_id) REFERENCES dbo.[用户](id)
    );

    CREATE INDEX IX_用户会话_user_active ON dbo.[用户会话](user_id, is_active);
END
GO

IF OBJECT_ID(N'dbo.[登录尝试]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[登录尝试](
        attempt_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id INT NULL,
        phone NVARCHAR(20) NULL,
        attempt_time DATETIME2 NOT NULL CONSTRAINT DF_登录尝试_attempt_time DEFAULT(SYSUTCDATETIME()),
        success INT NOT NULL CONSTRAINT DF_登录尝试_success DEFAULT(0),
        ip_address NVARCHAR(50) NULL,
        CONSTRAINT FK_登录尝试_user FOREIGN KEY(user_id) REFERENCES dbo.[用户](id)
    );

    CREATE INDEX IX_登录尝试_user_time ON dbo.[登录尝试](user_id, attempt_time);
    CREATE INDEX IX_登录尝试_phone_time ON dbo.[登录尝试](phone, attempt_time);
END
GO

