import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Heart, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-16 h-16 rounded-2xl gradient-calm flex items-center justify-center mx-auto mb-6">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gradient mb-2">404</h1>
          <p className="text-muted-foreground mb-6">
            هذه الصفحة غير موجودة / Page introuvable
          </p>
          <Link href="/">
            <Button className="gap-2" data-testid="button-go-home">
              <Home className="h-4 w-4" />
              الرئيسية / Accueil
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
