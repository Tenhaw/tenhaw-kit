import { appDomainProof } from '../../../src/domain-proof';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return appDomainProof(request); }
