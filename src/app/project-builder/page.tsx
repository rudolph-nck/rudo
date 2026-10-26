import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUIDES } from "@/lib/project-builder/guides";
import { PB_COOKIE, verifySessionToken } from "@/lib/project-builder/session";

export const metadata: Metadata = {
  title: "Project Builder — RUDO.AI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProjectBuilderPage() {
  const cookieStore = await cookies();
  if (!(await verifySessionToken(cookieStore.get(PB_COOKIE)?.value))) {
    redirect("/project-builder/login");
  }

  return (
    <div className="min-h-screen bg-rudo-content-bg text-rudo-dark-text font-outfit">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              How-to guides
            </p>
            <h1 className="font-instrument text-4xl tracking-[-1px]">Project Builder</h1>
          </div>
          <form action="/api/project-builder/logout" method="post">
            <button className="text-sm text-rudo-dark-text-sec underline underline-offset-4">
              Log out
            </button>
          </form>
        </div>

        <ul className="space-y-4">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <a
                href={`/project-builder/${g.slug}`}
                className="block bg-rudo-card-bg border border-rudo-card-border hover:border-rudo-card-border-hover p-5 transition-colors"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {g.tags.map((t) => (
                    <span
                      key={t}
                      className="font-orbitron text-[9px] tracking-[1.5px] uppercase text-rudo-dark-muted border border-rudo-card-border px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-semibold mb-1">{g.title}</h2>
                <p className="text-sm text-rudo-dark-text-sec">{g.description}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
