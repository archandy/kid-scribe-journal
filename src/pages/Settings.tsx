import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Link as LinkIcon, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const [databaseId, setDatabaseId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

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
      
      const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      // Open in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        authUrl,
        'Notion OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notion_tokens')
        .update({ database_id: databaseId })
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
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        <Card className="border-border/50 shadow-elegant bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Notion Integration
            </CardTitle>
            <CardDescription>
              Connect your Notion workspace to save journal entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Connected to Notion</p>
                      <p className="text-sm text-muted-foreground">
                        Your workspace is linked
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Not connected</p>
                      <p className="text-sm text-muted-foreground">
                        Connect to start saving entries
                      </p>
                    </div>
                  </>
                )}
              </div>
              {isConnected ? (
                <Button variant="outline" onClick={disconnectNotion}>
                  Disconnect
                </Button>
              ) : (
                <Button onClick={connectToNotion}>
                  Connect to Notion
                </Button>
              )}
            </div>

            {isConnected && (
              <div className="space-y-3">
                <Label htmlFor="database-id">
                  Notion Database ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="database-id"
                    placeholder="e.g., 1234567890abcdef..."
                    value={databaseId}
                    onChange={(e) => setDatabaseId(e.target.value)}
                  />
                  <Button onClick={saveDatabaseId}>
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Find this in your Notion database URL or share menu
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}