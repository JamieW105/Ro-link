import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/management";

export const dynamic = 'force-dynamic';

type IssueSeverity = 'low' | 'medium' | 'high';
type CheckStatus = 'clear' | 'flagged' | 'limited' | 'error';

interface DiscordGuild {
    id: string;
    name: string;
    icon?: string | null;
}

interface DiscordChannel {
    id: string;
    name?: string;
    type: number;
}

interface DiscordMessage {
    id: string;
    content?: string;
    timestamp?: string;
    author?: {
        id?: string;
        bot?: boolean;
    };
}

interface RuleIssue {
    rule: string;
    severity: IssueSeverity;
    location: 'server_name' | 'message';
    evidence: string;
    translatedEvidence?: string;
    channelName?: string;
    messageUrl?: string;
    authorId?: string;
    messageCreatedAt?: string;
}

interface RulePattern {
    rule: string;
    severity: IssueSeverity;
    patterns: RegExp[];
}

const MAX_SERVERS = Number(process.env.SERVER_RULE_CHECK_MAX_SERVERS || 50);
const MAX_CHANNELS_PER_SERVER = Number(process.env.SERVER_RULE_CHECK_MAX_CHANNELS || 4);
const MAX_MESSAGES_PER_CHANNEL = Number(process.env.SERVER_RULE_CHECK_MAX_MESSAGES || 15);
const MAX_ISSUES_PER_SERVER = 8;
const MAX_TRANSLATIONS_PER_SCAN = Number(process.env.SERVER_RULE_CHECK_MAX_TRANSLATIONS || 30);
const TRANSLATION_BASE_URL = (process.env.TRANSLATION_API_BASE_URL || 'https://lingva.ml').replace(/\/+$/, '');

const CHANNEL_PRIORITY = ['rules', 'general', 'chat', 'announcements', 'main', 'lobby'];

