import reference from './reference.json';
import cursor from '../../../plugins/cursor/mcp.json';
export const { source,tools,templates,guides,install,pages } = reference;
export const cursorInstallUrl = `cursor://anysphere.cursor-deeplink/mcp/install?name=tenhaw&config=${encodeURIComponent(Buffer.from(JSON.stringify(cursor.mcpServers.tenhaw)).toString('base64'))}`;
