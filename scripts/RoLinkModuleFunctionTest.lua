CONFIG = {
    Version = "1.0.0",

    Enable_Notify_Test = {
        Short_Description = "Send an in-game notification during the diagnostic run.",
        Type = "Bool",
        Default = true,
        Options = {}
    },

    Enable_CreateUI_Test = {
        Short_Description = "Create a temporary diagnostic ScreenGui for one player or all players.",
        Type = "Bool",
        Default = false,
        Options = {}
    },

    Enable_External_Read_Tests = {
        Short_Description = "Call read-only Ro-Link web helpers such as GetDiscordChannels, GetUserData, GetReports, and GetReport.",
        Type = "Bool",
        Default = false,
        Options = {}
    },

    Enable_Report_Write_Tests = {
        Short_Description = "Create and update a test report through Ro-Link. Leave off unless you want API write checks.",
        Type = "Bool",
        Default = false,
        Options = {}
    },

    Enable_Bot_Message_Test = {
        Short_Description = "Send a Discord bot test message. Requires Discord_Channel_Id.",
        Type = "Bool",
        Default = false,
        Options = {}
    },

    Test_Player = {
        Short_Description = "Player username or all. Used by Notify, CreateUI, and FindPlayer tests.",
        Type = "String",
        Default = "all",
        Options = {}
    },

    Test_User = {
        Short_Description = "Roblox username, Roblox UserId, or player name used by user-data tests.",
        Type = "String",
        Default = "",
        Options = {}
    },

    Discord_Channel_Id = {
        Short_Description = "Discord channel ID used only when Enable_Bot_Message_Test is enabled.",
        Type = "String",
        Default = "",
        Options = {}
    },

    Existing_Report_Id = {
        Short_Description = "Optional report ID used by GetReport and UpdateReport tests.",
        Type = "String",
        Default = "",
        Options = {}
    },

    Live_Test_Message = {
        Short_Description = "Send this live value from the dashboard to test LIVE CONFIG delivery.",
        Type = "String",
        Default = "Live CONFIG test from Ro-Link.",
        LIVE = true,
        ButtonText = "Run Live Test",
        Options = {}
    }
}

local Module = {}

local function trim(value)
    return tostring(value or ""):match("^%s*(.-)%s*$") or ""
end

local function shallowCount(value)
    if type(value) ~= "table" then
        return 0
    end

    local count = 0
    for _ in pairs(value) do
        count += 1
    end
    return count
end

local function setting(context, key, defaultValue)
    local settings = context and context.Settings or {}
    local value = settings[key]
    if value == nil then
        return defaultValue
    end
    return value
end

local function addResult(results, name, ok, detail)
    table.insert(results, {
        name = name,
        ok = ok == true,
        detail = trim(detail),
    })
end

local function callTest(results, name, callback)
    local ok, first, second = pcall(callback)
    if ok then
        if first == false then
            addResult(results, name, false, second or "Returned false.")
        else
            addResult(results, name, true, second or first or "OK")
        end
    else
        addResult(results, name, false, first)
    end
end

local function valueSummary(value)
    local valueType = typeof(value)
    if valueType == "table" then
        return "table(" .. tostring(shallowCount(value)) .. ")"
    end
    if valueType == "Instance" then
        return value.ClassName .. ":" .. value.Name
    end
    return tostring(value)
end

local function notifyTarget(context)
    local target = trim(setting(context, "Test_Player", "all"))
    return target ~= "" and target or "all"
end

local function getTestUser(context)
    local configured = trim(setting(context, "Test_User", ""))
    if configured ~= "" then
        return configured
    end

    local players = {}
    if type(context.GetPlayers) == "function" then
        local ok, result = pcall(context.GetPlayers)
        if ok and type(result) == "table" then
            players = result
        end
    end

    return players[1] and players[1].Name or ""
end

local function printSummary(context, reason, results)
    local passed = 0
    local failed = 0

    for _, result in ipairs(results) do
        if result.ok then
            passed += 1
        else
            failed += 1
        end

        context.Log(string.format(
            "[%s] %s: %s%s",
            result.ok and "PASS" or "FAIL",
            result.name,
            result.detail ~= "" and result.detail or "OK",
            result.ok and "" or " <---"
        ))
    end

    local summary = string.format(
        "Ro-Link module function test complete (%s): %d passed, %d failed.",
        reason,
        passed,
        failed
    )
    context.Log(summary)

    if setting(context, "Enable_Notify_Test", true) and type(context.Notify) == "function" then
        pcall(context.Notify, notifyTarget(context), summary, failed == 0)
    end

    return failed == 0, summary, results
end

