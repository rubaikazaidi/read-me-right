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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting queue position update...');

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
      console.log(`Updated ${updatePromises.length} queue positions`);
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
