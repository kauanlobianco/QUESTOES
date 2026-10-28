// Vercel Function: POST /api/game
import { handleGameRequest } from '../server/http'
import { supabaseDeps } from '../server/supabase'

export async function POST(request: Request): Promise<Response> {
  return handleGameRequest(request, supabaseDeps())
}