local function createDiagnosticUi(context)
    local tree = {
        ClassName = "Frame",
        Properties = {
            Name = "RoLinkModuleFunctionTestFrame",
            AnchorPoint = Vector2.new(0.5, 0),
            Position = UDim2.new(0.5, 0, 0, 80),
            Size = UDim2.new(0, 360, 0, 92),
            BackgroundColor3 = Color3.fromRGB(7, 12, 24),
            BorderSizePixel = 0,
        },
        Children = {
            {
                ClassName = "UICorner",
                Properties = {
                    CornerRadius = UDim.new(0, 10),
                },
            },
            {
                ClassName = "TextLabel",
                Properties = {
                    Name = "Title",
                    BackgroundTransparency = 1,
                    Position = UDim2.new(0, 16, 0, 12),
                    Size = UDim2.new(1, -32, 0, 22),
                    Font = Enum.Font.GothamBold,
                    Text = "Ro-Link Module Function Test",
                    TextColor3 = Color3.fromRGB(125, 211, 252),
                    TextSize = 16,
                    TextXAlignment = Enum.TextXAlignment.Left,
                },
            },
            {
                ClassName = "TextLabel",
                Properties = {
                    Name = "Body",
                    BackgroundTransparency = 1,
                    Position = UDim2.new(0, 16, 0, 40),
                    Size = UDim2.new(1, -32, 0, 40),
                    Font = Enum.Font.GothamMedium,
                    Text = "CreateUI helper rendered this temporary panel.",
                    TextColor3 = Color3.fromRGB(226, 232, 240),
                    TextSize = 13,
                    TextWrapped = true,
                    TextXAlignment = Enum.TextXAlignment.Left,
                },
            },
        },
    }

    return context.CreateUI(notifyTarget(context), tree)
end

