import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Building2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState<"student" | "librarian">("student");
  const [librarianOrgName, setLibrarianOrgName] = useState("");
  const [grade, setGrade] = useState("");
  const [age, setAge] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [showOrgCreation, setShowOrgCreation] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has a profile with organization
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          // User needs to complete profile setup
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();

          if (roleData?.role === "librarian") {
            setShowOrgCreation(true);
            setPendingUserId(session.user.id);
          } else {
            // Student without profile - needs to select org
            navigate("/");
          }
        } else if (profile.organization_id) {
          navigate("/");
        } else {
          // Profile exists but no org - redirect to setup
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();

          if (roleData?.role === "librarian") {
            setShowOrgCreation(true);
            setPendingUserId(session.user.id);
          }
        }
      }
    };
    checkSession();
  }, [navigate]);

  // Fetch organizations for student signup using the public view
  // This view only exposes id and name, not the created_by UUID
  useEffect(() => {
    const fetchOrganizations = async () => {
      // Use the organizations_public view which only exposes safe columns
      const { data, error } = await supabase
        .from("organizations_public")
        .select("id, name")
        .order("name");
      
      if (!error && data) {
        setOrganizations(data);
      }
    };

    if (!isLogin) {
      fetchOrganizations();
    }
  }, [isLogin]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !pendingUserId) return;

    setLoading(true);
    try {
      // Create the organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: newOrgName.trim(), created_by: pendingUserId })
        .select()
        .single();

      if (orgError) throw orgError;

      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create the librarian's profile with the new organization
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: pendingUserId,
          full_name: user?.user_metadata?.full_name || "",
          email: user?.email || "",
          organization_id: orgData.id,
        });

      if (profileError) throw profileError;

      toast({
        title: "Organization created!",
        description: `Welcome to ${newOrgName}. You can now manage your library.`,
      });
      
      setShowOrgCreation(false);
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address.",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Reset link sent!",
        description: "Check your email for a password reset link.",
      });
      setIsForgotPassword(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Check if user has completed profile setup
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

          if (!profile || !profile.organization_id) {
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .single();

            if (roleData?.role === "librarian") {
              setShowOrgCreation(true);
              setPendingUserId(user.id);
              setLoading(false);
              return;
            }
          }
        }

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/");
      } else {
        if (signupRole === "student") {
          if (!selectedOrganizationId) {
            toast({
              variant: "destructive",
              title: "Organization required",
              description: "Please select your school/organization.",
            });
            setLoading(false);
            return;
          }
        } else {
          if (!librarianOrgName.trim()) {
            toast({
              variant: "destructive",
              title: "Organization name required",
              description: "Please enter the name of the organization you want to create.",
            });
            setLoading(false);
            return;
          }
        }

        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: signupRole, // server trigger only honors 'librarian' or defaults to student
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (authData.user) {
          if (signupRole === "librarian") {
            // Create the organization (unique constraint enforces 1 org per email)
            const { data: orgData, error: orgError } = await supabase
              .from("organizations")
              .insert({ name: librarianOrgName.trim(), created_by: authData.user.id })
              .select()
              .single();

            if (orgError) {
              if (orgError.code === "23505") {
                throw new Error("This email has already created an organization. Each librarian email can only manage one organization.");
              }
              throw orgError;
            }

            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                full_name: fullName,
                email: email,
                organization_id: orgData.id,
              });

            if (profileError) throw profileError;

            toast({
              title: "Organization created!",
              description: `Welcome to ${librarianOrgName}. You can now manage your library.`,
            });
            navigate("/");
          } else {
            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                full_name: fullName,
                email: email,
                grade: grade || null,
                organization_id: selectedOrganizationId,
                age: age ? parseInt(age) : null,
                gr_number: grNumber || null,
              });

            if (profileError) {
              console.error("Error creating student profile:", profileError);
              throw profileError;
            }

            toast({
              title: "Account created!",
              description: "You have successfully signed up as a student.",
            });
            navigate("/");
          }
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Organization creation screen for librarians
  if (showOrgCreation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Create Your Organization</CardTitle>
            <CardDescription>
              Set up your library organization. This name is case-sensitive and must be unique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="e.g., Springfield High School Library"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This name is case-sensitive. Students will select this when creating accounts.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !newOrgName.trim()}>
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password screen
  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Library Management</CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to access your library" : "Create your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                {/* Role selector */}
                <div className="space-y-2">
                  <Label>I am signing up as</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={signupRole === "student" ? "default" : "outline"}
                      onClick={() => setSignupRole("student")}
                    >
                      Student
                    </Button>
                    <Button
                      type="button"
                      variant={signupRole === "librarian" ? "default" : "outline"}
                      onClick={() => setSignupRole("librarian")}
                    >
                      Librarian
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                {signupRole === "librarian" ? (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Librarian / Organization Details</p>
                    <div className="space-y-2">
                      <Label htmlFor="librarianOrgName">Organization Name *</Label>
                      <Input
                        id="librarianOrgName"
                        type="text"
                        placeholder="e.g., Springfield High School Library"
                        value={librarianOrgName}
                        onChange={(e) => setLibrarianOrgName(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        This name is case-sensitive and must be unique. Each librarian email can only manage one organization.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Student Details</p>

                    <div className="space-y-2">
                      <Label htmlFor="organization">School/Organization *</Label>
                      {organizations.length > 0 ? (
                        <Select value={selectedOrganizationId} onValueChange={setSelectedOrganizationId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                          No organizations available. A librarian must create an organization first.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="grade">Grade</Label>
                        <Input
                          id="grade"
                          type="text"
                          placeholder="e.g., 10th"
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          min="5"
                          max="100"
                          placeholder="e.g., 16"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grNumber">GR Number</Label>
                      <Input
                        id="grNumber"
                        type="text"
                        placeholder="e.g., GR-12345"
                        value={grNumber}
                        onChange={(e) => setGrNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || (!isLogin && organizations.length === 0)}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
