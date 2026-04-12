"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

function getDateLabel(dateStr: string) {
  const today = new Date();
  const d = parseISO(dateStr);
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  return format(d, "EEE d");
}

export function DateTabBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = format(new Date(), "yyyy-MM-dd");
  const selectedDate = searchParams.get("date") ?? today;

  const dates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(new Date(), i), "yyyy-MM-dd")
  );

  function selectDate(date: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {dates.map((date) => (
        <button
          key={date}
          onClick={() => selectDate(date)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            date === selectedDate
              ? "bg-orange-500 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          )}
        >
          {getDateLabel(date)}
        </button>
      ))}
    </div>
  );
}
