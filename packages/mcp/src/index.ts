#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';
const handle=serveStdio(()=>createServer('local'),{onerror:()=>process.stderr.write('MCP transport error. No request bodies or credentials were logged.\n')});
process.once('SIGINT',()=>{void handle.close();});
process.once('SIGTERM',()=>{void handle.close();});
