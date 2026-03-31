import { useGetMe, useUpdateProfile } from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { data: user } = useGetMe();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [lang, setLang] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || "");
      setLang(user.language || language);
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [user, language]);

  const handleSave = () => {
    updateProfile.mutate(
      {
        data: {
          displayName,
          language: lang,
          timezone,
        }
      },
      {
        onSuccess: () => {
          if (lang !== language && ["en", "no", "es"].includes(lang)) {
            setLanguage(lang as any);
          }
          toast({
            title: t("common.success"),
            description: "Profile updated successfully.",
          });
        },
        onError: () => {
          toast({
            title: t("common.error"),
            description: "Failed to update profile.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{t("settings.title")}</h1>

      <div className="grid gap-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t("settings.profile")}</CardTitle>
            <CardDescription>Manage your public profile information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your studio experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.language")}</Label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="no">Norsk</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.timezone")}</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="bg-background"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateProfile.isPending}
            className="w-full md:w-auto"
          >
            {updateProfile.isPending ? t("common.loading") : t("settings.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
