import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Building2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "librarian">("student");
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

  // Fetch organizations for student signup
  useEffect(() => {
    const fetchOrganizations = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      
      if (!error && data) {
        setOrganizations(data);
      }
    };

    if (!isLogin && role === "student") {
      fetchOrganizations();
    }
  }, [isLogin, role]);

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
        // Validate student has selected an organization
        if (role === "student" && !selectedOrganizationId) {
          toast({
            variant: "destructive",
            title: "Organization required",
            description: "Please select your school/organization.",
          });
          setLoading(false);
          return;
        }

        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (authData.user) {
          if (role === "librarian") {
            // Librarian needs to create organization
            setPendingUserId(authData.user.id);
            setShowOrgCreation(true);
            toast({
              title: "Account created!",
              description: "Now let's set up your organization.",
            });
          } else {
            // Student - create profile with selected organization
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
              description: "You have successfully signed up.",
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
                <div className="space-y-2">
                  <Label>I am a:</Label>
                  <RadioGroup value={role} onValueChange={(value) => setRole(value as "student" | "librarian")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="student" id="student" />
                      <Label htmlFor="student" className="font-normal cursor-pointer">
                        Student
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="librarian" id="librarian" />
                      <Label htmlFor="librarian" className="font-normal cursor-pointer">
                        Librarian
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Student-specific fields */}
                {role === "student" && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Student Details</p>
                    
                    {/* Organization selection for students */}
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

                {/* Librarian info */}
                {role === "librarian" && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      As a librarian, you'll create a new organization after signing up. Students will then be able to join your organization.
                    </p>
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
              <Label htmlFor="password">Password</Label>
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
              disabled={loading || (role === "student" && !isLogin && organizations.length === 0)}
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
