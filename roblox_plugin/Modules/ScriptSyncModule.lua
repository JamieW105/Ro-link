local HttpService = game:GetService("HttpService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterPlayer = game:GetService("StarterPlayer")
local StarterPlayerScripts = StarterPlayer:WaitForChild("StarterPlayerScripts")

local ScriptSyncModule = {}

local BASE_URL = "http://localhost:3000/api/v1/plugin"
local VERSION_ATTRIBUTE = "RoLinkVersion"

local TARGET_SERVICES = {
	ServerScriptService = ServerScriptService,
	ReplicatedStorage = ReplicatedStorage,
	StarterPlayerScripts = StarterPlayerScripts
}

export type SyncResult = { success: boolean, message: string }

function ScriptSyncModule.getLastSyncTime(): string
	local timestamp = game.Workspace:GetAttribute("RoLinkLastSync")
	if timestamp then
		return os.date("%Y-%m-%d %H:%M:%S", timestamp)
	end
	return "Never"
end

local function injectSecureConfiguration(apiKey: string)
	local configName = "RoLinkConfig"
	local config = ServerScriptService:FindFirstChild(configName)
	
	if not config then
		config = Instance.new("Configuration")
		config.Name = configName
		config.Parent = ServerScriptService
	end
	
	-- Store API Key securely as a non-replicated Private Attribute
	config:SetAttribute("ApiKey", apiKey)
end

function ScriptSyncModule.sync(token: string, apiKey: string, gameId: number): SyncResult
	local success, result = pcall(function()
		return HttpService:RequestAsync({
			Url = BASE_URL .. "/scripts?gameId=" .. tostring(gameId),
			Method = "GET",
			Headers = { ["Authorization"] = "Bearer " .. token }
		})
	end)
	
	if not success or result.StatusCode ~= 200 then
		return { success = false, message = "Failed to fetch script manifests." }
	end
	
	-- Inject Game API key safely before placing scripts
	injectSecureConfiguration(apiKey)
	
	local data = HttpService:JSONDecode(result.Body)
	local scriptsUpdated = 0
	
	for _, scriptData in ipairs(data.scripts) do
		local targetService = TARGET_SERVICES[scriptData.service]
		if not targetService then continue end
		
		local existingScript = targetService:FindFirstChild(scriptData.name)
		
		if existingScript then
			local currentVersion = existingScript:GetAttribute(VERSION_ATTRIBUTE)
			if currentVersion ~= scriptData.version then
				existingScript.Source = scriptData.source
				existingScript:SetAttribute(VERSION_ATTRIBUTE, scriptData.version)
				scriptsUpdated += 1
			end
		else
			local newScript
			if scriptData.type == "ModuleScript" then
				newScript = Instance.new("ModuleScript")
			elseif scriptData.type == "LocalScript" then
				newScript = Instance.new("LocalScript")
			else
				newScript = Instance.new("Script")
			end
			
			newScript.Name = scriptData.name
			newScript.Source = scriptData.source
			newScript:SetAttribute(VERSION_ATTRIBUTE, scriptData.version)
			newScript.Parent = targetService
			scriptsUpdated += 1
		end
	end
	
	game.Workspace:SetAttribute("RoLinkLastSync", os.time())
	return { success = true, message = "Synced " .. tostring(scriptsUpdated) .. " files successfully." }
end

return ScriptSyncModule
