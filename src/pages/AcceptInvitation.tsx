import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const token = searchParams.get("token");

  useEffect(() => {
    let mounted = true;
    
    const checkAuthAndToken = async () => {
      if (!token) {
        if (mounted) {
          setError("Invalid invitation link");
          setIsLoading(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;

      if (!session) {
        // Redirect to auth page with return URL
        const redirectUrl = encodeURIComponent(`/accept-invitation?token=${token}`);
        navigate(`/auth?redirectTo=${redirectUrl}`);
        return;
      }

      setIsLoading(false);
    };

    checkAuthAndToken();

    return () => {
      mounted = false;
    };
  }, [token, navigate]);

  const handleAcceptInvitation = async () => {
    if (!token) return;

    setIsAccepting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const redirectUrl = encodeURIComponent(`/accept-invitation?token=${token}`);
        navigate(`/auth?redirectTo=${redirectUrl}`);
        return;
      }

      console.log('Calling accept-invitation with token:', token);
      console.log('Session user:', session.user.email);
      console.log('Access token present:', !!session.access_token);

      const response = await fetch(
        `https://yasedaxyeogpnhiaqvpk.supabase.co/functions/v1/accept-invitation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();
      console.log('Function response:', { data, status: response.status });

      if (!response.ok) {
        const errorMessage = data.error || "Failed to accept invitation";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (data.error) {
        setError(data.error);
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setSuccess(true);
      toast({
        title: "Success!",
        description: "You've joined the family! Redirecting...",
      });

      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      const errorMessage = error.message || "Failed to accept invitation";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Welcome to the Family!</CardTitle>
            <CardDescription>
              You've successfully joined. Redirecting you to the app...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Unable to Accept Invitation</CardTitle>
            <CardDescription className="text-destructive mt-2">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Users className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Family</CardTitle>
          <CardDescription>
            You've been invited to join a family. Click the button below to accept the invitation and start collaborating.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            disabled={isAccepting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAcceptInvitation}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}