local function runAllTests(context, reason)
    local results = {}

    callTest(results, "context.Module", function()
        return type(context.Module) == "table", valueSummary(context.Module)
    end)

    callTest(results, "context.Config", function()
        return type(context.Config) == "table", valueSummary(context.Config)
    end)

    callTest(results, "context.Settings", function()
        return type(context.Settings) == "table", valueSummary(context.Settings)
    end)

    callTest(results, "context.Services", function()
        local services = context.Services or {}
        local required = { "Players", "HttpService", "ReplicatedStorage", "RunService", "Workspace", "Lighting", "MessagingService", "ServerScriptService" }
        for _, key in ipairs(required) do
            if services[key] == nil then
                return false, "Missing service " .. key
            end
        end
        return true, "All expected services present."
    end)

    callTest(results, "context.Log", function()
        context.Log("Log helper test message.")
        return true, "Logged message."
    end)

    callTest(results, "context.GetPlayers", function()
        local players = context.GetPlayers()
        return type(players) == "table", tostring(#players) .. " player(s)."
    end)

    callTest(results, "context.FindPlayer", function()
        local target = trim(setting(context, "Test_Player", "all"))
        if target == "" or string.lower(target) == "all" then
            local players = context.GetPlayers()
            target = players[1] and players[1].Name or ""
        end
        if target == "" then
            return true, "Skipped because no test player is available."
        end
        local player = context.FindPlayer(target)
        return player ~= nil, player and player.Name or "No player matched " .. target
    end)

    callTest(results, "context.Notify", function()
        if not setting(context, "Enable_Notify_Test", true) then
            return true, "Skipped by Enable_Notify_Test."
        end
        local ok, message = context.Notify(notifyTarget(context), "Notify helper test from Ro-Link module diagnostics.", true)
        return ok ~= false, message or "Notification sent."
    end)

    callTest(results, "context.CreateUI", function()
        if not setting(context, "Enable_CreateUI_Test", false) then
            return true, "Skipped by Enable_CreateUI_Test."
        end
        local result = createDiagnosticUi(context)
        return true, valueSummary(result)
    end)

    callTest(results, "context.GetDiscordChannels", function()
        if not setting(context, "Enable_External_Read_Tests", false) then
            return true, "Skipped by Enable_External_Read_Tests."
        end
        local ok, channels = context.GetDiscordChannels()
        return ok ~= false, ok == false and tostring(channels) or valueSummary(channels)
    end)

    callTest(results, "context.GetUserData", function()
        if not setting(context, "Enable_External_Read_Tests", false) then
            return true, "Skipped by Enable_External_Read_Tests."
        end
        local user = getTestUser(context)
        if user == "" then
            return true, "Skipped because Test_User is empty and no players are online."
        end
        local ok, data = context.GetUserData(user)
        return ok ~= false, ok == false and tostring(data) or valueSummary(data)
    end)

    callTest(results, "context.GetReports", function()
        if not setting(context, "Enable_External_Read_Tests", false) then
            return true, "Skipped by Enable_External_Read_Tests."
        end
        local ok, reports = context.GetReports({ limit = 3 })
        return ok ~= false, ok == false and tostring(reports) or valueSummary(reports)
    end)

    callTest(results, "context.GetReport", function()
        if not setting(context, "Enable_External_Read_Tests", false) then
            return true, "Skipped by Enable_External_Read_Tests."
        end
        local reportId = trim(setting(context, "Existing_Report_Id", ""))
        if reportId == "" then
            return true, "Skipped because Existing_Report_Id is empty."
        end
        local ok, report = context.GetReport(reportId)
        return ok ~= false, ok == false and tostring(report) or valueSummary(report)
    end)

    callTest(results, "context.CreateReport", function()
        if not setting(context, "Enable_Report_Write_Tests", false) then
            return true, "Skipped by Enable_Report_Write_Tests."
        end
        local ok, report = context.CreateReport({
            target = getTestUser(context),
            reason = "Ro-Link module function diagnostic test report.",
            status = "PENDING",
        })
        return ok ~= false, ok == false and tostring(report) or valueSummary(report)
    end)

    callTest(results, "context.UpdateReport", function()
        if not setting(context, "Enable_Report_Write_Tests", false) then
            return true, "Skipped by Enable_Report_Write_Tests."
        end
        local reportId = trim(setting(context, "Existing_Report_Id", ""))
        if reportId == "" then
            return true, "Skipped because Existing_Report_Id is empty."
        end
        local ok, report = context.UpdateReport(reportId, {
            moderatorNote = "Updated by Ro-Link module function diagnostic.",
        })
        return ok ~= false, ok == false and tostring(report) or valueSummary(report)
    end)

    callTest(results, "context.SendBotMessage", function()
        if not setting(context, "Enable_Bot_Message_Test", false) then
            return true, "Skipped by Enable_Bot_Message_Test."
        end
        local channelId = trim(setting(context, "Discord_Channel_Id", ""))
        if channelId == "" then
            return false, "Discord_Channel_Id is required."
        end
        local ok, response = context.SendBotMessage("channel", nil, channelId, {
            content = "Ro-Link module function diagnostic bot-message test.",
        })
        return ok ~= false, ok == false and tostring(response) or valueSummary(response)
    end)

    return printSummary(context, reason or "manual", results)
end

function Module.Init(context)
    context.Log("Ro-Link module function test loaded.")

    callTest({}, "context.RegisterCommand", function()
        context.RegisterCommand("module_function_test_registered", function(command, commandContext)
            return runAllTests(commandContext, "registered command")
        end)
        return true, "Registered module_function_test_registered."
    end)

    context.RegisterPanelCommand({
        Name = "module_function_test_panel",
        Title = "Module Function Test",
        Description = "Runs the Ro-Link marketplace module function diagnostic suite.",
        Category = "Diagnostics",
        SortOrder = 1,
        TargetRequired = false,
        RequiredPermissions = {},
        PermissionMode = "all",
        Fields = {},
    }, function(command, commandContext)
        return runAllTests(commandContext, "registered panel command")
    end)

    return true
end

function Module.OnAdminPanelOpened(player, payload, context)
    context.Log("OnAdminPanelOpened fired for", player and player.Name or "unknown", valueSummary(payload))
end

function Module.OnCommandBarOpened(player, payload, context)
    context.Log("OnCommandBarOpened fired for", player and player.Name or "unknown", valueSummary(payload))
end

Module.Commands = {
    module_function_test = function(command, context)
        return runAllTests(context, "Commands.module_function_test")
    end,
}

Module.PanelCommands = {
    module_function_test_panel_table = {
        Name = "module_function_test_panel_table",
        Title = "Module Function Test (Table)",
        Description = "Runs the diagnostic suite from a returned PanelCommands table.",
        Category = "Diagnostics",
        SortOrder = 2,
        TargetRequired = false,
        RequiredPermissions = {},
        PermissionMode = "all",
        Fields = {},
        Handler = function(command, context)
            return runAllTests(context, "PanelCommands table")
        end,
    },
}

Module.LiveConfig = {
    Live_Test_Message = function(command, context, value)
        context.Log("LiveConfig handler received value:", tostring(value))
        if type(context.Notify) == "function" then
            pcall(context.Notify, "all", tostring(value), true)
        end
        return runAllTests(context, "LIVE CONFIG")
    end,
}

function Module.OnLiveConfig(command, context, value, fieldKey)
    context.Log("OnLiveConfig fallback fired for", tostring(fieldKey), tostring(value))
    return true
end

return Module
