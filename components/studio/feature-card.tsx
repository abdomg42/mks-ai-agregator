// Carte d'information de la fonctionnalité active : nom PRODUIT + une
// ligne de description. Mise en évidence (bordure primaire) pour ancrer
// l'utilisateur dans la fonctionnalité courante.
import { Card, CardContent } from "@/components/ui/card";

interface FeatureCardProps {
  name: string;
  tagline: string;
}

export function FeatureCard({ name, tagline }: FeatureCardProps) {
  return (
    <Card className="border-primary/60 bg-primary/5">
      <CardContent className="p-4">
        <p className="text-sm font-semibold">{name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{tagline}</p>
      </CardContent>
    </Card>
  );
}
