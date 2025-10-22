import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, Mail, Copy, Trash2, Shield, Crown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface FamilyMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
}

export default function FamilyManagement() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    try {
      // Fetch family members
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: myFamily } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (!myFamily) return;

      const { data: membersData, error: membersError } = await supabase
        .from('family_members')
        .select(`
          id,
          user_id,
          role,
          joined_at
        `)
        .eq('family_id', myFamily.family_id)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      // Fetch profiles separately
      const userIds = membersData?.map(m => m.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      // Merge members with profiles
      const membersWithProfiles = membersData?.map(member => ({
        ...member,
        profiles: profilesData?.find(p => p.id === member.user_id) || { email: '', full_name: null }
      })) || [];

      setMembers(membersWithProfiles);

      // Fetch invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('family_id', myFamily.family_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitationsError) throw invitationsError;
      setInvitations(invitationsData || []);

    } catch (error) {
      console.error('Error fetching family data:', error);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to send invitations",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { email },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setEmail("");
      fetchFamilyData();

      // Copy invitation link to clipboard
      if (data.invitationLink) {
        await navigator.clipboard.writeText(data.invitationLink);
        toast({
          title: "Invitation link created!",
          description: "The link has been copied to your clipboard. Share it with your family member.",
        });
      }

    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyInvitationLink = async (token: string) => {
    const link = `${window.location.origin}/accept-invitation?token=${token}`;
    await navigator.clipboard.writeText(link);
    toast({
      title: "Link copied!",
      description: "Invitation link has been copied to your clipboard",
    });
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('family_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled",
      });

      fetchFamilyData();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    } finally {
      setInvitationToCancel(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default" className="gap-1"><Crown className="h-3 w-3" /> Owner</Badge>;
      case 'admin':
        return <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>;
      default:
        return <Badge variant="outline">Member</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Family Member
          </CardTitle>
          <CardDescription>
            Create an invitation link to share with another parent or guardian
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvitation} className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Link"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations waiting to be accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Sent {new Date(invitation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyInvitationLink(invitation.token)}
                      title="Copy invitation link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setInvitationToCancel(invitation.id)}
                      title="Cancel invitation"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Family Members
          </CardTitle>
          <CardDescription>
            People who can access and edit your family's data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {member.profiles?.full_name || member.profiles?.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.profiles?.email}
                  </p>
                </div>
                {getRoleBadge(member.role)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!invitationToCancel} onOpenChange={() => setInvitationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invitation? The recipient will no longer be able to use this invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToCancel && handleCancelInvitation(invitationToCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}