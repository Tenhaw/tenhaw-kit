export const dynamic='force-dynamic';
export function GET(){return Response.json({status:'ok',version:'1.0.0',commit:process.env.VERCEL_GIT_COMMIT_SHA??'local'},{headers:{'Cache-Control':'no-store'}});}
