--!strict
-- Ro-Link Module IDE Studio Plugin
-- Standalone plugin. It does not depend on or modify the Ro-Link installer plugin.

if not plugin then
	error("RoLinkModuleIDEPlugin must run as a Roblox Studio plugin")
end

local ChangeHistoryService = game:GetService("ChangeHistoryService")
local GuiService = game:GetService("GuiService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ScriptEditorService = game:GetService("ScriptEditorService")
local Selection = game:GetService("Selection")
local ServerScriptService = game:GetService("ServerScriptService")
local StarterPlayer = game:GetService("StarterPlayer")

local PLUGIN_VERSION = "1.2.1"
local PROTOCOL_VERSION = 1
local DEFAULT_BASE_URL = "https://rolink.site"
local TOOLBAR_ICON = "rbxassetid://80325173339413"
local ACCOUNT_POLL_SECONDS = 2.5
local BRIDGE_POLL_SECONDS = 1.25
local CHANGE_FLUSH_SECONDS = 0.6
local MAX_SNAPSHOT_NODES = 2500
local MAX_UI_NODES = 1000

local SERVICE_NAMES = {
	"Workspace",
	"Players",
	"Lighting",
	"ReplicatedFirst",
	"ReplicatedStorage",
	"ServerScriptService",
	"ServerStorage",
	"StarterGui",
	"StarterPack",
	"StarterPlayer",
	"Teams",
	"SoundService",
	"TextChatService",
	"MaterialService",
}

local SCRIPT_CLASSES = {
	Script = true,
	LocalScript = true,
	ModuleScript = true,
}

local UI_CLASSES = {
	ScreenGui = true,
	BillboardGui = true,
	SurfaceGui = true,
	Frame = true,
	ScrollingFrame = true,
	CanvasGroup = true,
	TextLabel = true,
	TextButton = true,
	TextBox = true,
	ImageLabel = true,
	ImageButton = true,
	VideoFrame = true,
	ViewportFrame = true,
	UIListLayout = true,
	UIGridLayout = true,
	UIPageLayout = true,
	UITableLayout = true,
	UIPadding = true,
	UIStroke = true,
	UICorner = true,
	UIGradient = true,
	UIAspectRatioConstraint = true,
	UISizeConstraint = true,
	UITextSizeConstraint = true,
	Folder = true,
	Configuration = true,
	StringValue = true,
	BoolValue = true,
	IntValue = true,
	NumberValue = true,
}

local SERIALIZABLE_PROPERTIES = {
	"Name",
	"Active",
	"AnchorPoint",
	"AutomaticSize",
	"BackgroundColor3",
	"BackgroundTransparency",
	"BorderColor3",
	"BorderMode",
	"BorderSizePixel",
	"ClipsDescendants",
	"LayoutOrder",
	"Position",
	"Rotation",
	"Selectable",
	"SelectionOrder",
	"Size",
	"SizeConstraint",
	"Visible",
	"ZIndex",
	"Text",
	"TextColor3",
	"TextSize",
	"TextScaled",
	"TextTransparency",
	"TextStrokeColor3",
	"TextStrokeTransparency",
	"TextWrapped",
	"TextXAlignment",
	"TextYAlignment",
	"Font",
	"RichText",
	"PlaceholderText",
	"PlaceholderColor3",
	"ClearTextOnFocus",
	"MultiLine",
	"Image",
	"ImageColor3",
	"ImageTransparency",
	"ScaleType",
	"SliceCenter",
	"TileSize",
	"ResetOnSpawn",
	"DisplayOrder",
	"IgnoreGuiInset",
	"ZIndexBehavior",
	"Adornee",
	"AlwaysOnTop",
	"Brightness",
	"CanvasSize",
	"AutomaticCanvasSize",
	"ScrollBarImageColor3",
	"ScrollBarImageTransparency",
	"ScrollBarThickness",
	"ScrollingDirection",
	"ElasticBehavior",
	"FillDirection",
	"HorizontalAlignment",
	"VerticalAlignment",
	"Padding",
	"SortOrder",
	"CellPadding",
	"CellSize",
	"CornerRadius",
	"Thickness",
	"Transparency",
	"Color",
	"Enabled",
	"AspectRatio",
	"DominantAxis",
	"AspectType",
	"MinSize",
	"MaxSize",
	"MinTextSize",
	"MaxTextSize",
	"Value",
}

type BridgeEvent = {
	type: string,
	requestId: string?,
	revision: string?,
	payload: { [string]: any }?,
}

local savedBaseUrl = tostring(plugin:GetSetting("RoLinkModuleIDEBaseUrl") or "")
if savedBaseUrl == "" or savedBaseUrl == "https://rolink.cloud" then
	savedBaseUrl = DEFAULT_BASE_URL
	plugin:SetSetting("RoLinkModuleIDEBaseUrl", savedBaseUrl)
end

local state = {
	apiBaseUrl = savedBaseUrl,
	accountToken = plugin:GetSetting("RoLinkModuleIDEAccountToken") or "",
	bridgeCredential = plugin:GetSetting("RoLinkModuleIDEBridgeCredential") or "",
	bridgeSessionId = plugin:GetSetting("RoLinkModuleIDEBridgeSessionId") or "",
	moduleId = plugin:GetSetting("RoLinkModuleIDEModuleId") or "",
	moduleName = plugin:GetSetting("RoLinkModuleIDEModuleName") or "",
	accountPollId = "",
	bridgePollId = "",
	studioCursor = 0,
	busy = false,
	connected = false,
	queuedChanges = {} :: { BridgeEvent },
	watchConnections = {} :: { RBXScriptConnection },
	instanceById = {} :: { [string]: Instance },
	idByInstance = setmetatable({}, { __mode = "k" }) :: { [Instance]: string },
}

local ui = {} :: { [string]: any }

local function trim(value: any): string
	return tostring(value or ""):match("^%s*(.-)%s*$") or ""
end

local function create(className: string, props: { [string]: any }?): Instance
	local instance = Instance.new(className)
	for key, value in pairs(props or {}) do
		(instance :: any)[key] = value
	end
	return instance
end

local function rounded(instance: Instance, radius: number?)
	create("UICorner", {
		CornerRadius = UDim.new(0, radius or 8),
		Parent = instance,
	})
end

local function setStatus(message: string, tone: string?)
	if not ui.statusLabel then
		return
	end
	ui.statusLabel.Text = message
	local colors = {
		neutral = Color3.fromRGB(148, 163, 184),
		info = Color3.fromRGB(125, 211, 252),
		success = Color3.fromRGB(74, 222, 128),
		warning = Color3.fromRGB(250, 204, 21),
		error = Color3.fromRGB(248, 113, 113),
	}
	ui.statusLabel.TextColor3 = colors[tone or "neutral"] or colors.neutral
end

local function setBusy(busy: boolean)
	state.busy = busy
	if ui.pairButton then
		ui.pairButton.Active = not busy
		ui.pairButton.Text = busy and "Working..." or "Pair Module"
	end
end

local function decodeJson(body: string?): any
	if not body or body == "" then
		return nil
	end
	local ok, result = pcall(HttpService.JSONDecode, HttpService, body)
	return if ok then result else nil
end

local function requestJson(method: string, path: string, body: any?, token: string?): (any, any)
	local baseUrl = state.apiBaseUrl:gsub("/+$", "")
	local secure = string.sub(baseUrl, 1, 8) == "https://"
	local localDevelopment = string.match(baseUrl, "^http://localhost[:/]?") ~= nil
		or string.match(baseUrl, "^http://127%.0%.0%.1[:/]?") ~= nil
	if not secure and not localDevelopment then
		return { Success = false, StatusCode = 0, Body = "" }, { error = "Ro-Link Module IDE only connects over HTTPS (localhost is allowed for development)." }
	end
	local headers = {
		["Accept"] = "application/json",
	}
	if token and token ~= "" then
		headers.Authorization = "Bearer " .. token
	end
	local options = {
		Url = baseUrl .. path,
		Method = method,
		Headers = headers,
	}
	if body ~= nil then
		headers["Content-Type"] = "application/json"
		options.Body = HttpService:JSONEncode(body)
	end
	local ok, response = pcall(HttpService.RequestAsync, HttpService, options)
	if not ok then
		return { Success = false, StatusCode = 0, Body = "" }, { error = tostring(response) }
	end
	return response, decodeJson(response.Body)
end

local function openUrl(url: string)
	url = trim(url)
	if url == "" then
		return
	end
	pcall(GuiService.OpenBrowserWindow, GuiService, url)
end

local function saveBridgeSettings()
	plugin:SetSetting("RoLinkModuleIDEBridgeCredential", state.bridgeCredential)
	plugin:SetSetting("RoLinkModuleIDEBridgeSessionId", state.bridgeSessionId)
	plugin:SetSetting("RoLinkModuleIDEModuleId", state.moduleId)
	plugin:SetSetting("RoLinkModuleIDEModuleName", state.moduleName)
end

local function getInstanceId(instance: Instance): string
	local existing = state.idByInstance[instance]
	if existing then
		return existing
	end
	local id = HttpService:GenerateGUID(false)
	state.idByInstance[instance] = id
	state.instanceById[id] = instance
	return id
end

local function getInstancePath(instance: Instance): string
	local segments = {}
	local cursor: Instance? = instance
	while cursor and cursor ~= game do
		table.insert(segments, 1, cursor.Name:gsub("/", "%%2F"))
		cursor = cursor.Parent
	end
	return table.concat(segments, "/")
end

local function serializeExplorerNode(instance: Instance, includeChildren: boolean?, depth: number?, counter: { count: number }?): { [string]: any }
	local node = {
		id = getInstanceId(instance),
		name = instance.Name,
		className = instance.ClassName,
		path = getInstancePath(instance),
		parentId = if instance.Parent and instance.Parent ~= game then getInstanceId(instance.Parent) else nil,
		hasChildren = #instance:GetChildren() > 0,
		isScript = SCRIPT_CLASSES[instance.ClassName] == true,
	}
	if includeChildren and (depth or 0) > 0 and counter and counter.count < MAX_SNAPSHOT_NODES then
		local children = {}
		for _, child in ipairs(instance:GetChildren()) do
			if counter.count >= MAX_SNAPSHOT_NODES then
				break
			end
			counter.count += 1
			table.insert(children, serializeExplorerNode(child, true, (depth or 1) - 1, counter))
		end
		node.children = children
	end
	return node
end

local function sourceRevision(source: string): string
	local hash = 5381
	for index = 1, #source do
		hash = bit32.band((hash * 33) + string.byte(source, index), 0xFFFFFFFF)
	end
	return string.format("%08x-%d", hash, #source)
end

local function readScript(instance: Instance): (string?, string?)
	if not SCRIPT_CLASSES[instance.ClassName] then
		return nil, "Selected instance is not a script."
	end
	local ok, source = pcall(function()
		return (instance :: any).Source
	end)
	if not ok then
		return nil, "Studio denied script source access. Enable script injection permissions for this plugin."
	end
	return tostring(source), nil
end

local function encodeValue(value: any): any
	local valueType = typeof(value)
	if valueType == "nil" or valueType == "boolean" or valueType == "number" or valueType == "string" then
		return value
	elseif valueType == "Color3" then
		return { type = "Color3", r = value.R, g = value.G, b = value.B }
	elseif valueType == "Vector2" then
		return { type = "Vector2", x = value.X, y = value.Y }
	elseif valueType == "Vector3" then
		return { type = "Vector3", x = value.X, y = value.Y, z = value.Z }
	elseif valueType == "UDim" then
		return { type = "UDim", scale = value.Scale, offset = value.Offset }
	elseif valueType == "UDim2" then
		return {
			type = "UDim2",
			xScale = value.X.Scale,
			xOffset = value.X.Offset,
			yScale = value.Y.Scale,
			yOffset = value.Y.Offset,
		}
	elseif valueType == "Rect" then
		return { type = "Rect", min = encodeValue(value.Min), max = encodeValue(value.Max) }
	elseif valueType == "ColorSequence" then
		local points = {}
		for _, keypoint in ipairs(value.Keypoints) do
			table.insert(points, { time = keypoint.Time, value = encodeValue(keypoint.Value) })
		end
		return { type = "ColorSequence", keypoints = points }
	elseif valueType == "NumberSequence" then
		local points = {}
		for _, keypoint in ipairs(value.Keypoints) do
			table.insert(points, { time = keypoint.Time, value = keypoint.Value, envelope = keypoint.Envelope })
		end
		return { type = "NumberSequence", keypoints = points }
	elseif valueType == "EnumItem" then
		return { type = "EnumItem", value = tostring(value) }
	elseif valueType == "Instance" then
		return { type = "InstanceRef", path = getInstancePath(value) }
	end
	return nil
end

local function serializeUi(instance: Instance, counter: { count: number }, warnings: { string }, depth: number): { [string]: any }?
	if counter.count >= MAX_UI_NODES or depth > 32 then
		table.insert(warnings, "UI hierarchy was truncated at the safety limit.")
		return nil
	end
	if not UI_CLASSES[instance.ClassName] then
		table.insert(warnings, string.format("Skipped unsupported %s at %s.", instance.ClassName, getInstancePath(instance)))
		return nil
	end
	counter.count += 1
	local properties = {}
	for _, property in ipairs(SERIALIZABLE_PROPERTIES) do
		local ok, value = pcall(function()
			return (instance :: any)[property]
		end)
		if ok then
			local encoded = encodeValue(value)
			if encoded ~= nil then
				properties[property] = encoded
			end
		end
	end
	local attributes = {}
	for name, value in pairs(instance:GetAttributes()) do
		local encoded = encodeValue(value)
		if encoded ~= nil then
			attributes[name] = encoded
		end
	end
	local children = {}
	for _, child in ipairs(instance:GetChildren()) do
		local encoded = serializeUi(child, counter, warnings, depth + 1)
		if encoded then
			table.insert(children, encoded)
		end
	end
	return {
		className = instance.ClassName,
		name = instance.Name,
		properties = properties,
		attributes = attributes,
		children = children,
	}
end

local function sendEvents(events: { BridgeEvent }): boolean
	if state.bridgeCredential == "" or #events == 0 then
		return false
	end
	local response, payload = requestJson("POST", "/api/plugin/modules/ide/events", {
		protocolVersion = PROTOCOL_VERSION,
		events = events,
	}, state.bridgeCredential)
	if response.StatusCode == 401 then
		state.connected = false
		state.bridgeCredential = ""
		state.bridgeSessionId = ""
		saveBridgeSettings()
		setStatus("Module session expired. Pair Studio again.", "warning")
		return false
	end
	if not response.Success or response.StatusCode >= 300 then
		setStatus((payload and payload.error) or "Studio sync request failed.", "error")
		return false
	end
	return true
end

local function queueChange(event: BridgeEvent)
	table.insert(state.queuedChanges, event)
end

local function disconnectWatchers()
	for _, connection in ipairs(state.watchConnections) do
		connection:Disconnect()
	end
	table.clear(state.watchConnections)
end

local function watchInstance(instance: Instance)
	getInstanceId(instance)
	table.insert(state.watchConnections, instance:GetPropertyChangedSignal("Name"):Connect(function()
		queueChange({
			type = "tree.instanceRenamed",
			payload = serializeExplorerNode(instance),
		})
	end))
	table.insert(state.watchConnections, instance.AncestryChanged:Connect(function(_, parent)
		if parent then
			queueChange({ type = "tree.instanceMoved", payload = serializeExplorerNode(instance) })
		end
	end))
end

local function beginHierarchyWatch()
	disconnectWatchers()
	for _, serviceName in ipairs(SERVICE_NAMES) do
		local ok, service = pcall(game.GetService, game, serviceName)
		if ok and service then
			watchInstance(service)
			for _, descendant in ipairs(service:GetDescendants()) do
				watchInstance(descendant)
			end
			table.insert(state.watchConnections, service.DescendantAdded:Connect(function(instance)
				watchInstance(instance)
				queueChange({ type = "tree.instanceCreated", payload = serializeExplorerNode(instance) })
			end))
			table.insert(state.watchConnections, service.DescendantRemoving:Connect(function(instance)
				local id = state.idByInstance[instance]
				queueChange({
					type = "tree.instanceDeleted",
					payload = { id = id, path = getInstancePath(instance) },
				})
				if id then
					state.instanceById[id] = nil
				end
			end))
		end
	end
end

local function sendSnapshot()
	local roots = {}
	local counter = { count = 0 }
	for _, serviceName in ipairs(SERVICE_NAMES) do
		local ok, service = pcall(game.GetService, game, serviceName)
		if ok and service then
			counter.count += 1
			table.insert(roots, serializeExplorerNode(service, true, 2, counter))
		end
	end
	sendEvents({ {
		type = "tree.snapshot",
		revision = tostring(os.time()),
		payload = {
			roots = roots,
			totalNodes = counter.count,
			truncated = counter.count >= MAX_SNAPSHOT_NODES,
		},
	} })
end

local function respondToScriptRequest(event: any)
	local payload = event.payload or {}
	local instance = state.instanceById[tostring(payload.instanceId or "")]
	if not instance then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = "Studio instance no longer exists." } } })
		return
	end
	local source, sourceError = readScript(instance)
	if not source then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = sourceError } } })
		return
	end
	local revision = sourceRevision(source)
	sendEvents({ {
		type = "script.contents",
		requestId = event.requestId,
		revision = revision,
		payload = {
			instanceId = getInstanceId(instance),
			path = getInstancePath(instance),
			name = instance.Name,
			className = instance.ClassName,
			source = source,
		},
	} })
