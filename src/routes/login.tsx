import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAccount } from "@/lib/account";
import { AccountSignIn } from "@/components/AccountSignIn";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
    token: z.string().optional(),
    reset: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Sign in | Amsol Ops" }] }),
  component: Login,
});

function Login() {
  const { account } = useAccount();
  const { redirect, token, reset } = Route.useSearch();
  const destination =
    redirect?.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/login")
      ? redirect
      : "/";
  if (account)
    return (
      <Navigate
        to={
          destination === "/" && account.role === "system_admin"
            ? "/system-admin"
            : (destination as "/")
        }
        replace
      />
    );
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 p-5 sm:p-8">
      <main className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-background shadow-2xl md:min-h-[620px] md:grid-cols-[1fr_0.9fr]">
        <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
          <div className="inline-flex w-fit rounded-xl bg-white px-3 py-2">
            <img src="/favicon.png" alt="Amsol" className="h-9 w-auto object-contain" />
          </div>
          <div className="max-w-md">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
              Amsol Integrated Management
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight lg:text-5xl">
              Better work, connected.
            </h1>
            <p className="mt-5 text-base leading-7 text-blue-100/80">
              One secure place for your teams, projects and day-to-day operations.
            </p>
          </div>
          <p className="text-sm text-blue-100/70">Amsol Operations</p>
        </section>
        <div className="flex items-center justify-center p-5 sm:p-10">
          <AccountSignIn token={token} reset={reset} />
        </div>
      </main>
    </div>
  );
}
