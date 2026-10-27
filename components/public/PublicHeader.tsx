'use client';
import { BookOpen, BriefcaseBusiness, ChevronDown, Flag, Menu, MessageCircle, Newspaper } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DashboardTheme } from '@/components/dashboard/DashboardTheme';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { getDiscordBotInviteUrl } from '@/lib/discordInvite';

const mainLinks = [{href:'/',label:'Overview'}, {href:'/features',label:'Features'}, {href:'/pricing',label:'Pricing'}, {href:'/#setup',label:'Setup'}];
const helpLinks = [
    {href:'https://discord.gg/C3n4nAwYMw',label:'Support server',icon:MessageCircle,external:true},
    {href:'/report',label:'Reports',icon:Flag}, {href:'/careers',label:'Careers',icon:BriefcaseBusiness},
    {href:'/docs',label:'Documentation',icon:BookOpen}, {href:'/posts',label:'Posts',icon:Newspaper},
];
export function PublicHeader() {
    const pathname=usePathname();
    const {status}=useSession();
    const signedIn=status==='authenticated';
    const active=(href:string)=>href==='/'?pathname==='/':pathname===href||pathname.startsWith(`${href}/`);
    return <DashboardTheme><header data-public-header className="sticky top-0 z-50 border-b border-border bg-background">
        <nav aria-label="Primary navigation" className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
            <Link href="/" aria-label="Ro-Link home" className="mr-auto flex shrink-0 items-center gap-2 text-sm font-semibold"><Image src="/Media/Ro-LinkIcon.png" alt="" width={28} height={28} className="size-7 object-contain" />Ro-Link</Link>
            <div className="hidden items-center gap-1 lg:flex">
                {mainLinks.map(link=><Button asChild key={link.href} variant="ghost" size="sm" className={active(link.href)?'bg-accent':''}><Link href={link.href} aria-current={active(link.href)?'page':undefined}>{link.label}</Link></Button>)}
                <DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" />}>Help<ChevronDown className="size-3.5" /></DropdownMenuTrigger>
                    <DropdownMenuContent>{helpLinks.map(({href,label,icon:Icon,external})=><DropdownMenuItem key={href} render={<Link href={href} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined} />}><Icon className="size-4" aria-hidden="true" />{label}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
                <ThemeToggle />
                {signedIn ? <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard">Dashboard</Link></Button> : <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={()=>signIn('discord',{callbackUrl:'/dashboard'})}>Sign in</Button>}
                <Button asChild size="sm" className="hidden sm:inline-flex"><a href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer">Install Ro-Link</a></Button>
                <DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon" className="size-8 lg:hidden" aria-label="Open navigation menu" />}><Menu className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent className="lg:hidden">
                        {mainLinks.map(link=><DropdownMenuItem key={link.href} render={<Link href={link.href} />}>{link.label}</DropdownMenuItem>)}
                        {helpLinks.map(({href,label,icon:Icon,external})=><DropdownMenuItem key={href} render={<Link href={href} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined} />}><Icon className="size-4" aria-hidden="true" />{label}</DropdownMenuItem>)}
                        {signedIn ? <DropdownMenuItem render={<Link href="/dashboard" />}>Dashboard</DropdownMenuItem> : <DropdownMenuItem onClick={()=>signIn('discord',{callbackUrl:'/dashboard'})}>Sign in</DropdownMenuItem>}
                        <DropdownMenuItem render={<a href={getDiscordBotInviteUrl()} target="_blank" rel="noopener noreferrer" />}>Install Ro-Link</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    </header></DashboardTheme>;
}