end

local function respondToChildrenRequest(event: any)
	local payload = event.payload or {}
	local instance = state.instanceById[tostring(payload.instanceId or "")]
	if not instance then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = "Studio instance no longer exists." } } })
		return
	end
	local children = {}
	for _, child in ipairs(instance:GetChildren()) do
		table.insert(children, serializeExplorerNode(child))
	end
	sendEvents({ {
		type = "tree.children",
		requestId = event.requestId,
		payload = { instanceId = getInstanceId(instance), children = children },
	} })
end

local function applyScriptUpdate(event: any)
	local payload = event.payload or {}
	local instance = state.instanceById[tostring(payload.instanceId or "")]
	if not instance or not SCRIPT_CLASSES[instance.ClassName] then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = "Studio script no longer exists." } } })
		return
	end
	local currentSource, sourceError = readScript(instance)
	if not currentSource then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = sourceError } } })
		return
	end
	local currentRevision = sourceRevision(currentSource)
	local expectedRevision = tostring(event.revision or payload.expectedRevision or "")
	if expectedRevision ~= "" and expectedRevision ~= currentRevision then
		sendEvents({ {
			type = "script.conflict",
			requestId = event.requestId,
			revision = currentRevision,
			payload = {
				instanceId = getInstanceId(instance),
				path = getInstancePath(instance),
				source = currentSource,
				message = "This script changed in Roblox Studio after it was opened in the browser.",
			},
		} })
		return
	end
	local nextSource = tostring(payload.source or "")
	if #nextSource > 1024 * 1024 then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = "Script exceeds the 1 MB safety limit." } } })
		return
	end
	pcall(ChangeHistoryService.SetWaypoint, ChangeHistoryService, "Ro-Link IDE before script update")
	local ok, updateError = pcall(function()
		ScriptEditorService:UpdateSourceAsync(instance :: LuaSourceContainer, function()
			return nextSource
		end)
	end)
	if not ok then
		sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = "Studio rejected the script update: " .. tostring(updateError) } } })
		return
	end
	pcall(ChangeHistoryService.SetWaypoint, ChangeHistoryService, "Ro-Link IDE script update")
	local revision = sourceRevision(nextSource)
	sendEvents({ {
		type = "script.updated",
		requestId = event.requestId,
		revision = revision,
		payload = { instanceId = getInstanceId(instance), path = getInstancePath(instance) },
	} })