const RULE_PATTERNS: RulePattern[] = [
    {
        rule: 'Robux or Nitro scam language',
        severity: 'high',
        patterns: [
            /\bfree\s+(?:robux|nitro)\b/i,
            /\bclaim\s+(?:your\s+)?(?:robux|nitro|reward|gift)\b/i,
            /\b(?:robux|nitro)\s+(?:generator|giveaway|drop)\b/i,
            /\bverify\s+(?:to\s+)?(?:claim|get|receive)\b/i,
        ],
    },
    {
        rule: 'Phishing or account theft indicators',
        severity: 'high',
        patterns: [
            /\b(?:token\s*grabber|cookie\s*logger|account\s*stealer)\b/i,
            /\b(?:password|2fa|auth\s*code)\s+(?:required|needed|for\s+reward)\b/i,
            /\b(?:discord|roblox)[\w.-]*(?:gift|promo|reward|verify)[\w.-]*\.[a-z]{2,}\b/i,
            /\b(?:bit\.ly|tinyurl\.com|is\.gd|cutt\.ly)\/\S+/i,
        ],
    },
    {
        rule: 'Raid or harassment coordination',
        severity: 'high',
        patterns: [
            /\b(?:raid|nuke|mass\s*ping|mass\s*dm)\b/i,
            /\b(?:dox|doxx|swat)\b/i,
            /\b(?:spam|flood)\s+(?:their|the)\s+(?:server|chat|dms?)\b/i,
        ],
    },
    {
        rule: 'Adult or explicit server content',
        severity: 'medium',
        patterns: [
            /\b(?:nsfw|18\+|adult\s+only)\b/i,
            /\b(?:porn|nudes|onlyfans|explicit)\b/i,
            /\b(?:sex|sexual)\s+(?:content|server|chat)\b/i,
        ],
    },
    {
        rule: 'Malware or exploit distribution',
        severity: 'high',
        patterns: [
            /\b(?:malware|rat|remote\s+access\s+trojan|stealer)\b/i,
            /\b(?:executor|exploit)\s+(?:download|script|injector)\b/i,
            /\b(?:download|run)\s+(?:this\s+)?(?:exe|scr|bat|ps1)\b/i,
        ],
    },
];

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = typeof session.user === 'object' && 'id' in session.user
        ? String((session.user as { id?: unknown }).id || '')
        : '';
    if (!(await hasPermission(userId, 'MANAGE_SERVERS'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!process.env.DISCORD_TOKEN) {
        return NextResponse.json({ error: 'DISCORD_TOKEN is not configured.' }, { status: 500 });
    }

    let requestedGuildIds: Set<string> | null = null;
    try {
        const body = await req.json().catch(() => null);
        if (Array.isArray(body?.guildIds) && body.guildIds.length > 0) {
            requestedGuildIds = new Set(body.guildIds.map((id: unknown) => String(id)));
        }
    } catch {
        requestedGuildIds = null;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const checkedAt = new Date().toISOString();
    let translationCount = 0;

    try {
        const botGuilds = await fetchBotGuilds(rest);
        const matchingGuilds = botGuilds
            .filter((guild) => !requestedGuildIds || requestedGuildIds.has(guild.id));
        const guildsToScan = matchingGuilds.slice(0, Math.max(1, MAX_SERVERS));

        const results = [];
        for (const guild of guildsToScan) {
            const result = await scanGuild(rest, guild, checkedAt, () => translationCount, () => {
                translationCount += 1;
            });
            results.push(result);
        }

        const checkedMessages = results.reduce((sum, result) => sum + result.checkedMessages, 0);
        const translatedMessages = results.reduce((sum, result) => sum + result.translatedMessages, 0);
        const flaggedServers = results.filter((result) => result.issues.length > 0).length;

        return NextResponse.json({
            checkedAt,
            scannedServers: results.length,
            flaggedServers,
            checkedMessages,
            translatedMessages,
            translationProvider: `Lingva (${TRANSLATION_BASE_URL})`,
            capped: matchingGuilds.length > guildsToScan.length,
            maxServers: MAX_SERVERS,
            results,
        });
    } catch (error) {
        console.error('[Management/Servers/RuleCheck] Error:', error);
        return NextResponse.json({ error: 'Failed to run server rule check.' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return POST(req);
}

async function fetchBotGuilds(rest: REST): Promise<DiscordGuild[]> {
    let guilds: DiscordGuild[] = [];
    let after = '0';

    while (true) {
        const data = await rest.get(Routes.userGuilds(), {
            query: new URLSearchParams({ after, limit: '100' }),
        }) as DiscordGuild[];

        if (!Array.isArray(data) || data.length === 0) break;
        guilds = [...guilds, ...data];
        after = data[data.length - 1].id;
        if (data.length < 100) break;
    }

    return guilds;
}

async function scanGuild(
    rest: REST,
    guild: DiscordGuild,
    checkedAt: string,
    getTranslationCount: () => number,
    incrementTranslationCount: () => void,
) {
    const issues: RuleIssue[] = [
        ...findRuleIssues(guild.name || '', 'server_name'),
    ];
    const errors: string[] = [];
    let checkedMessages = 0;
    let translatedMessages = 0;

    try {
        const rawChannels = await rest.get(Routes.guildChannels(guild.id)) as DiscordChannel[];
        const channels = Array.isArray(rawChannels)
            ? rawChannels
                .filter((channel) => channel.type === 0 || channel.type === 5)
                .sort(compareChannels)
                .slice(0, Math.max(1, MAX_CHANNELS_PER_SERVER))
            : [];

        if (channels.length === 0) {
            errors.push('No readable text channels were found.');
        }

        for (const channel of channels) {
            if (issues.length >= MAX_ISSUES_PER_SERVER) break;

            try {
                const messages = await rest.get(Routes.channelMessages(channel.id), {
                    query: new URLSearchParams({ limit: String(MAX_MESSAGES_PER_CHANNEL) }),
                }) as DiscordMessage[];

                for (const message of Array.isArray(messages) ? messages : []) {
                    if (issues.length >= MAX_ISSUES_PER_SERVER) break;
                    if (message.author?.bot) continue;

                    const content = normalizeContent(message.content || '');
                    if (!content) continue;

                    checkedMessages += 1;
                    let translatedText: string | undefined;

                    if (shouldTranslateForReview(content) && getTranslationCount() < MAX_TRANSLATIONS_PER_SCAN) {
                        translatedText = await translateToEnglish(content);
                        if (translatedText && translatedText !== content) {
                            translatedMessages += 1;
                            incrementTranslationCount();
                        }
                    }

                    const messageIssues = [
                        ...findRuleIssues(content, 'message'),
                        ...(translatedText ? findRuleIssues(translatedText, 'message') : []),
                    ];

                    for (const issue of messageIssues) {
                        issues.push({
                            ...issue,
                            evidence: content,
                            translatedEvidence: translatedText && translatedText !== content ? translatedText : undefined,
                            channelName: channel.name || channel.id,
                            messageUrl: `https://discord.com/channels/${guild.id}/${channel.id}/${message.id}`,
                            authorId: message.author?.id,
                            messageCreatedAt: message.timestamp,
                        });
                        if (issues.length >= MAX_ISSUES_PER_SERVER) break;
                    }
                }
            } catch (channelError) {
                errors.push(`Could not scan #${channel.name || channel.id}.`);
                console.error('[Management/Servers/RuleCheck] Channel scan failed:', {
                    guildId: guild.id,
                    channelId: channel.id,
                    channelError,
                });
            }
        }
    } catch (guildError) {
        errors.push('Could not load this server from Discord.');
        console.error('[Management/Servers/RuleCheck] Guild scan failed:', {
            guildId: guild.id,
            guildError,
        });
    }

    const status: CheckStatus = issues.length > 0
        ? 'flagged'
        : errors.length > 0
            ? checkedMessages > 0 ? 'limited' : 'error'
            : 'clear';

    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon || null,
        checkedAt,
        status,
        checkedMessages,
        translatedMessages,
        issues: dedupeIssues(issues).slice(0, MAX_ISSUES_PER_SERVER),
        errors,
    };
}

function compareChannels(a: DiscordChannel, b: DiscordChannel) {
    return channelScore(a) - channelScore(b);
}

function channelScore(channel: DiscordChannel) {
    const name = (channel.name || '').toLowerCase();
    const priorityIndex = CHANNEL_PRIORITY.findIndex((term) => name.includes(term));
    return priorityIndex === -1 ? CHANNEL_PRIORITY.length : priorityIndex;
}

function findRuleIssues(text: string, location: RuleIssue['location']): RuleIssue[] {
    const matches: RuleIssue[] = [];
    const normalized = normalizeContent(text);
    if (!normalized) return matches;

    for (const rule of RULE_PATTERNS) {
        if (rule.patterns.some((pattern) => pattern.test(normalized))) {
            matches.push({
                rule: rule.rule,
                severity: rule.severity,
                location,
                evidence: truncate(normalized, 240),
            });
        }
    }

    return matches;
}

function dedupeIssues(issues: RuleIssue[]) {
    const seen = new Set<string>();
    return issues.filter((issue) => {
        const key = `${issue.rule}:${issue.location}:${issue.channelName || ''}:${issue.evidence}:${issue.translatedEvidence || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeContent(content: string) {
    return content
        .replace(/<a?:\w+:\d+>/g, '')
        .replace(/<@!?\d+>|<@&\d+>|<#\d+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shouldTranslateForReview(content: string) {
    const text = content.trim();
    if (text.length < 8) return false;
    if (/https?:\/\/\S+/i.test(text) && text.split(/\s+/).length < 4) return false;

    const letters = text.match(/\p{L}/gu) || [];
    if (letters.length < 5) return false;

    const nonAsciiLetters = letters.filter((char) => char.charCodeAt(0) > 127).length;
    if (nonAsciiLetters / letters.length > 0.15) return true;

    const words = text.toLowerCase().match(/[a-z]{2,}/g) || [];
    if (words.length < 3) return false;

    const commonEnglishWords = new Set([
        'the', 'and', 'you', 'that', 'have', 'for', 'not', 'with', 'this', 'are',
        'from', 'but', 'they', 'his', 'her', 'she', 'will', 'one', 'all', 'can',
        'what', 'when', 'your', 'just', 'about', 'there', 'their', 'would', 'server',
        'please', 'thanks', 'hello', 'welcome', 'rules', 'chat', 'game', 'roblox',
    ]);
    const commonMatches = words.filter((word) => commonEnglishWords.has(word)).length;
    return commonMatches / words.length < 0.18;
}

async function translateToEnglish(content: string) {
    const query = truncate(
        content
            .replace(/https?:\/\/\S+/gi, '[link]')
            .replace(/[`*_~|]/g, ''),
        450,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
        const response = await fetch(`${TRANSLATION_BASE_URL}/api/v1/auto/en/${encodeURIComponent(query)}`, {
            cache: 'no-store',
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) return undefined;
        const data = await response.json() as { translation?: unknown; error?: unknown };
        if (typeof data.translation !== 'string') return undefined;
        return normalizeContent(data.translation);
    } catch (error) {
        console.error('[Management/Servers/RuleCheck] Translation failed:', error);
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
}

function truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
