'use client';

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

// SVGs
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const KeyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2a5 5 0 0 0-7 7l-9 9v3h3l9-9a5 5 0 0 0 7-7l2-2Z" /><path d="m15 5 4 4" /></svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
);

export default function SetupPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const [step, setStep] = useState(1);
    const [placeId, setPlaceId] = useState("");
    const [universeId, setUniverseId] = useState("");
    const [openCloudKey, setOpenCloudKey] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    const isReadOnly = (session?.user as any)?.id === '953414442060746854';

    useEffect(() => {
        async function checkStatus() {
            if (!id) return;
            const { data, error } = await supabase
                .from('servers')
                .select('*')
                .eq('id', id)
                .single();

            if (data && !error) {
                setApiKey(data.api_key);
                setPlaceId(data.place_id || "");
                setUniverseId(data.universe_id || "");
                setOpenCloudKey(data.open_cloud_key || "");
                setStep(2);
            }
            setInitialLoading(false);
        }
        checkStatus();
    }, [id]);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

    if (isReadOnly) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-slate-400 border border-slate-700 shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">Access Denied</h1>
                <p className="text-slate-400 mb-8 max-w-sm text-sm">You have read-only access to this dashboard. You cannot modify server configuration.</p>
            </div>
        );
    }

    async function handleSetup(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const generatedKey = 'rl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const { error: dbError } = await supabase
            .from('servers')
            .upsert({
                id,
                place_id: placeId,
                universe_id: universeId,
                open_cloud_key: openCloudKey,
                api_key: generatedKey
            });

        if (dbError) {
            setError(dbError.message);
            setLoading(false);
            return;
        }

        setApiKey(generatedKey);
        setStep(2);
        setLoading(false);
    }

    const luaModule = `-- RoLink Core Bridge
-- Place this in a ModuleScript named "RoLink" in ReplicatedStorage
local RoLink = {}
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local MessagingService = game:GetService("MessagingService")

local API_BASE_URL = "${baseUrl}"
local API_KEY = "${apiKey}"
local POLL_INTERVAL = 5

function RoLink:Initialize()
	print("🚀 [Ro-Link] Initializing bridge with MessagingService...")
	
	-- 1. Listen for Instant Commands (Open Cloud)
	task.spawn(function()
		local success, connection = pcall(function()
			return MessagingService:SubscribeAsync("AdminActions", function(message)
				local data = message.Data
				if typeof(data) == "string" then
					data = HttpService:JSONDecode(data)
				end
				print("📩 [Ro-Link] Instant Command Received:", data.command)
				self:Execute(data)
			end)
		end)
		if not success then warn("⚠️ [Ro-Link] MessagingService failed to initialize.") end
	end)

	-- 2. Fallback Polling
	task.spawn(function()
		while true do
			local id = game.JobId
			if id == "" then id = "STUDIO_SESSION_" .. game.PlaceId end
			
			local success, result = pcall(function()
				return HttpService:RequestAsync({
					Url = API_BASE_URL .. "/api/roblox/poll",
					Method = "POST",
					Headers = {
						["Content-Type"] = "application/json",
						["Authorization"] = "Bearer " .. API_KEY
					},
					Body = HttpService:JSONEncode({
						jobId = id,
						playerCount = #Players:GetPlayers(),
						players = (function()
							local pList = {}
							for _, p in ipairs(Players:GetPlayers()) do
								table.insert(pList, p.Name)
							end
							return pList
						end)()
					})
				})
			end)

			if success then
				if result.StatusCode == 200 then
					local data = HttpService:JSONDecode(result.Body)
					for _, cmd in ipairs(data.commands or {}) do
						self:Execute(cmd)
					end
				else
					warn("⚠️ [Ro-Link] API Error: " .. result.StatusCode .. " - " .. result.Body)
				end
			else
				warn("❌ [Ro-Link] Connection Failed: " .. tostring(result))
			end
			task.wait(POLL_INTERVAL)
		end
	end)
end

function RoLink:Execute(cmd)
	local username = cmd.args.username
	local reason = cmd.args.reason or "No reason provided"
	local moderator = cmd.args.moderator or "System"

	if cmd.command == "KICK" then
		local player = Players:FindFirstChild(username)
		if player then player:Kick(reason) end
	elseif cmd.command == "BAN" then
		task.spawn(function()
			local success, userId = pcall(function() return Players:GetUserIdFromNameAsync(username) end)
			if success and userId then
				pcall(function()
					return Players:BanAsync({
						UserIds = {userId},
						Duration = -1,
						DisplayReason = reason,
						PrivateReason = "RoLink Kernel: " .. moderator
					})
				end)
			end
		end)
	elseif cmd.command == "UNBAN" then
		task.spawn(function()
			local success, userId = pcall(function() return Players:GetUserIdFromNameAsync(username) end)
			if success and userId then
				pcall(function()
					return Players:UnbanAsync({
						UserIds = {userId}
					})
				end)
			end
		end)
	elseif cmd.command == "FLY" then
		local player = Players:FindFirstChild(username)
		if player and player.Character then
			local hrp = player.Character:FindFirstChild("HumanoidRootPart")
			if hrp and not hrp:FindFirstChild("RoLinkFly") then
				local bv = Instance.new("BodyVelocity", hrp)
				bv.Name = "RoLinkFly"
				bv.MaxForce = Vector3.new(1,1,1) * 100000
				bv.Velocity = Vector3.new(0,0,0)
			end
		end
	elseif cmd.command == "NOCLIP" then
		local player = Players:FindFirstChild(username)
		if player and player.Character then
			for _, v in pairs(player.Character:GetDescendants()) do
				if v:IsA("BasePart") then v.CanCollide = false end
			end
		end
	elseif cmd.command == "INVIS" then
		local player = Players:FindFirstChild(username)
		if player and player.Character then
			for _, v in pairs(player.Character:GetDescendants()) do
				if v:IsA("BasePart") or v:IsA("Decal") then v.Transparency = 1 end
			end
			if player.Character:FindFirstChild("Head") then player.Character.Head.Transparency = 1 end
		end
	elseif cmd.command == "GHOST" then
		local player = Players:FindFirstChild(username)
		if player and player.Character then
			for _, v in pairs(player.Character:GetDescendants()) do
				if v:IsA("BasePart") or v:IsA("MeshPart") then
					v.Material = Enum.Material.ForceField
				end
			end
		end
	elseif cmd.command == "SET_CHAR" then
		local player = Players:FindFirstChild(username)
		local charUser = cmd.args.char_user
		if player and charUser then
			task.spawn(function()
				local success, userId = pcall(function() return Players:GetUserIdFromNameAsync(charUser) end)
				if success and userId then
					player:LoadCharacterWithHumanoidDescription(Players:GetHumanoidDescriptionFromUserId(userId))
				end
			end)
		end
	elseif cmd.command == "UPDATE" then
		for _, player in ipairs(Players:GetPlayers()) do
			player:Kick("Server is updating. Please rejoin in a moment!")
		end
	elseif cmd.command == "SHUTDOWN" then
		local targetJobId = cmd.args.job_id
		if not targetJobId or targetJobId == game.JobId then
			for _, player in ipairs(Players:GetPlayers()) do
				player:Kick("This server has been shut down by a moderator.")
			end
		end
	end
end

return RoLink`;

    if (initialLoading) return null;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className={`w-full transition-all duration-700 ${step === 1 ? 'max-w-md mx-auto mt-20' : 'max-w-7xl'}`}>
                {step === 1 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 shadow-3xl">
                        <div className="w-12 h-12 bg-sky-600/10 rounded-lg flex items-center justify-center text-sky-500 mb-8 border border-sky-500/10">
                            <SearchIcon />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 tracking-tight">Setup</h1>
                        <p className="text-slate-500 text-sm font-medium mb-8">Connect your Roblox game to Discord.</p>

                        <form onSubmit={handleSetup} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 block">Place ID</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Place ID"
                                        className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-mono"
                                        value={placeId}
                                        onChange={(e) => setPlaceId(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 block">Universe ID</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Universe ID"
                                        className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-mono"
                                        value={universeId}
                                        onChange={(e) => setUniverseId(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1 block">Open Cloud API Key</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Enter Roblox API Key"
                                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-600 transition-all font-mono"
                                    value={openCloudKey}
                                    onChange={(e) => setOpenCloudKey(e.target.value)}
                                />
                            </div>

                            {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider">{error}</p>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-sky-900/10 text-xs disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    "REQUEST AUTH KEY"
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] p-10 shadow-3xl border-l-sky-600 border-l-4">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                                        <CheckIcon />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-tight">Setup Complete</h1>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">STATUS: ACTIVE</p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="bg-black/40 p-5 rounded-xl border border-slate-800">
                                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2 mb-4">
                                            <KeyIcon />
                                            Security Key
                                        </label>
                                        <div className="flex gap-3">
                                            <code className="flex-1 bg-slate-900 px-4 py-3 rounded-lg font-mono text-[11px] text-sky-500 break-all border border-slate-800 shadow-inner">
                                                {apiKey}
                                            </code>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(apiKey)}
                                                className="p-3.5 bg-slate-800 hover:bg-slate-700 transition-all font-bold rounded-lg border border-slate-700"
                                            >
                                                <CopyIcon />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-3 text-slate-300">
                                            <div className="w-1 h-1 bg-sky-600 rounded-full"></div>
                                            How to setup
                                        </h3>
                                        <ol className="space-y-4">
                                            {[
                                                "Create a ModuleScript in ReplicatedStorage named 'RoLink'",
                                                "Paste the Module source code (on the right)",
                                                "Create a Script in ServerScriptService to run it",
                                                "Ensure 'Allow HTTP Requests' is enabled in Game Settings"
                                            ].map((text, i) => (
                                                <li key={i} className="flex gap-4 text-xs font-semibold text-slate-400 p-4 bg-slate-800/20 rounded-xl border border-slate-800/40">
                                                    <span className="text-sky-600">0{i + 1}</span>
                                                    {text}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="bg-black/60 rounded-xl border border-slate-800 h-full flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <CodeIcon />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Core Bridge.lua</span>
                                        </div>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(luaModule)}
                                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold uppercase tracking-tight transition-colors shadow-sm"
                                        >
                                            Copy Source
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto p-6 bg-[#030303] custom-scrollbar">
                                        <div className="space-y-8">
                                            <div>
                                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-3">ModuleScript (RoLink)</p>
                                                <pre className="text-[11px] font-mono leading-relaxed text-slate-500 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                                    {luaModule}
                                                </pre>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-3">Server Script (Starter)</p>
                                                <pre className="text-[11px] font-mono leading-relaxed text-slate-500 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                                    {`-- Put this in ServerScriptService
local RoLink = require(game.ReplicatedStorage:WaitForChild("RoLink"))
RoLink:Initialize()`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-slate-800">
                            <button
                                onClick={() => { setStep(1); setPlaceId(""); }}
                                className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest"
                            >
                                <RefreshIcon />
                                Reset Bridge Handshake
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </div>
    );
}
