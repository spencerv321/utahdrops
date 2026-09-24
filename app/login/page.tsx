import type { Metadata } from "next";
import { Bell, CalendarDays, Star } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-6 pt-4 sm:pt-12">
      <div className="space-y-2">
        <h1 className="text-4xl leading-none">Get alerts, free</h1>
        <p className="text-muted-foreground">
          No password. We email you a link, and you&apos;re in.
        </p>
      </div>
      <ul className="space-y-3 rounded-2xl border bg-card p-4 text-[15px]">
        <li className="flex gap-3">
          <Star className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          Watch any bottle and get an email when it&apos;s back.
        </li>
        <li className="flex gap-3">
          <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          Pick your store and hear when it&apos;s back there.
        </li>
        <li className="flex gap-3">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          Know the minute the allocated list posts.
        </li>
      </ul>
      <LoginForm next={next ?? "/"} />
      <p className="text-xs text-muted-foreground">
        We only email you about bottles and drops you ask about. Not affiliated with DABS.
      </p>
    </div>
  );
}
