import type { NextConfig } from 'next';
import path from 'node:path';
import fs from 'node:fs';
// Development may reuse an existing dependency tree on disk; ordinary installs use this repo.
const modules = fs.realpathSync(path.join(process.cwd(), 'node_modules'));
const root = modules.startsWith(process.cwd() + path.sep) ? process.cwd() : path.dirname(path.dirname(modules));
const config: NextConfig = { output: 'export', images: { unoptimized: true }, allowedDevOrigins: ['vibeghost-lite.local', 'macbook-m4.tail272f03.ts.net'], turbopack: { root } };
export default config;
