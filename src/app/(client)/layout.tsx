import { ClientHeader } from "./ClientHeader";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-amber-50/30 to-white">
      <ClientHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="border-t border-teal-200/50 py-6 text-center text-sm text-stone-500">
        © Paraíso Ceylon Tours · Sri Lanka
      </footer>
    </div>
  );
}
