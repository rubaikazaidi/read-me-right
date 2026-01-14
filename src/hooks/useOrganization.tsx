import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Organization {
  id: string;
  name: string;
}

export const useOrganization = () => {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setOrganization(null);
      setOrganizationId(null);
      setLoading(false);
      return;
    }

    const fetchOrganization = async () => {
      try {
        // Get the user's organization_id from their profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (profileError || !profile?.organization_id) {
          setOrganization(null);
          setOrganizationId(null);
          setLoading(false);
          return;
        }

        setOrganizationId(profile.organization_id);

        // Fetch the organization details
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id, name")
          .eq("id", profile.organization_id)
          .single();

        if (orgError) {
          console.error("Error fetching organization:", orgError);
        } else {
          setOrganization(org);
        }
      } catch (error) {
        console.error("Error in useOrganization:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [user, authLoading]);

  return { organization, organizationId, loading };
};
