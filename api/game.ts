// Vercel Function: POST /api/game
import { handleGameRequest } from '../server/http.js'
import { supabaseDeps } from '../server/supabase.js'

export async function POST(request: Request): Promise<Response> {
  return handleGameRequest(request, supabaseDeps())
}