end

local function processBrowserEvent(event: any)
	if event.type == "script.request" then
		respondToScriptRequest(event)
	elseif event.type == "script.update" then
		applyScriptUpdate(event)
	elseif event.type == "tree.children" then
		respondToChildrenRequest(event)
	elseif event.type == "tree.snapshot" then
		sendSnapshot()
	end
end

local function updateConnectionUi()
	if not ui.connectionLabel then
		return
	end
	ui.connectionLabel.Text = if state.connected
		then "CONNECTED  /  " .. (state.moduleName ~= "" and state.moduleName or "Module")
		else "DISCONNECTED"
	ui.connectionLabel.TextColor3 = if state.connected then Color3.fromRGB(74, 222, 128) else Color3.fromRGB(148, 163, 184)
	ui.importButton.Active = state.connected
	ui.syncProjectButton.Active = state.connected
	ui.snapshotButton.Active = state.connected
	ui.disconnectButton.Active = state.connected
end

local function stopBridge(message: string?)
	state.connected = false
	state.bridgePollId = ""
	state.bridgeCredential = ""
	state.bridgeSessionId = ""
	state.moduleId = ""
	state.moduleName = ""
	state.studioCursor = 0
	saveBridgeSettings()
	disconnectWatchers()
	updateConnectionUi()
	if message then
		setStatus(message, "neutral")
	end
