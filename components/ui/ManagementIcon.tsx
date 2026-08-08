import { ArrowLeft, CircleHelp, ExternalLink, FileText, Info, LogOut, Pencil, Plus, ShieldCheck, Trash2, UserPlus, X, type LucideProps } from "lucide-react";

const icons = {
    back: ArrowLeft,
    close: X,
    delete: Trash2,
    edit: Pencil,
    external: ExternalLink,
    help: CircleHelp,
    info: Info,
    logout: LogOut,
    new: Plus,
    document: FileText,
    permission: ShieldCheck,
    userAdd: UserPlus,
} as const;

export function ManagementIcon({ name, ...props }: LucideProps & { name: keyof typeof icons }) {
    const Icon = icons[name];
    return <Icon aria-hidden="true" fill="none" {...props} />;
}
