// Supabase Edge Function: health-check
// Follows Phase 0 deliverable requirements in Architecture.md and Phases.md

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ICEM Connect Backend / Edge Functions',
      version: '1.1.0',
      domain: 'indiraicem.ac.in',
    };

    return new Response(JSON.stringify(healthData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'error', message: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