end

local function startBridge()
	if state.bridgeCredential == "" then
		return
	end
	state.connected = true
	local pollId = HttpService:GenerateGUID(false)
	state.bridgePollId = pollId
	updateConnectionUi()
	beginHierarchyWatch()
	setStatus("Module paired. Sending the Studio Explorer snapshot...", "success")
	sendEvents({ {
		type = "studio.connected",
		payload = {
			pluginVersion = PLUGIN_VERSION,
			protocolVersion = PROTOCOL_VERSION,
			placeId = tostring(game.PlaceId),
			universeId = tostring(game.GameId),
			placeName = game.Name,
		},
	} })
	sendSnapshot()

	task.spawn(function()
		local lastFlush = os.clock()
		while state.bridgePollId == pollId and state.bridgeCredential ~= "" do
			local response, payload = requestJson(
				"GET",
				"/api/plugin/modules/ide/events?cursor=" .. tostring(state.studioCursor),
				nil,
				state.bridgeCredential
			)
			if response.StatusCode == 401 then
				stopBridge("Module session expired. Pair Studio again.")
				return
			end
			if response.Success and response.StatusCode < 300 and type(payload) == "table" then
				for _, event in ipairs(payload.events or {}) do
					state.studioCursor = math.max(state.studioCursor, tonumber(event.id) or 0)
					local ok, processError = pcall(processBrowserEvent, event)
					if not ok then
						sendEvents({ { type = "sync.error", requestId = event.requestId, payload = { message = tostring(processError) } } })
					end
				end
			end
			if #state.queuedChanges > 0 and os.clock() - lastFlush >= CHANGE_FLUSH_SECONDS then
				local batch = {}
				while #state.queuedChanges > 0 and #batch < 100 do
					table.insert(batch, table.remove(state.queuedChanges, 1))
				end
				if sendEvents(batch) then
					lastFlush = os.clock()
				end
			end
			task.wait(BRIDGE_POLL_SECONDS)
		end
	end)
end

local function beginAccountAuthorization()
	if state.busy then
		return
	end
	setBusy(true)
	setStatus("Starting secure Ro-Link account authorization...", "info")
	local response, payload = requestJson("POST", "/api/plugin/session/start", {}, nil)
	setBusy(false)
	if not response.Success or response.StatusCode >= 300 or type(payload) ~= "table" then
		setStatus((payload and payload.error) or "Could not start account authorization.", "error")
		return
	end
	local sessionId = tostring(payload.sessionId or "")
	local code = tostring(payload.code or "")
	local authorizeUrl = tostring(payload.authorizeUrl or "")
	if sessionId == "" or code == "" then
		setStatus("Ro-Link returned an invalid authorization session.", "error")
		return
	end
	openUrl(authorizeUrl)
	setStatus("Approve the browser sign-in, then return to Studio.", "warning")
	local pollId = HttpService:GenerateGUID(false)
	state.accountPollId = pollId
	task.spawn(function()
		while state.accountPollId == pollId do
			local path = string.format(
				"/api/plugin/session/status?sessionId=%s&code=%s",
				HttpService:UrlEncode(sessionId),
				HttpService:UrlEncode(code)
			)
			local pollResponse, pollPayload = requestJson("GET", path, nil, nil)
			if pollResponse.Success and pollResponse.StatusCode == 200 and type(pollPayload) == "table" and pollPayload.status == "authorized" then
				state.accountToken = tostring(pollPayload.pluginToken or "")
				plugin:SetSetting("RoLinkModuleIDEAccountToken", state.accountToken)
				state.accountPollId = ""
				setStatus("Ro-Link account connected. Enter the Module IDE pairing code.", "success")
				return
			elseif pollResponse.StatusCode == 404 then
				state.accountPollId = ""
				setStatus("Account authorization expired. Try Connect Account again.", "error")
				return
			end
			task.wait(ACCOUNT_POLL_SECONDS)
		end
	end)
end

local function pairModule()
	if state.busy then
		return
	end
	if state.accountToken == "" then
		beginAccountAuthorization()
		return
	end
	local code = trim(ui.codeBox.Text):upper():gsub("[^A-Z2-9]", "")
	if #code ~= 8 then
		setStatus("Enter the eight-character code shown by Connect Studio in the browser IDE.", "warning")
		return
	end
	setBusy(true)
	setStatus("Pairing this Studio place with the selected module...", "info")
	local response, payload = requestJson("POST", "/api/plugin/modules/ide/pair", {
		code = code,
		placeId = tostring(game.PlaceId),
		universeId = tostring(game.GameId),
		placeName = game.Name,
		pluginVersion = PLUGIN_VERSION,
		protocolVersion = PROTOCOL_VERSION,
	}, state.accountToken)
	setBusy(false)
	if response.StatusCode == 401 then
		state.accountToken = ""
		plugin:SetSetting("RoLinkModuleIDEAccountToken", "")
		setStatus("Ro-Link account authorization expired. Connect Account again.", "warning")
		return
	end
	if not response.Success or response.StatusCode >= 300 or type(payload) ~= "table" then
		setStatus((payload and payload.error) or "Module pairing failed.", "error")
		return
	end
	state.bridgeCredential = tostring(payload.credential or "")
	state.bridgeSessionId = tostring(payload.sessionId or "")
	state.moduleId = tostring(payload.module and payload.module.id or "")
	state.moduleName = tostring(payload.module and payload.module.name or "")
	state.studioCursor = 0
	saveBridgeSettings()
	ui.codeBox.Text = ""
	startBridge()
end

