local UIManager = {}

local pluginGui
local uiElements = {}
local syncCallback = nil

function UIManager.createUI(plugin: Plugin)
	local toolbar = plugin:CreateToolbar("RoLink Security")
	local button = toolbar:CreateButton("RoLink Sync", "Manage your RoLink Connection", "rbxassetid://1507949215")
	
	local widgetInfo = DockWidgetPluginGuiInfo.new(
		Enum.InitialDockState.Right, false, false, 300, 400, 250, 300
	)
	
	pluginGui = plugin:CreateDockWidgetPluginGui("RoLinkSettings", widgetInfo)
	pluginGui.Title = "RoLink Dashboard"
	
	local mainFrame = Instance.new("Frame")
	mainFrame.Size = UDim2.new(1, 0, 1, 0)
	mainFrame.BackgroundColor3 = Color3.fromRGB(35, 37, 43)
	mainFrame.Parent = pluginGui
	
	local layout = Instance.new("UIListLayout")
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0, 15)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.Parent = mainFrame
	
	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 20)
	padding.Parent = mainFrame
	
	uiElements.StatusLabel = Instance.new("TextLabel")
	uiElements.StatusLabel.Size = UDim2.new(0.9, 0, 0, 30)
	uiElements.StatusLabel.BackgroundTransparency = 1
	uiElements.StatusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
	uiElements.StatusLabel.Font = Enum.Font.GothamBold
	uiElements.StatusLabel.TextSize = 18
	uiElements.StatusLabel.LayoutOrder = 1
	uiElements.StatusLabel.Parent = mainFrame
	
	uiElements.MessageLabel = Instance.new("TextLabel")
	uiElements.MessageLabel.Size = UDim2.new(0.9, 0, 0, 60)
	uiElements.MessageLabel.BackgroundTransparency = 1
	uiElements.MessageLabel.TextColor3 = Color3.fromRGB(180, 180, 180)
	uiElements.MessageLabel.Font = Enum.Font.Gotham
	uiElements.MessageLabel.TextSize = 14
	uiElements.MessageLabel.TextWrapped = true
	uiElements.MessageLabel.LayoutOrder = 2
	uiElements.MessageLabel.Parent = mainFrame
	
	-- TextBox for copying URLs securely
	uiElements.UrlBox = Instance.new("TextBox")
	uiElements.UrlBox.Size = UDim2.new(0.85, 0, 0, 35)
	uiElements.UrlBox.BackgroundColor3 = Color3.fromRGB(20, 22, 26)
	uiElements.UrlBox.TextColor3 = Color3.fromRGB(100, 180, 255)
	uiElements.UrlBox.Font = Enum.Font.Code
	uiElements.UrlBox.TextSize = 12
	uiElements.UrlBox.TextEditable = false
	uiElements.UrlBox.ClearTextOnFocus = false
	uiElements.UrlBox.Visible = false
	uiElements.UrlBox.LayoutOrder = 3
	uiElements.UrlBox.Parent = mainFrame
	
	local urlCorner = Instance.new("UICorner", uiElements.UrlBox)
	urlCorner.CornerRadius = UDim.new(0, 4)
	
	uiElements.SyncButton = Instance.new("TextButton")
	uiElements.SyncButton.Size = UDim2.new(0.85, 0, 0, 45)
	uiElements.SyncButton.BackgroundColor3 = Color3.fromRGB(0, 132, 255)
	uiElements.SyncButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	uiElements.SyncButton.Font = Enum.Font.GothamMedium
	uiElements.SyncButton.TextSize = 15
	uiElements.SyncButton.Text = "Sync Now"
	uiElements.SyncButton.Visible = false
	uiElements.SyncButton.LayoutOrder = 4
	uiElements.SyncButton.Parent = mainFrame
	
	local btnCorner = Instance.new("UICorner", uiElements.SyncButton)
	btnCorner.CornerRadius = UDim.new(0, 6)
	
	button.Click:Connect(function()
		pluginGui.Enabled = not pluginGui.Enabled
	end)
	
	uiElements.SyncButton.MouseButton1Click:Connect(function()
		if syncCallback then syncCallback() end
	end)
	
	return uiElements
end

function UIManager.updateState(state)
	if not pluginGui then return end
	
	if state.status then
		uiElements.StatusLabel.Text = state.status
		if state.status == "Ready" then
			uiElements.StatusLabel.TextColor3 = Color3.fromRGB(70, 240, 120)
		elseif state.status == "Error" or state.status == "Not Configured" then
			uiElements.StatusLabel.TextColor3 = Color3.fromRGB(240, 70, 70)
		else
			uiElements.StatusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
		end
	end
	
	if state.message then
		uiElements.MessageLabel.Text = state.message
	end
	
	if state.lastSync then
		uiElements.MessageLabel.Text = uiElements.MessageLabel.Text .. "\n\nLast Sync: " .. state.lastSync
	end
	
	-- Handle action triggers safely
	if state.actionUrl then
		uiElements.UrlBox.Text = state.actionUrl
		uiElements.UrlBox.Visible = true
		uiElements.SyncButton.Visible = false
	elseif state.onSync then
		uiElements.UrlBox.Visible = false
		uiElements.SyncButton.Visible = true
		syncCallback = state.onSync
	else
		uiElements.UrlBox.Visible = false
		uiElements.SyncButton.Visible = false
	end
end

return UIManager
