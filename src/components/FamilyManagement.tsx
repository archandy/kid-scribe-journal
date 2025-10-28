import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, Mail, Copy, Trash2, Shield, Crown, Pencil, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FamilyMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  label?: string | null;
  profiles: {
    email: string;
    full_name: string | null;
    avatar_url?: string | null;
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
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

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
        .select('family_id, role')
        .eq('user_id', user.id)
        .single();

      if (!myFamily) return;

      // Store current user's role
      setCurrentUserRole(myFamily.role);

      const { data: membersData, error: membersError } = await supabase
        .from('family_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          label
        `)
        .eq('family_id', myFamily.family_id)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      // Fetch profiles separately
      const userIds = membersData?.map(m => m.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      // Merge members with profiles
      const membersWithProfiles = membersData?.map(member => ({
        ...member,
        profiles: profilesData?.find(p => p.id === member.user_id) || { email: '', full_name: null, avatar_url: null }
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
          title: t('invite.errorDesc'),
          description: t('invite.mustLogin'),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log('Sending invitation to:', email);

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { email }
      });

      console.log('Invitation response:', { data, error });

      if (error) {
        console.error('Function invoke error:', error);
        throw error;
      }

      if (data?.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (!data?.invitationLink) {
        console.error('No invitation link in response:', data);
        toast({
          title: t('invite.errorDesc'),
          description: t('family.inviteLinkError'),
          variant: "destructive",
        });
        return;
      }

      setEmail("");
      setGeneratedLink(data.invitationLink);
      await fetchFamilyData();

      toast({
        title: t('family.inviteLinkGen'),
        description: t('family.inviteLinkGenDesc'),
      });

    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: t('invite.errorDesc'),
        description: error.message || t('family.inviteError'),
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
      title: t('family.copied'),
      description: t('family.linkCopied'),
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
        title: t('family.inviteCancelled'),
        description: t('family.inviteCancelledDesc'),
      });

      fetchFamilyData();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: t('invite.errorDesc'),
        description: t('family.inviteCancelError'),
        variant: "destructive",
      });
    } finally {
      setInvitationToCancel(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default" className="gap-1"><Crown className="h-3 w-3" /> {t('family.owner')}</Badge>;
      case 'admin':
        return <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> {t('family.admin')}</Badge>;
      default:
        return <Badge variant="outline">{t('family.member')}</Badge>;
    }
  };

  const handleUpdateLabel = async () => {
    if (!editingMemberId) return;

    // Check if user is owner
    if (currentUserRole !== 'owner') {
      toast({
        title: t('family.permissionDenied'),
        description: t('family.onlyOwner'),
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .update({ label: editingLabel || null })
        .eq('id', editingMemberId);

      if (error) throw error;

      toast({
        title: t('family.labelUpdated'),
        description: t('family.labelUpdateSuccess'),
      });

      fetchFamilyData();
      setEditingMemberId(null);
      setEditingLabel("");
    } catch (error: any) {
      console.error('Error updating label:', error);
      toast({
        title: t('invite.errorDesc'),
        description: t('family.labelUpdateError'),
        variant: "destructive",
      });
    }
  };

  const openEditLabel = (member: FamilyMember) => {
    // Only owners can edit labels
    if (currentUserRole !== 'owner') {
      toast({
        title: t('family.permissionDenied'),
        description: t('family.onlyOwner'),
        variant: "destructive",
      });
      return;
    }
    setEditingMemberId(member.id);
    setEditingLabel(member.label || "");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('family.inviteTitle')}
          </CardTitle>
          <CardDescription>
            {t('family.inviteDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t('family.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('family.generating') : t('family.generateLink')}
              </Button>
            </div>
            
            {generatedLink && (
              <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                <p className="text-sm font-medium">{t('family.invitationLink')}</p>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(generatedLink);
                      toast({
                        title: t('family.copied'),
                        description: t('family.linkCopied'),
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('family.shareInstructions')}
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('family.pendingTitle')}</CardTitle>
            <CardDescription>
              {t('family.pendingDesc')}
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
                      {t('family.sent')} {new Date(invitation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyInvitationLink(invitation.token)}
                      title={t('family.copyLink')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setInvitationToCancel(invitation.id)}
                      title={t('family.cancelInvite')}
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
            {t('family.membersTitle')}
          </CardTitle>
          <CardDescription>
            {t('family.membersDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    {member.profiles?.avatar_url ? (
                      <AvatarImage src={member.profiles.avatar_url} alt={member.profiles.full_name || ''} />
                    ) : null}
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {member.profiles?.full_name || member.profiles?.email}
                      </p>
                      {member.label && (
                        <Badge variant="outline" className="text-xs">
                          {member.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {member.profiles?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentUserRole === 'owner' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditLabel(member)}
                      title={t('family.editLabel')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {getRoleBadge(member.role)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!invitationToCancel} onOpenChange={() => setInvitationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('family.cancelInviteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('family.cancelInviteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('family.keepIt')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToCancel && handleCancelInvitation(invitationToCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('family.cancelIt')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingMemberId} onOpenChange={() => setEditingMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('family.editLabelTitle')}</DialogTitle>
            <DialogDescription>
              {t('family.editLabelDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">{t('family.label')}</Label>
              <Input
                id="label"
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                placeholder={t('family.labelPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMemberId(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateLabel}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}