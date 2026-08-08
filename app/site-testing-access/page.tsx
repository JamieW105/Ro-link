import Link from 'next/link';
import Image from 'next/image';

export default function SiteTestingAccessPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 py-12 text-white">
            <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950/90 p-8 text-center shadow-2xl shadow-black/40">
                <Image
                    src="/Media/Ro-LinkIcon.png"
                    alt="Ro-Link"
                    width={56}
                    height={56}
                    className="mx-auto rounded-xl object-contain"
                />
                <h1 className="mt-6 text-2xl font-bold tracking-tight">Site testing access required</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                    Your Discord account is signed in, but it does not have permission to view the rolink.site testing environment.
                </p>
                <Link
                    href="/auth/signin"
                    className="mt-7 inline-flex h-11 items-center justify-center rounded-lg bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500"
                >
                    Sign in with another account
                </Link>
            </section>
        </main>
    );
}
