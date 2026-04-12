"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, ShoppingBag, PlusSquare, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const items = [
    { href: "/", label: "Browse", icon: Home },
    { href: "/buyer/orders", label: "My Orders", icon: ShoppingBag },
    ...(session?.user.isSellerProfileComplete
      ? [{ href: "/seller/dashboard", label: "Sell", icon: LayoutDashboard }]
      : session
      ? [{ href: "/onboarding", label: "Start Selling", icon: PlusSquare }]
      : [{ href: "/register", label: "Sign Up", icon: PlusSquare }]),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white pb-safe">
      <div className="mx-auto flex max-w-3xl items-center justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-3 text-xs transition-colors",
                active ? "text-orange-500" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-orange-500")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
