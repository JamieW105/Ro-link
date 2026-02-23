local RunService = game:GetService("RunService")

-- Ensure the script only runs as a plugin in edit mode
if not RunService:IsEdit() then return end

local plugin = plugin or getfenv().plugin

local Modules = script.Parent:WaitForChild("Modules")
local UIManager = require(Modules:WaitForChild("UIManager"))
local AuthModule = require(Modules:WaitForChild("AuthModule"))
local GameSetupModule = require(Modules:WaitForChild("GameSetupModule"))
local ScriptSyncModule = require(Modules:WaitForChild("ScriptSyncModule"))

local function initializePlugin()
	local ui = UIManager.createUI(plugin)
	
	local gameId = game.GameId
	if gameId == 0 then
		UIManager.updateState({
			status = "Unpublished",
			message = "Please publish the game to Roblox to begin securely syncing scripts."
		})
		return
	end

	-- Run async flow
	task.spawn(function()
		UIManager.updateState({ status = "Authenticating..." })

		local authResult = AuthModule.authenticate(plugin)
		
		if not authResult.success then
			if authResult.authUrl then
				UIManager.updateState({
					status = "Login Required",
					message = "Copy the URL below and authenticate in your browser.",
					actionUrl = authResult.authUrl
				})
				
				-- Start polling for the auth completion
				AuthModule.pollForToken(plugin, authResult.sessionId, function(pollResult)
					if pollResult.success then
						initializePlugin() -- Restart the initialization flow
					else
						UIManager.updateState({ status = "Error", message = pollResult.message })
					end
				end)
			else
				UIManager.updateState({ status = "Failed", message = authResult.message })
			end
			return
		end
		
		-- Proceed to check game configuration
		UIManager.updateState({ status = "Verifying Game..." })
		local setupResult = GameSetupModule.checkSetup(authResult.token, gameId)
		
		if not setupResult.isConfigured then
			UIManager.updateState({
				status = "Not Configured",
				message = "This GameId (" .. tostring(gameId) .. ") is not configured in RoLink.",
				actionUrl = setupResult.setupUrl
			})
			return
		end
		
		-- Successfully connected
		UIManager.updateState({
			status = "Ready",
			message = "Game is securely linked to RoLink.",
			lastSync = ScriptSyncModule.getLastSyncTime(),
			onSync = function()
				UIManager.updateState({ status = "Syncing..." })
				local syncResult = ScriptSyncModule.sync(authResult.token, setupResult.apiKey, gameId)
				UIManager.updateState({
					status = syncResult.success and "Ready" or "Error",
					message = syncResult.message,
					lastSync = ScriptSyncModule.getLastSyncTime()
				})
			end
		})
	end)
end

initializePlugin()
