import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Link as LinkIcon, CheckCircle2, XCircle, LogOut, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { z } from "zod";

// Validation schema for Notion database ID
const databaseIdSchema = z.string()
  .trim()
  .min(32, "Database ID must be at least 32 characters")
  .max(36, "Database ID must be less than 36 characters")
  .regex(/^[a-f0-9-]+$/, "Invalid database ID format");

export default function Settings() {
  const [databaseId, setDatabaseId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    checkConnection();

    // Listen for OAuth success
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NOTION_AUTH_SUCCESS') {
        checkConnection();
        toast({
          title: "Connected to Notion",
          description: "You can now save journal entries to your Notion workspace.",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notion_tokens')
        .select('database_id')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setIsConnected(true);
        setDatabaseId(data.database_id || "");
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectToNotion = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "Please sign in first.",
          variant: "destructive",
        });
        return;
      }

      const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notion-oauth-callback`;
      
      // Get user session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast({
          title: "Session error",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Generate secure state token for CSRF protection
      const { data: stateData, error: stateError } = await supabase.functions.invoke(
        'generate-oauth-state',
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (stateError || !stateData?.state_token) {
        console.error('Failed to generate state token:', stateError);
        toast({
          title: "Connection failed",
          description: "Failed to initialize OAuth flow. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Detect mobile and use redirect with state parameter instead of popup
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Use secure state token for CSRF protection
      let authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(stateData.state_token)}`;
      
      if (isMobile) {
        // Mobile: redirect directly
        window.location.href = authUrl;
      } else {
        // Desktop: open in popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        window.open(
          authUrl,
          'Notion OAuth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    } catch (error) {
      console.error('Error connecting to Notion:', error);
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveDatabaseId = async () => {
    if (!databaseId.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter a database ID",
        variant: "destructive",
      });
      return;
    }

    // Validate database ID format
    const validationResult = databaseIdSchema.safeParse(databaseId);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || "Invalid database ID";
      toast({
        title: "Validation error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notion_tokens')
        .update({ database_id: validationResult.data })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Database ID saved",
        description: "You can now save journal entries to this database.",
      });
    } catch (error) {
      console.error('Error saving database ID:', error);
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const disconnectNotion = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notion_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsConnected(false);
      setDatabaseId("");
      
      toast({
        title: "Disconnected from Notion",
        description: "Your Notion connection has been removed.",
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Disconnect failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: t('settings.signOut'),
        description: "Signed out successfully",
      });
      navigate('/auth');
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          </div>
          <LanguageSelector />
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 shadow-soft bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('settings.manageChildren')}
              </CardTitle>
              <CardDescription>
                Add and manage your children's profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/children")}
                variant="outline"
                className="w-full"
              >
                <Users className="mr-2 h-4 w-4" />
                {t('settings.manageChildren')}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-soft bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                {t('settings.notion')}
              </CardTitle>
              <CardDescription>
                {t('settings.notionDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">{t('settings.connected')}</p>
                        <p className="text-sm text-muted-foreground">
                          Your workspace is linked
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{t('settings.notConnected')}</p>
                        <p className="text-sm text-muted-foreground">
                          Connect to start saving entries
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {isConnected ? (
                  <Button variant="outline" onClick={disconnectNotion}>
                    {t('settings.disconnect')}
                  </Button>
                ) : (
                  <Button onClick={connectToNotion}>
                    {t('settings.connect')}
                  </Button>
                )}
              </div>

              {isConnected && (
                <div className="space-y-3">
                  <Label htmlFor="database-id">
                    Parent Page ID (Optional)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="database-id"
                      placeholder="Leave empty to create in workspace root"
                      value={databaseId}
                      onChange={(e) => setDatabaseId(e.target.value)}
                    />
                    <Button onClick={saveDatabaseId}>
                      {t('common.save')}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optional: Provide a Notion page ID to create journal entries as sub-pages. Leave empty to create pages in your workspace root.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-soft bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>{t('settings.account')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('settings.signOut')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}