local function disconnectModule()
	if state.bridgeCredential ~= "" then
		sendEvents({ { type = "studio.disconnected", payload = { reason = "user" } } })
		requestJson("POST", "/api/plugin/modules/ide/disconnect", {}, state.bridgeCredential)
	end
	stopBridge("Studio disconnected from the module. Your Ro-Link account remains authorized.")
end

local function importSelection()
	if not state.connected then
		setStatus("Pair a module before importing UI.", "warning")
		return
	end
	local selected = Selection:Get()
	if #selected == 0 then
		setStatus("Select a ScreenGui or supported UI hierarchy in Explorer first.", "warning")
		return
	end
	local roots = {}
	local warnings = {}
	local selectionPaths = {}
	local counter = { count = 0 }
	for _, instance in ipairs(selected) do
		table.insert(selectionPaths, getInstancePath(instance))
		local root = serializeUi(instance, counter, warnings, 0)
		if root then
			table.insert(roots, root)
		end
	end
	if #roots == 0 then
		setStatus("The selection did not contain a supported UI hierarchy.", "error")
		return
	end
	local requestId = HttpService:GenerateGUID(false)
	local ok = sendEvents({ {
		type = "ui.import",
		requestId = requestId,
		revision = tostring(os.time()),
		payload = {
			roots = roots,
			warnings = warnings,
			nodeCount = counter.count,
			selectionPaths = selectionPaths,
		},
	} })
	if ok then
		setStatus(string.format("Sent %d UI object%s to %s.", counter.count, if counter.count == 1 then "" else "s", state.moduleName), "success")
	end
end

local function decodeValue(value: any): any
	if type(value) ~= "table" then
		return value
	end
	local valueType = tostring(value.type or "")
	if valueType == "Color3" then
		return Color3.new(tonumber(value.r) or 0, tonumber(value.g) or 0, tonumber(value.b) or 0)
	elseif valueType == "Vector2" then
		return Vector2.new(tonumber(value.x) or 0, tonumber(value.y) or 0)
	elseif valueType == "Vector3" then
		return Vector3.new(tonumber(value.x) or 0, tonumber(value.y) or 0, tonumber(value.z) or 0)
	elseif valueType == "UDim" then
		return UDim.new(tonumber(value.scale) or 0, tonumber(value.offset) or 0)
	elseif valueType == "UDim2" then
		return UDim2.new(tonumber(value.xScale) or 0, tonumber(value.xOffset) or 0, tonumber(value.yScale) or 0, tonumber(value.yOffset) or 0)
	elseif valueType == "Rect" then
		return Rect.new(decodeValue(value.min), decodeValue(value.max))
	elseif valueType == "ColorSequence" then
		local keypoints = {}
		for _, point in ipairs(value.keypoints or {}) do
			table.insert(keypoints, ColorSequenceKeypoint.new(tonumber(point.time) or 0, decodeValue(point.value)))
		end
		return ColorSequence.new(keypoints)
	elseif valueType == "NumberSequence" then
		local keypoints = {}
		for _, point in ipairs(value.keypoints or {}) do
			table.insert(keypoints, NumberSequenceKeypoint.new(tonumber(point.time) or 0, tonumber(point.value) or 0, tonumber(point.envelope) or 0))
		end
		return NumberSequence.new(keypoints)
	elseif valueType == "EnumItem" then
		local enumName, itemName = tostring(value.value or ""):match("^Enum%.([^.]+)%.(.+)$")
		if enumName and itemName then
			local ok, item = pcall(function()
				return (Enum :: any)[enumName][itemName]
			end)
			if ok then
				return item
			end
		end
	end
	return nil
end

local function materializeUi(node: any, parent: Instance, counter: { count: number }): Instance?
	if type(node) ~= "table" or counter.count >= MAX_UI_NODES then
		return nil
	end
	local className = tostring(node.className or "")
	if not UI_CLASSES[className] then
		return nil
	end
	local ok, instance = pcall(Instance.new, className)
	if not ok or not instance then
		return nil
	end
	counter.count += 1
	instance.Name = tostring(node.name or className):sub(1, 100)
	for property, encoded in pairs(node.properties or {}) do
		if property ~= "Name" then
			local decoded = decodeValue(encoded)
			if decoded ~= nil then
				pcall(function()
					(instance :: any)[property] = decoded
				end)
			end
		end
	end
	for attribute, encoded in pairs(node.attributes or {}) do
		local decoded = decodeValue(encoded)
		if decoded ~= nil then
			pcall(instance.SetAttribute, instance, tostring(attribute):sub(1, 100), decoded)
		end
	end
	instance.Parent = parent
	for _, child in ipairs(node.children or {}) do
		materializeUi(child, instance, counter)
	end
	return instance
end

local function childFolder(parent: Instance, name: string): Folder
	local existing = parent:FindFirstChild(name)
	if existing and existing:IsA("Folder") then
		return existing
	end
	if existing then
		existing:Destroy()
	end
	local folder = Instance.new("Folder")
	folder.Name = name
	folder.Parent = parent
	return folder
end

local function resetModuleFolder(parent: Instance, name: string): Folder
	local existing = parent:FindFirstChild(name)
	if existing then
		existing:Destroy()
	end
	return childFolder(parent, name)
end

local function safeProjectSegment(value: any): string
	local segment = tostring(value or ""):gsub("[%c/\\]", "-"):sub(1, 100)
	return if segment == "" then "Untitled" else segment
end

