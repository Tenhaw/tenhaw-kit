import { VERSION } from '@tenhaw/core';
export const dynamic='force-dynamic';
export function GET(){return Response.json({status:'ok',version:VERSION,commit:process.env.VERCEL_GIT_COMMIT_SHA??'local'},{headers:{'Cache-Control':'no-store'}});}
