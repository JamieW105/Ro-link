local HttpService = game:GetService("HttpService")
local GameSetupModule = {}

local BASE_URL = "http://localhost:3000/api/v1/plugin"

export type SetupResult = {
	isConfigured: boolean,
	apiKey: string?,
	setupUrl: string?,
	message: string?
}

function GameSetupModule.checkSetup(token: string, gameId: number): SetupResult
	local success, result = pcall(function()
		return HttpService:RequestAsync({
			Url = BASE_URL .. "/game/" .. tostring(gameId) .. "/status",
			Method = "GET",
			Headers = { ["Authorization"] = "Bearer " .. token }
		})
	end)
	
	if success and result.StatusCode == 200 then
		local data = HttpService:JSONDecode(result.Body)
		if data.configured then
			return { isConfigured = true, apiKey = data.apiKey }
		else
			return { isConfigured = false, setupUrl = data.setupUrl }
		end
	end
	
	return { isConfigured = false, message = "Failed to determine game configuration." }
end

return GameSetupModule
