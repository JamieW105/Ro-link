local HttpService = game:GetService("HttpService")
local AuthModule = {}

local BASE_URL = "http://localhost:3000/api/v1/plugin"
local SESSION_SETTING_KEY = "RoLink_SessionToken"

export type AuthResult = {
	success: boolean,
	token: string?,
	sessionId: string?,
	message: string?,
	authUrl: string?
}

function AuthModule.authenticate(plugin: Plugin): AuthResult
	local existingToken = plugin:GetSetting(SESSION_SETTING_KEY)
	
	if existingToken then
		local success, result = pcall(function()
			return HttpService:RequestAsync({
				Url = BASE_URL .. "/auth/verify",
				Method = "GET",
				Headers = { ["Authorization"] = "Bearer " .. existingToken }
			})
		end)
		
		if success and result.StatusCode == 200 then
			local data = HttpService:JSONDecode(result.Body)
			if data.verified and data.hasPermission then
				return { success = true, token = existingToken }
			end
		end
		-- Invalid token or unauthorized; clear and proceed to new auth
		plugin:SetSetting(SESSION_SETTING_KEY, nil)
	end
	
	-- Start new auth session
	local success, result = pcall(function()
		return HttpService:RequestAsync({
			Url = BASE_URL .. "/auth/start",
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({ studioUserId = plugin:GetStudioUserId() })
		})
	end)
	
	if success and result.StatusCode == 200 then
		local data = HttpService:JSONDecode(result.Body)
		return { 
			success = false, 
			sessionId = data.sessionId, 
			authUrl = data.loginUrl 
		}
	end
	
	return { success = false, message = "Failed to reach RoLink core servers. Code: " .. (result and tostring(result.StatusCode) or "Error") }
end

function AuthModule.pollForToken(plugin: Plugin, sessionId: string, callback: (AuthResult) -> ()): ()
	task.spawn(function()
		local maxAttempts = 60 -- Poll for 2 minutes (every 2 seconds)
		
		for i = 1, maxAttempts do
			local success, result = pcall(function()
				return HttpService:RequestAsync({
					Url = BASE_URL .. "/auth/poll?sessionId=" .. sessionId,
					Method = "GET"
				})
			end)
			
			if success and result.StatusCode == 200 then
				local data = HttpService:JSONDecode(result.Body)
				if data.token then
					plugin:SetSetting(SESSION_SETTING_KEY, data.token)
					callback({ success = true, token = data.token })
					return
				end
			end
			task.wait(2)
		end
		callback({ success = false, message = "Authentication timed out. Please try again." })
	end)
end

return AuthModule
