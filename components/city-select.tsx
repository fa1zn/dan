"use client";

import { useRouter } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import type { CityOption } from "@/lib/territory";

export function CitySelect({ cities, current }: { cities: CityOption[]; current: string }) {
  const router = useRouter();
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const [city, state] = v.split("|");
        router.push(`/territory?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
      }}
    >
      <SelectTrigger className="w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cities.map((c) => (
          <SelectItem key={`${c.city}|${c.state}`} value={`${c.city}|${c.state}`}>
            {c.city}, {c.state} · {c.count} dealers
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
