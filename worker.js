// Cloudflare Workers entry point for iori-nav / mybk.
//
// This file replaces Cloudflare Pages' automatic `functions/` routing.
// The application code under `functions/` is intentionally kept intact;
// this dispatcher adapts its Pages Functions handlers to the Workers
// Module Worker runtime.

import * as middleware from './functions/_middleware.js';
import * as home from './functions/index.js';

import * as adminLogin from './functions/admin/login.js';
import * as adminLogout from './functions/admin/logout.js';
import * as adminIndex from './functions/admin/index.js';

import * as apiWallpaper from './functions/api/wallpaper.js';
import * as apiPublicConfig from './functions/api/public-config.js';
import * as apiSettings from './functions/api/settings.js';
import * as apiAiChat from './functions/api/ai-chat.js';
import * as apiUpdateDescription from './functions/api/update-description.js';
import * as apiGetEmptyDescSites from './functions/api/get-empty-desc-sites.js';

import * as apiCategoriesIndex from './functions/api/categories/index.js';
import * as apiCategoriesCreate from './functions/api/categories/create.js';
import * as apiCategoriesReorder from './functions/api/categories/reorder.js';
import * as apiCategoriesId from './functions/api/categories/[id].js';

import * as apiConfigIndex from './functions/api/config/index.js';
import * as apiConfigBatch from './functions/api/config/batch.js';
import * as apiConfigSubmit from './functions/api/config/submit.js';
import * as apiConfigImport from './functions/api/config/import.js';
import * as apiConfigExport from './functions/api/config/export.js';
import * as apiConfigId from './functions/api/config/[id].js';

import * as apiCacheClear from './functions/api/cache/clear.js';

import * as apiPendingIndex from './functions/api/pending/index.js';
import * as apiPendingId from './functions/api/pending/[id].js';

import * as apiBackupWebdav from './functions/api/backup/webdav.js';

function makeContext(request, env, ctx, params = {}) {
  return {
    request,
    env,
    params,
    waitUntil: (promise) => ctx.waitUntil(promise),
    next: async () => dispatchRoute(request, env, ctx, params),
  };
}

async function callPagesHandler(module, request, env, ctx, params = {}) {
  const method = request.method.toUpperCase();

  // Pages Functions method exports are onRequestGet/onRequestPost/etc.
  // A generic onRequest is used by handlers such as logout.
  const methodHandler = module[`onRequest${method[0]}${method.slice(1).toLowerCase()}`];
  if (typeof methodHandler === 'function') {
    return methodHandler(makeContext(request, env, ctx, params));
  }

  if (typeof module.onRequest === 'function') {
    return module.onRequest(makeContext(request, env, ctx, params));
  }

  // HEAD requests are normally equivalent to GET for these HTML/JSON
  // handlers. Pages may route HEAD through GET in some cases, so preserve
  // that useful behavior for the migrated Worker.
  if (method === 'HEAD' && typeof module.onRequestGet === 'function') {
    return module.onRequestGet(makeContext(request, env, ctx, params));
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: Object.keys(module)
        .filter((key) => /^onRequest(?:Get|Post|Put|Delete|Patch|Head)$/.test(key))
        .map((key) => key.replace('onRequest', '').toUpperCase())
        .join(', '),
    },
  });
}

function matchIdPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const value = pathname.slice(prefix.length);
  if (!value || value.includes('/')) return null;
  return decodeURIComponent(value);
}

async function dispatchRoute(request, env, ctx, params = {}) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Root SSR page.
  if (path === '/') {
    return callPagesHandler(home, request, env, ctx, params);
  }

  // Admin pages.
  if (path === '/admin' || path === '/admin/') {
    return callPagesHandler(adminIndex, request, env, ctx, params);
  }
  if (path === '/admin/login') {
    return callPagesHandler(adminLogin, request, env, ctx, params);
  }
  if (path === '/admin/index.html') {
    return callPagesHandler(adminIndex, request, env, ctx, params);
  }
  if (path === '/admin/logout') {
    return callPagesHandler(adminLogout, request, env, ctx, params);
  }

  // Fixed API routes.
  const fixedRoutes = new Map([
    ['/api/wallpaper', apiWallpaper],
    ['/api/public-config', apiPublicConfig],
    ['/api/settings', apiSettings],
    ['/api/ai-chat', apiAiChat],
    ['/api/update-description', apiUpdateDescription],
    ['/api/get-empty-desc-sites', apiGetEmptyDescSites],

    ['/api/categories', apiCategoriesIndex],
    ['/api/categories/create', apiCategoriesCreate],
    ['/api/categories/reorder', apiCategoriesReorder],

    ['/api/config', apiConfigIndex],
    ['/api/config/batch', apiConfigBatch],
    ['/api/config/submit', apiConfigSubmit],
    ['/api/config/import', apiConfigImport],
    ['/api/config/export', apiConfigExport],

    ['/api/cache/clear', apiCacheClear],

    ['/api/pending', apiPendingIndex],
    ['/api/backup/webdav', apiBackupWebdav],
  ]);

  // More specific fixed routes must win over dynamic /[id] routes.
  const fixed = fixedRoutes.get(path);
  if (fixed) {
    return callPagesHandler(fixed, request, env, ctx, params);
  }

  // Dynamic routes.
  let id;

  id = matchIdPath(path, '/api/categories/');
  if (id !== null) {
    return callPagesHandler(apiCategoriesId, request, env, ctx, { id });
  }

  id = matchIdPath(path, '/api/config/');
  if (id !== null) {
    return callPagesHandler(apiConfigId, request, env, ctx, { id });
  }

  id = matchIdPath(path, '/api/pending/');
  if (id !== null) {
    return callPagesHandler(apiPendingId, request, env, ctx, { id });
  }

  // Any other URL is a static asset request (or a genuine 404). This is
  // also what Pages would do after its Functions router finds no function.
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    // Keep the original Pages `_middleware.js` behavior for all dynamic
    // application routes. Static assets are handled directly by the
    // Workers Static Assets layer unless the request reaches this Worker.
    const context = {
      request,
      env,
      params: {},
      waitUntil: (promise) => ctx.waitUntil(promise),
      next: () => dispatchRoute(request, env, ctx, {}),
    };

    if (typeof middleware.onRequest === 'function') {
      const response = await middleware.onRequest(context);
      if (response instanceof Response) return response;
    }

    return dispatchRoute(request, env, ctx, {});
  },
};
