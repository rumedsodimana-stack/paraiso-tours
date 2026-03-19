"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Package, Users, UserCog, Banknote, Building2, MapPin, LayoutDashboard } from "lucide-react";

type Suggestion = {
  type: string;
  label: string;
  subtitle?: string;
  href: string;
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  booking: Users,
  package: Package,
  tour: MapPin,
  employee: UserCog,
  invoice: FileText,
  payment: Banknote,
  supplier: Building2,
  page: LayoutDashboard,
};

const typeLabels: Record<string, string> = {
  booking: "Booking",
  package: "Package",
  tour: "Tour",
  employee: "Employee",
  invoice: "Invoice",
  payment: "Payment",
  supplier: "Supplier",
  page: "Page",
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setSelectedIndex(0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setOpen(true);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = suggestions[selectedIndex];
      if (s) {
        setOpen(false);
        router.push(s.href);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSelect(s: Suggestion) {
    setOpen(false);
    setQuery("");
    router.push(s.href);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search bookings, packages, tours, invoices..."
          className="h-9 w-72 rounded-xl border border-white/40 bg-white/40 pl-9 pr-4 text-sm placeholder:text-stone-500 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        )}
      </div>

      {open && (suggestions.length > 0 || (query.trim() && !loading)) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-xl border border-white/50 bg-white/95 shadow-xl backdrop-blur-xl">
          {loading ? (
            <div className="p-4 text-center text-sm text-stone-500">
              Searching...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-4 text-center text-sm text-stone-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="py-2">
              {suggestions.map((s, i) => {
                const Icon = typeIcons[s.type] ?? FileText;
                return (
                  <li key={`${s.type}-${s.href}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(s)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                        i === selectedIndex
                          ? "bg-teal-50 text-teal-900"
                          : "hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-stone-900">
                          {s.label}
                        </p>
                        {s.subtitle && (
                          <p className="truncate text-xs text-stone-500">
                            {s.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-stone-400">
                        {typeLabels[s.type]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
