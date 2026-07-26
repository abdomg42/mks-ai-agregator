"use client";

// Sélecteur de modèle — dropdown (Featured / All models, badges New/Premium).
// L'utilisateur choisit QUEL candidat interne est essayé en premier ; le
// fallback reste automatique et invisible. Seuls des noms PRODUIT sont
// affichés (lib/model-options.ts), jamais d'identifiant d'API.
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModelOption } from "@/lib/model-options";

interface ModelPickerProps {
  options: ModelOption[];
  value: string;
  onChange: (id: string) => void;
}

function ModelSelectItem({ option }: { option: ModelOption }) {
  return (
    <SelectItem value={option.id}>
      <span className="flex items-center gap-2">
        <span>{option.name}</span>
        {option.badge && (
          <Badge variant={option.badge === "Premium" ? "default" : "secondary"} className="px-1 py-0 text-[10px]">
            {option.badge}
          </Badge>
        )}
      </span>
    </SelectItem>
  );
}

export function ModelPicker({ options, value, onChange }: ModelPickerProps) {
  const featured = options.filter((option) => option.section === "featured");
  const all = options.filter((option) => option.section === "all");
  const selected = options.find((option) => option.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choose a model">{selected?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Featured</SelectLabel>
          {featured.map((option) => (
            <ModelSelectItem key={option.id} option={option} />
          ))}
        </SelectGroup>
        {all.length > 0 && (
          <SelectGroup>
            <SelectLabel>All models</SelectLabel>
            {all.map((option) => (
              <ModelSelectItem key={option.id} option={option} />
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
