import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  query: string;
  setQuery: (v: string) => void;
  tag: string;
  setTag: (v: string) => void;
  tags: string[];
  launch: string;
  setLaunch: (v: string) => void;
}

export const SolutionFilters = ({ query, setQuery, tag, setTag, tags, launch, setLaunch }: Props) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-card rounded-2xl border border-border shadow-card p-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, tag, or description…"
          className="pl-11 h-11 border-0 bg-secondary/60 focus-visible:ring-2 focus-visible:ring-cyan rounded-xl text-[15px]"
        />
      </div>

      <div className="flex items-center gap-2 lg:border-l lg:border-border lg:pl-3">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />

        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="h-11 w-[160px] border-0 bg-secondary/60 rounded-xl">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={launch} onValueChange={setLaunch}>
          <SelectTrigger className="h-11 w-[170px] border-0 bg-secondary/60 rounded-xl">
            <SelectValue placeholder="Launch date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any launch date</SelectItem>
            <SelectItem value="lt2y">Launched &lt; 2 yrs ago</SelectItem>
            <SelectItem value="2to4">2 – 4 yrs ago</SelectItem>
            <SelectItem value="gt4">Launched &gt; 4 yrs ago</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
