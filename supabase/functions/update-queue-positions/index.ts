import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // SECURITY: Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token to verify identity and role
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.log('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // SECURITY: Verify user has librarian role
    const { data: roleData, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'librarian')
      .single();

    if (roleError || !roleData) {
      console.log('Authorization failed - not a librarian:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Librarian access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authorized librarian, starting queue position update...');

    // Use service role for the actual update operation (bypasses RLS for cross-org updates)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending book requests grouped by book
    const { data: requests, error: fetchError } = await supabase
      .from('book_requests')
      .select('id, book_id, queue_position, requested_at')
      .eq('status', 'pending')
      .order('book_id')
      .order('requested_at');

    if (fetchError) {
      console.error('Error fetching requests:', fetchError);
      throw fetchError;
    }

    if (!requests || requests.length === 0) {
      console.log('No pending requests to update');
      return new Response(
        JSON.stringify({ message: 'No pending requests to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group requests by book and recalculate positions
    const updatePromises = [];
    let currentBookId = null;
    let position = 0;

    for (const request of requests) {
      if (currentBookId !== request.book_id) {
        currentBookId = request.book_id;
        position = 1;
      } else {
        position++;
      }

      // Update only if position has changed
      if (request.queue_position !== position) {
        updatePromises.push(
          supabase
            .from('book_requests')
            .update({ queue_position: position })
            .eq('id', request.id)
        );
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`Updated ${updatePromises.length} queue positions by librarian ${user.id}`);
    } else {
      console.log('All queue positions are already correct');
    }

    return new Response(
      JSON.stringify({ 
        message: 'Queue positions updated successfully',
        updated: updatePromises.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-queue-positions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});