local function createSourceModule(rootFolder: Instance, path: string, source: string)
	local segments = string.split(path, "/")
	local parent = rootFolder
	for index = 1, #segments - 1 do
		parent = childFolder(parent, safeProjectSegment(segments[index]))
	end
	local moduleScript = Instance.new("ModuleScript")
	moduleScript.Name = safeProjectSegment(segments[#segments])
	moduleScript.Source = source
	moduleScript.Parent = parent
end

local function runtimeSource(moduleId: string, entrypoint: string, clientRuntime: boolean): string
	local rootExpression = if clientRuntime
		then "game:GetService(\"ReplicatedStorage\"):WaitForChild(\"RoLinkModuleProjects\")"
		else "game:GetService(\"ServerScriptService\"):WaitForChild(\"RoLinkModuleProjects\")"
	return string.format([=[
--!strict
-- Generated by Ro-Link Module IDE. Re-sync from the plugin instead of editing this runner.
local moduleId = %q
local entrypoint = %q
local runContext = %q
local packageRoot = %s:WaitForChild(moduleId)
local replicatedRoot = game:GetService("ReplicatedStorage"):WaitForChild("RoLinkModuleProjects"):WaitForChild(moduleId)
local moduleApiEvent = game:GetService("ReplicatedStorage"):WaitForChild("RoLinkModuleProjects"):WaitForChild("ModuleAPI")
local HttpService = game:GetService("HttpService")
local RATE_WINDOW_SECONDS = 10
local RATE_MAX_CALLS = 60

local function resolve(root: Instance, path: string): Instance
	local cursor = root
	for _, segment in ipairs(string.split(path, "/")) do
		cursor = cursor:WaitForChild(segment)
	end
	return cursor
end

local allowedServices = {
	Players = true,
	ReplicatedStorage = true,
	RunService = true,
	ServerStorage = runContext == "server",
	ServerScriptService = runContext == "server",
	StarterGui = true,
	StarterPlayer = true,
	TweenService = true,
	UserInputService = runContext == "client",
	CollectionService = true,
	DataStoreService = runContext == "server",
	HttpService = true,
	Lighting = true,
	MarketplaceService = true,
	MessagingService = runContext == "server",
	SoundService = true,
	TextChatService = true,
}
local services = setmetatable({}, {
	__index = function(_, serviceName)
		if not allowedServices[serviceName] then
			error("Ro-Link Module " .. moduleId .. " cannot access service " .. tostring(serviceName), 2)
		end
		return game:GetService(serviceName)
	end,
})

local function decodeJson(value: any, fallback: any): any
	if type(value) ~= "string" or value == "" then
		return fallback
	end
	local ok, decoded = pcall(HttpService.JSONDecode, HttpService, value)
	return if ok then decoded else fallback
end

local rateBuckets = {}
local function allowIncoming(player: Player): boolean
	local key = tostring(player.UserId)
	local now = os.clock()
	local bucket = rateBuckets[key]
	if not bucket or now - bucket.startedAt >= RATE_WINDOW_SECONDS then
		bucket = { startedAt = now, count = 0 }
		rateBuckets[key] = bucket
	end
	bucket.count += 1
	return bucket.count <= RATE_MAX_CALLS
end

local function normalizeTargetModuleId(targetModuleId: any): string
	local normalized = tostring(targetModuleId or "")
	if normalized == "" then
		error("ModuleID is required", 3)
	end
	return normalized
end

local manifest = decodeJson(packageRoot:GetAttribute("RoLinkManifest"), {})
local context = {
	ModuleId = moduleId,
	Module = manifest,
	Config = manifest.configuration or {},
	Settings = {},
	Services = services,
	CallClient = function(targetModuleId: string, user: Player, ...: any)
		if runContext ~= "server" then error("CallClient is only available to server modules", 2) end
		if typeof(user) ~= "Instance" or not user:IsA("Player") then error("CallClient expects a Player", 2) end
		moduleApiEvent:FireClient(user, normalizeTargetModuleId(targetModuleId), ...)
	end,
	CallServer = function(targetModuleId: string, ...: any)
		if runContext ~= "client" then error("CallServer is only available to client modules", 2) end
		moduleApiEvent:FireServer(normalizeTargetModuleId(targetModuleId), ...)
	end,
	Log = function(...)
		print("[Ro-Link Module " .. moduleId .. "]", ...)
	end,
	Warn = function(...)
		warn("[Ro-Link Module " .. moduleId .. "]", ...)
	end,
}

local ok, definition = pcall(require, resolve(packageRoot, entrypoint))
if not ok then
	warn("[Ro-Link Module Runtime] " .. moduleId .. " failed to load: " .. tostring(definition))
	return
end
if type(definition) ~= "table" then
	warn("[Ro-Link Module Runtime] " .. moduleId .. " entrypoint must return a table")
	return
end
local moduleApiConnection
if runContext == "client" then
	moduleApiConnection = moduleApiEvent.OnClientEvent:Connect(function(targetModuleId: any, ...: any)
		if tostring(targetModuleId or "") ~= moduleId or type(definition.CallClient) ~= "function" then return end
		local succeeded, callError = pcall(definition.CallClient, context, ...)
		if not succeeded then warn("[Ro-Link Module Runtime] " .. moduleId .. " CallClient failed: " .. tostring(callError)) end
	end)
else
	moduleApiConnection = moduleApiEvent.OnServerEvent:Connect(function(player: Player, targetModuleId: any, ...: any)
		if tostring(targetModuleId or "") ~= moduleId or type(definition.CallServer) ~= "function" then return end
		if not allowIncoming(player) then
			warn("[Ro-Link Module Runtime] " .. moduleId .. " CallServer rejected: rate limit exceeded")
			return
		end
		local succeeded, callError = pcall(definition.CallServer, context, player, ...)
		if not succeeded then warn("[Ro-Link Module Runtime] " .. moduleId .. " CallServer failed: " .. tostring(callError)) end
	end)
end
script.Destroying:Connect(function()
	moduleApiConnection:Disconnect()
end)
local function lifecycle(name: string)
	local callback = definition[name]
	if type(callback) == "function" then
		local succeeded, lifecycleError = pcall(callback, context, {})
		if not succeeded then
			warn("[Ro-Link Module Runtime] " .. moduleId .. " " .. name .. " failed: " .. tostring(lifecycleError))
		end
	end
end
lifecycle("Init")
lifecycle("Start")
%s
]=], moduleId, entrypoint, if clientRuntime then "client" else "server", rootExpression, if clientRuntime then "" else "game:BindToClose(function() lifecycle(\"Destroy\") end)")
end

local function installProjectPackage(projectPackage: any, packageHash: string): (boolean, string)
	if type(projectPackage) ~= "table" or tonumber(projectPackage.formatVersion) ~= 2 then
		return false, "Ro-Link returned an unsupported project package."
	end
	local moduleId = safeProjectSegment(projectPackage.moduleId)
	if moduleId == "" or moduleId ~= safeProjectSegment(state.moduleId) then
		return false, "The project package does not match the paired module."
	end
	local files = projectPackage.files
	if type(files) ~= "table" or #files > 500 then
		return false, "The module package file list is invalid."
	end
	local replicatedProjects = childFolder(ReplicatedStorage, "RoLinkModuleProjects")
	local serverProjects = childFolder(ServerScriptService, "RoLinkModuleProjects")
	local serverModule = resetModuleFolder(serverProjects, moduleId)
	local replicatedModule = resetModuleFolder(replicatedProjects, moduleId)
	serverModule:SetAttribute("RoLinkPackageHash", packageHash)
	serverModule:SetAttribute("RoLinkModuleVersion", tostring(projectPackage.version or ""))
	replicatedModule:SetAttribute("RoLinkPackageHash", packageHash)
	replicatedModule:SetAttribute("RoLinkModuleVersion", tostring(projectPackage.version or ""))
	local encodedManifest = HttpService:JSONEncode(projectPackage.manifest or {})
	if #encodedManifest > 200000 then
		return false, "The module manifest exceeds the 200 KB Studio safety limit."
	end
	serverModule:SetAttribute("RoLinkManifest", encodedManifest)
	replicatedModule:SetAttribute("RoLinkManifest", encodedManifest)
	local entrypoints = projectPackage.entrypoints or {}
	local serverEntrypoint = tostring(entrypoints.server or "")
	local clientEntrypoint = tostring(entrypoints.client or "")
	local serverEntrypointSource = ""

	for _, file in ipairs(files) do
		local kind = tostring(file.kind or "")
		local path = tostring(file.path or "")
		local source = tostring(file.sourceCode or "")
		if #source > 1024 * 1024 then
			return false, "A project script exceeds the 1 MB Studio safety limit."
		end
		if kind == "server_script" then
			createSourceModule(serverModule, path, source)
			if path == serverEntrypoint then
				serverEntrypointSource = source
			end
		elseif kind == "client_script" then
			createSourceModule(replicatedModule, path, source)
		elseif kind == "shared_module" then
			createSourceModule(serverModule, path, source)
			createSourceModule(replicatedModule, path, source)
		elseif kind == "ui" and type(file.uiTree) == "table" then
			local uiFolder = childFolder(replicatedModule, "UI")
			materializeUi(file.uiTree, uiFolder, { count = 0 })
		end
	end

	local moduleApiEvent = replicatedProjects:FindFirstChild("ModuleAPI")
	if moduleApiEvent and not moduleApiEvent:IsA("RemoteEvent") then
		moduleApiEvent:Destroy()
		moduleApiEvent = nil
	end
	if not moduleApiEvent then
		moduleApiEvent = Instance.new("RemoteEvent")
		moduleApiEvent.Name = "ModuleAPI"
		moduleApiEvent.Parent = replicatedProjects
	end

	local runnerFolder = childFolder(ServerScriptService, "RoLinkModuleRunners")
	local existingServerRunner = runnerFolder:FindFirstChild(moduleId .. ".server")
	if existingServerRunner then
		existingServerRunner:Destroy()
	end
	local roLinkAdmin = ReplicatedStorage:FindFirstChild("RoLink Admin")
	local legacyExecuteModule = string.find(serverEntrypointSource, "Execute%s*=") ~= nil
		or string.find(serverEntrypointSource, "function%s+[%w_%.:]*Execute%s*%(") ~= nil
	if roLinkAdmin and serverEntrypointSource ~= "" and legacyExecuteModule then
		local customModules = childFolder(roLinkAdmin, "Custom Modules")
		local legacyName = safeProjectSegment(projectPackage.slug or projectPackage.name or moduleId)
		local existingModule = customModules:FindFirstChild(legacyName)
		if existingModule then
			existingModule:Destroy()
		end
		local legacyModule = Instance.new("ModuleScript")
		legacyModule.Name = legacyName
		legacyModule.Source = serverEntrypointSource
		legacyModule:SetAttribute("RoLinkModuleId", state.moduleId)
		legacyModule:SetAttribute("RoLinkModuleSlug", tostring(projectPackage.slug or ""))
		legacyModule:SetAttribute("RoLinkModuleName", tostring(projectPackage.name or legacyName))
		legacyModule:SetAttribute("RoLinkSourceChecksum", packageHash)
		legacyModule.Parent = customModules
	end
	if serverEntrypoint ~= "" then
		local runner = Instance.new("Script")
		runner.Name = moduleId .. ".server"
		runner:SetAttribute("RoLinkModuleId", state.moduleId)
		runner.Source = runtimeSource(moduleId, serverEntrypoint, false)
		runner.Parent = runnerFolder
	end
	if clientEntrypoint ~= "" then
		local runnerFolder = childFolder(StarterPlayer.StarterPlayerScripts, "RoLinkModuleRunners")
		local existingRunner = runnerFolder:FindFirstChild(moduleId .. ".client")
		if existingRunner then
			existingRunner:Destroy()
		end
		local runner = Instance.new("LocalScript")
		runner.Name = moduleId .. ".client"
		runner:SetAttribute("RoLinkModuleId", state.moduleId)
		runner.Source = runtimeSource(moduleId, clientEntrypoint, true)
		runner.Parent = runnerFolder
	end
	return true, string.format("Synced Module Project v2 revision %s into this place.", tostring(projectPackage.projectRevision or "?"))
end

local function syncProjectIntoPlace()
	if not state.connected or state.bridgeCredential == "" then
		setStatus("Pair a module before syncing its project into Studio.", "warning")
		return
	end
	setStatus("Downloading the validated Module Project v2 package...", "info")
	local response, payload = requestJson("GET", "/api/plugin/modules/ide/project", nil, state.bridgeCredential)
	if not response.Success or response.StatusCode >= 300 or type(payload) ~= "table" then
		setStatus((payload and payload.error) or "Could not download the module project.", "error")
		return
	end
	pcall(ChangeHistoryService.SetWaypoint, ChangeHistoryService, "Ro-Link before module project sync")
	local ok, installed, message = pcall(installProjectPackage, payload.projectPackage, tostring(payload.packageHash or ""))
	if not ok then
		setStatus("Studio could not materialize the module project: " .. tostring(installed), "error")
		return
	end
	if not installed then
		setStatus(tostring(message), "error")
		return
	end
	pcall(ChangeHistoryService.SetWaypoint, ChangeHistoryService, "Ro-Link module project synced")
	setStatus(tostring(message), "success")
	sendSnapshot()
end

local toolbar = plugin:CreateToolbar("Ro-Link Module IDE")
local toolbarButton = toolbar:CreateButton("Module IDE", "Connect this Studio place to the Ro-Link Module IDE", TOOLBAR_ICON)
toolbarButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 390, 600, 330, 460)
local widget = plugin:CreateDockWidgetPluginGui("RoLinkModuleIDEWidgetV1", widgetInfo)
widget.Title = "Ro-Link Module IDE"
widget.Name = "RoLinkModuleIDEWidgetV1"
widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

local root = create("ScrollingFrame", {
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	BackgroundColor3 = Color3.fromRGB(11, 15, 23),
	BorderSizePixel = 0,
	CanvasSize = UDim2.fromOffset(0, 0),
	ScrollBarThickness = 5,
	Size = UDim2.fromScale(1, 1),
	Parent = widget,
})
create("UIPadding", {
	PaddingTop = UDim.new(0, 16),
	PaddingBottom = UDim.new(0, 16),
	PaddingLeft = UDim.new(0, 16),
	PaddingRight = UDim.new(0, 16),
	Parent = root,
})
create("UIListLayout", {
	FillDirection = Enum.FillDirection.Vertical,
	Padding = UDim.new(0, 12),
	SortOrder = Enum.SortOrder.LayoutOrder,
	Parent = root,
})

create("TextLabel", {
	BackgroundTransparency = 1,
	Font = Enum.Font.GothamBlack,
	Size = UDim2.new(1, 0, 0, 30),
	Text = "Ro-Link Module IDE",
	TextColor3 = Color3.fromRGB(248, 250, 252),
	TextSize = 22,
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = root,
})
create("TextLabel", {
	BackgroundTransparency = 1,
	Font = Enum.Font.Gotham,
	Size = UDim2.new(1, 0, 0, 42),
	Text = "Live Explorer and script sync for module projects. The browser remains the coding workspace.",
	TextColor3 = Color3.fromRGB(148, 163, 184),
	TextSize = 12,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top,
	Parent = root,
})

local connectionCard = create("Frame", {
	AutomaticSize = Enum.AutomaticSize.Y,
	BackgroundColor3 = Color3.fromRGB(15, 23, 42),
	BorderSizePixel = 0,
	Size = UDim2.new(1, 0, 0, 0),
	Parent = root,
})
rounded(connectionCard, 10)
create("UIPadding", {
	PaddingTop = UDim.new(0, 12),
	PaddingBottom = UDim.new(0, 12),
	PaddingLeft = UDim.new(0, 12),
	PaddingRight = UDim.new(0, 12),
	Parent = connectionCard,
})
create("UIListLayout", { Padding = UDim.new(0, 8), Parent = connectionCard })
create("TextLabel", {
	BackgroundTransparency = 1,
	Font = Enum.Font.GothamBold,
	Size = UDim2.new(1, 0, 0, 18),
	Text = "STUDIO CONNECTION",
	TextColor3 = Color3.fromRGB(125, 211, 252),
	TextSize = 11,
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = connectionCard,
})
ui.connectionLabel = create("TextLabel", {
	BackgroundTransparency = 1,
	Font = Enum.Font.GothamBold,
	Size = UDim2.new(1, 0, 0, 22),
	Text = "DISCONNECTED",
	TextColor3 = Color3.fromRGB(148, 163, 184),
	TextSize = 13,
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = connectionCard,
})
ui.statusLabel = create("TextLabel", {
	AutomaticSize = Enum.AutomaticSize.Y,
	BackgroundTransparency = 1,
	Font = Enum.Font.Gotham,
	Size = UDim2.new(1, 0, 0, 0),
	Text = "Connect your Ro-Link account, then enter the pairing code from the browser IDE.",
	TextColor3 = Color3.fromRGB(148, 163, 184),
	TextSize = 12,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = connectionCard,
})

ui.accountButton = create("TextButton", {
	AutoButtonColor = true,
	BackgroundColor3 = Color3.fromRGB(30, 41, 59),
	BorderSizePixel = 0,
	Font = Enum.Font.GothamBold,
	Size = UDim2.new(1, 0, 0, 36),
	Text = "Connect Ro-Link Account",
	TextColor3 = Color3.fromRGB(248, 250, 252),
	TextSize = 12,
	Parent = root,
})
rounded(ui.accountButton)

ui.codeBox = create("TextBox", {
	BackgroundColor3 = Color3.fromRGB(15, 23, 42),
	BorderSizePixel = 0,
	ClearTextOnFocus = false,
	Font = Enum.Font.Code,
	PlaceholderText = "8-character Module IDE code",
	Size = UDim2.new(1, 0, 0, 42),
	Text = "",
	TextColor3 = Color3.fromRGB(248, 250, 252),
	TextSize = 16,
	TextXAlignment = Enum.TextXAlignment.Center,
	Parent = root,
})
rounded(ui.codeBox)

ui.pairButton = create("TextButton", {
	AutoButtonColor = true,
	BackgroundColor3 = Color3.fromRGB(14, 165, 233),
	BorderSizePixel = 0,
	Font = Enum.Font.GothamBold,
	Size = UDim2.new(1, 0, 0, 40),
	Text = "Pair Module",
	TextColor3 = Color3.fromRGB(255, 255, 255),
	TextSize = 13,
	Parent = root,
})
rounded(ui.pairButton)

create("TextLabel", {
	BackgroundTransparency = 1,
	Font = Enum.Font.GothamBold,
	Size = UDim2.new(1, 0, 0, 20),
	Text = "MODULE TOOLS",
	TextColor3 = Color3.fromRGB(100, 116, 139),
	TextSize = 11,
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = root,
})

local function actionButton(text: string): TextButton
	local button = create("TextButton", {
		Active = false,
		AutoButtonColor = true,
		BackgroundColor3 = Color3.fromRGB(30, 41, 59),
		BorderSizePixel = 0,
		Font = Enum.Font.GothamBold,
		Size = UDim2.new(1, 0, 0, 36),
		Text = text,
		TextColor3 = Color3.fromRGB(226, 232, 240),
		TextSize = 12,
		Parent = root,
	}) :: TextButton
	rounded(button)
	return button
end

ui.importButton = actionButton("Add Selected UI To Module")
ui.syncProjectButton = actionButton("Sync Module Project Into Place")
ui.snapshotButton = actionButton("Refresh Studio Explorer Snapshot")
ui.openIdeButton = actionButton("Open Browser IDE")
ui.openIdeButton.Active = true
ui.disconnectButton = actionButton("Disconnect Module")

create("TextLabel", {
	AutomaticSize = Enum.AutomaticSize.Y,
	BackgroundTransparency = 1,
	Font = Enum.Font.Gotham,
	Size = UDim2.new(1, 0, 0, 0),
	Text = "Security: pairing codes are one-time and short-lived. The plugin receives a module-scoped credential, never your website session or database secrets.",
	TextColor3 = Color3.fromRGB(100, 116, 139),
	TextSize = 11,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = root,
})

ui.accountButton.MouseButton1Click:Connect(beginAccountAuthorization)
ui.pairButton.MouseButton1Click:Connect(pairModule)
ui.importButton.MouseButton1Click:Connect(importSelection)
ui.syncProjectButton.MouseButton1Click:Connect(syncProjectIntoPlace)
ui.snapshotButton.MouseButton1Click:Connect(sendSnapshot)
ui.openIdeButton.MouseButton1Click:Connect(function()
	local suffix = if state.moduleId ~= "" then "?module=" .. HttpService:UrlEncode(state.moduleId) else ""
	openUrl(state.apiBaseUrl:gsub("/+$", "") .. "/dashboard/modules/ide" .. suffix)
end)
ui.disconnectButton.MouseButton1Click:Connect(disconnectModule)

toolbarButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

plugin.Unloading:Connect(function()
	if state.connected then
		sendEvents({ { type = "studio.disconnected", payload = { reason = "plugin_unloading" } } })
	end
	disconnectWatchers()
end)

updateConnectionUi()
if state.bridgeCredential ~= "" then
	task.defer(startBridge)
elseif state.accountToken ~= "" then
	setStatus("Ro-Link account connected. Enter the Module IDE pairing code.", "success")
end
