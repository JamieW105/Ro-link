param(
    [string]$SourcePath = "roblox/ModuleIDEPlugin/PluginMain.luau",
    [string]$OutputPath = "$env:LOCALAPPDATA/Roblox/Plugins/RoLinkModuleIDEPlugin.rbxmx"
)

$ErrorActionPreference = "Stop"
$source = Get-Content -LiteralPath $SourcePath -Raw
$safeSource = $source.Replace("]]>", "]] ]><![CDATA[>")
$targetDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
}

$xml = @"
<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://assetdelivery.roblox.com/docs/roblox.xsd" version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="Folder" referent="RBX0000000000000001">
    <Properties>
      <string name="Name">RoLinkModuleIDEPlugin</string>
      <int64 name="SourceAssetId">-1</int64>
      <BinaryString name="Tags"></BinaryString>
      <UniqueId name="UniqueId">00000000000000000000000000000000</UniqueId>
    </Properties>
    <Item class="Script" referent="RBX0000000000000002">
      <Properties>
        <bool name="Disabled">false</bool>
        <Content name="LinkedSource"><null></null></Content>
        <string name="Name">PluginMain</string>
        <RunContext name="RunContext">0</RunContext>
        <ProtectedString name="Source"><![CDATA[$safeSource]]></ProtectedString>
        <int64 name="SourceAssetId">-1</int64>
        <BinaryString name="Tags"></BinaryString>
        <UniqueId name="UniqueId">00000000000000000000000000000000</UniqueId>
      </Properties>
    </Item>
    <Item class="StringValue" referent="RBX0000000000000003">
      <Properties>
        <string name="Name">README</string>
        <int64 name="SourceAssetId">-1</int64>
        <BinaryString name="Tags"></BinaryString>
        <UniqueId name="UniqueId">00000000000000000000000000000000</UniqueId>
        <string name="Value">Standalone Ro-Link Module IDE Studio plugin. PluginMain is the entrypoint.</string>
      </Properties>
    </Item>
  </Item>
</roblox>
"@

Set-Content -LiteralPath $OutputPath -Value $xml -Encoding UTF8
Write-Output $OutputPath
